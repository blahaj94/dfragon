from contextlib import closing
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('upgrade_ocr_splits', Path(__file__).parents[1] / 'upgrade_ocr_splits.py')
rollout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rollout)
deployment = rollout.deployment
OLD = 'a' * 40
NEW = 'b' * 40


class OcrSplitRolloutTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.old = self.root / 'old'
        self.new = self.root / 'new'
        for source, content in ((self.old, b'old store'), (self.new, b'new store')):
            store = source / 'apps/ocr/src/store.ts'
            store.parent.mkdir(parents=True)
            store.write_bytes(content)
            compose = source / 'deploy/ocr/compose.yaml'
            compose.parent.mkdir(parents=True)
            compose.write_text('unchanged topology')
        self.state = self.root / 'state'
        self.state.mkdir()
        self.previous = {service: {'source': str(self.old), 'revision': OLD} for service in ('api', 'accounts', 'ocr')}
        (self.state / 'state.json').write_text(json.dumps(self.previous))
        (self.state / 'previous.json').write_text('previous rollback baseline')
        self.environment = self.root / 'ocr.env'
        self.original_environment = f'DFRAGON_IMAGE_TAG={OLD}\nOCR_OWNER_ID=synthetic\n'
        self.environment.write_text(self.original_environment)
        directory = self.root / 'data'
        directory.mkdir()
        self.database = directory / 'ocr.sqlite'
        with closing(sqlite3.connect(self.database)) as database:
            for table in rollout.TABLES:
                database.execute(f'CREATE TABLE {table}(id TEXT PRIMARY KEY, payload BLOB)')
                database.execute(f'INSERT INTO {table} VALUES (?, ?)', ('테스트★', b'original bytes\x00'))
            database.commit()
        self.before = {
            'Id': 'old-container', 'Image': 'sha256:old', 'Config': {'Image': 'dfragon-ocr:' + OLD},
            'Mounts': [{'Destination': '/data', 'Type': 'bind', 'RW': True, 'Source': str(directory)}],
        }
        self.after = {**self.before, 'Id': 'new-container', 'Image': 'sha256:new',
                      'Config': {'Image': 'dfragon-ocr:' + NEW}}
        self.commands = []
        patches = [
            patch.object(rollout, 'OLD_STORE', hashlib.sha256(b'old store').hexdigest()),
            patch.object(rollout, 'NEW_STORE', hashlib.sha256(b'new store').hexdigest()),
            patch.object(deployment, 'STATE', self.state),
            patch.object(deployment, 'RELEASES', self.root),
            patch.object(deployment, 'fetch_source', return_value=self.new),
            patch.object(deployment, 'environment_file', return_value=self.environment),
            patch.object(deployment, 'container', side_effect=[self.before, self.before, self.after]),
            patch.object(deployment, 'run', side_effect=self.run_command),
            patch.object(rollout.shutil, 'disk_usage', return_value=SimpleNamespace(free=100 * 1024**3)),
        ]
        for mocked in patches:
            mocked.start()
            self.addCleanup(mocked.stop)

    def run_command(self, *args, **_kwargs):
        self.commands.append(args)
        if args[:2] == ('git', 'ls-remote'):
            return NEW + '\trefs/heads/main'
        if args[:3] == ('docker', 'image', 'inspect'):
            return 'sha256:old' if args[-1] == 'dfragon-ocr:' + OLD else 'sha256:new'
        if args[:2] == ('docker', 'inspect'):
            return 'false 0 false'
        if args[-3:] == ('config', '--format', 'json'):
            return json.dumps({'services': {'ocr': {'volumes': [
                {'target': '/data', 'type': 'bind', 'source': str(self.database.parent)}
            ]}}})
        return ''

    def add_tables(self, _image, path):
        self.commands.append(('initialize',))
        with closing(sqlite3.connect(path)) as database:
            database.executescript('CREATE TABLE label_unassigned(text TEXT PRIMARY KEY);'
                                   'CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);')

    def status(self):
        return json.loads((self.state / 'status.json').read_text())

    def test_verified_migration_updates_only_ocr_after_readiness_and_keeps_backup(self):
        baseline = rollout.inspect_database(self.database)
        def ready(service):
            self.assertEqual(service, 'ocr')
            self.assertEqual(json.loads((self.state / 'state.json').read_text()), self.previous)
            self.commands.append(('ready',))
        with patch.object(rollout, 'initialize_split_tables', side_effect=self.add_tables), \
             patch.object(deployment, 'ready', side_effect=ready):
            rollout.upgrade(NEW)

        self.assertEqual(rollout.inspect_database(self.database, require_added=True), baseline)
        backups = list((self.state / 'backups').glob('*/ocr.sqlite'))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].stat().st_mode & 0o777, 0o600)
        self.assertEqual(backups[0].parent.stat().st_mode & 0o777, 0o700)
        self.assertEqual(rollout.inspect_database(backups[0]), baseline)
        expected = {**self.previous, 'ocr': {'source': str(self.new), 'revision': NEW}}
        self.assertEqual(json.loads((self.state / 'state.json').read_text()), expected)
        self.assertEqual(json.loads((self.state / 'previous.json').read_text()), self.previous)
        self.assertEqual(self.environment.read_text(), self.original_environment.replace(OLD, NEW))
        self.assertEqual(self.status()['status'], 'succeeded')
        switches = [args for args in self.commands if args[:2] == ('docker', 'compose') and 'config' not in args]
        self.assertEqual(len(switches), 2)
        self.assertEqual(switches[0][-2:], ('stop', 'ocr'))
        self.assertIn('--no-deps', switches[1])
        self.assertEqual(switches[1][-1], 'ocr')
        self.assertLess(self.commands.index(switches[0]), self.commands.index(('initialize',)))
        self.assertLess(self.commands.index(('initialize',)), self.commands.index(switches[1]))

    def test_unreviewed_store_and_topology_are_rejected_before_build_or_stop(self):
        for path in (self.new / 'apps/ocr/src/store.ts', self.new / 'deploy/ocr/compose.yaml'):
            with self.subTest(path=path.name):
                original = path.read_text()
                path.write_text('not the reviewed transition')
                with self.assertRaises(RuntimeError):
                    rollout.upgrade(NEW)
                path.write_text(original)
                self.assertEqual(self.commands, [])
                self.assertEqual(json.loads((self.state / 'state.json').read_text()), self.previous)

    def test_changed_mount_is_rejected_without_creating_a_database(self):
        wrong = self.root / 'wrong-data'
        wrong.mkdir()
        self.before['Mounts'][0]['Source'] = str(wrong)
        with self.assertRaisesRegex(RuntimeError, 'directory differs'):
            rollout.upgrade(NEW)
        self.assertFalse((wrong / 'ocr.sqlite').exists())
        self.assertFalse(any(args[:2] == ('docker', 'build') for args in self.commands))

    def test_backup_failure_restarts_old_image_without_migrating(self):
        with patch.object(rollout, 'backup_database', side_effect=OSError('no space')), \
             patch.object(rollout, 'initialize_split_tables') as initialize, \
             patch.object(deployment, 'ready'):
            with self.assertRaises(OSError):
                rollout.upgrade(NEW)
        initialize.assert_not_called()
        self.assertTrue(self.status()['restored'])
        self.assertEqual(self.environment.read_text(), self.original_environment)
        self.assertEqual(json.loads((self.state / 'state.json').read_text()), self.previous)

    def test_unclean_stop_does_not_start_migration(self):
        def run(*args, **kwargs):
            if args[:2] == ('docker', 'inspect'):
                return 'false 137 false'
            return self.run_command(*args, **kwargs)
        with patch.object(deployment, 'run', side_effect=run), \
             patch.object(rollout, 'initialize_split_tables') as initialize, \
             patch.object(deployment, 'ready'):
            with self.assertRaisesRegex(RuntimeError, 'stop cleanly'):
                rollout.upgrade(NEW)
        initialize.assert_not_called()
        self.assertTrue(self.status()['restored'])
        self.assertEqual(json.loads((self.state / 'state.json').read_text()), self.previous)

    def test_readiness_failure_restores_old_image_with_current_data(self):
        def fail_readiness(_service):
            with closing(sqlite3.connect(self.database)) as database:
                database.execute("INSERT INTO captures VALUES ('accepted-after-start', X'0123')")
                database.commit()
            raise RuntimeError('not ready')
        with patch.object(rollout, 'initialize_split_tables', side_effect=self.add_tables), \
             patch.object(deployment, 'ready') as ready:
            # A request accepted after startup must survive image rollback.
            ready.side_effect = lambda service: fail_readiness(service) if ready.call_count == 1 else None
            with self.assertRaisesRegex(RuntimeError, 'not ready'):
                rollout.upgrade(NEW)
        with closing(sqlite3.connect(self.database)) as database:
            self.assertEqual(database.execute("SELECT payload FROM captures WHERE id='accepted-after-start'").fetchone(), (b'\x01#',))
        self.assertEqual(self.environment.read_text(), self.original_environment)
        self.assertEqual(json.loads((self.state / 'state.json').read_text()), self.previous)
        self.assertEqual((self.state / 'previous.json').read_text(), 'previous rollback baseline')
        self.assertTrue(self.status()['restored'])

    def test_data_mutation_during_initialization_leaves_service_stopped_and_backup_intact(self):
        def corrupt_initializer(image, path):
            self.add_tables(image, path)
            with closing(sqlite3.connect(path)) as database:
                database.execute('DELETE FROM label_splits')
                database.commit()
        with patch.object(rollout, 'initialize_split_tables', side_effect=corrupt_initializer), \
             patch.object(deployment, 'ready') as ready:
            with self.assertRaisesRegex(RuntimeError, 'data changed'):
                rollout.upgrade(NEW)
        ready.assert_not_called()
        self.assertFalse(any('up' in args for args in self.commands))
        self.assertFalse(self.status()['restored'])
        self.assertEqual(json.loads((self.state / 'state.json').read_text()), self.previous)
        backup = next((self.state / 'backups').glob('*/ocr.sqlite'))
        with closing(sqlite3.connect(backup)) as database:
            self.assertEqual(database.execute('SELECT COUNT(*) FROM label_splits').fetchone()[0], 1)

    def assert_metadata_failure_restores_records(self, failed_record):
        save = deployment.save
        failed = False
        def save_with_failure(path, value):
            nonlocal failed
            is_new_state = path.name == 'state.json' and value['ocr']['revision'] == NEW
            is_success = path.name == 'status.json' and value['status'] == 'succeeded'
            if path.name == failed_record and (is_new_state or is_success) and not failed:
                failed = True
                raise OSError('metadata save failed')
            save(path, value)
        with patch.object(rollout, 'initialize_split_tables', side_effect=self.add_tables), \
             patch.object(deployment, 'ready'), patch.object(deployment, 'save', side_effect=save_with_failure):
            with self.assertRaisesRegex(OSError, 'metadata save failed'):
                rollout.upgrade(NEW)
        self.assertTrue(failed)
        self.assertTrue(self.status()['restored'])
        self.assertEqual(json.loads((self.state / 'state.json').read_text()), self.previous)
        self.assertEqual(self.environment.read_text(), self.original_environment)

    def test_state_save_failure_preserves_existing_rollback_record(self):
        self.assert_metadata_failure_restores_records('state.json')
        self.assertEqual((self.state / 'previous.json').read_text(), 'previous rollback baseline')

    def test_success_status_save_failure_restores_absent_rollback_record(self):
        (self.state / 'previous.json').unlink()
        self.assert_metadata_failure_restores_records('status.json')
        self.assertFalse((self.state / 'previous.json').exists())

    def test_started_or_malformed_split_tables_are_not_silently_accepted(self):
        self.add_tables('unused', self.database)
        with closing(sqlite3.connect(self.database)) as database:
            database.execute("INSERT INTO settings VALUES ('split-initialized', '1')")
            database.commit()
        with self.assertRaisesRegex(RuntimeError, 'already contain data'):
            rollout.inspect_database(self.database)
        with closing(sqlite3.connect(self.database)) as database:
            database.executescript('DROP TABLE settings; CREATE TABLE settings(key TEXT, value TEXT);')
        with self.assertRaisesRegex(RuntimeError, 'schema'):
            rollout.inspect_database(self.database)

    def test_settings_changed_during_migration_are_preserved_for_operator_inspection(self):
        def initializer(image, path):
            self.add_tables(image, path)
            self.environment.write_text(self.original_environment + 'OCR_MAX_BYTES=2048\n')
        with patch.object(rollout, 'initialize_split_tables', side_effect=initializer), \
             patch.object(deployment, 'ready') as ready:
            with self.assertRaisesRegex(RuntimeError, 'settings changed'):
                rollout.upgrade(NEW)
        ready.assert_not_called()
        self.assertFalse(any('up' in args for args in self.commands))
        self.assertFalse(self.status()['restored'])
        self.assertIn('OCR_MAX_BYTES=2048', self.environment.read_text())

    def test_operator_command_obeys_the_automatic_deployment_lock(self):
        lock_path = self.root / 'deployment.lock'
        real_open = open
        def owned_lock(path, *args, **kwargs):
            if path == '/run/lock/dfragon-deploy.lock':
                path = lock_path
            return real_open(path, *args, **kwargs)
        with open(lock_path, 'a') as lock:
            rollout.fcntl.flock(lock, rollout.fcntl.LOCK_EX | rollout.fcntl.LOCK_NB)
            with patch.object(rollout.os, 'geteuid', return_value=0), \
                 patch.object(rollout.sys, 'argv', ['upgrade_ocr_splits.py', NEW]), \
                 patch.dict(rollout.os.environ), patch('builtins.open', side_effect=owned_lock), \
                 patch.object(rollout, 'upgrade') as upgrade:
                original_umask = rollout.os.umask(0o077)
                try:
                    with self.assertRaises(BlockingIOError):
                        rollout.main()
                finally:
                    rollout.os.umask(original_umask)
                upgrade.assert_not_called()

    def test_initializer_timeout_removes_exact_container_before_returning(self):
        commands = []
        def run(*args, **_kwargs):
            commands.append(args)
            if args[:2] == ('docker', 'create'):
                return 'initializer-container-id'
            if args[:2] == ('docker', 'start'):
                raise subprocess.TimeoutExpired('docker', 120)
            return ''
        with patch.object(deployment, 'run', side_effect=run):
            with self.assertRaises(subprocess.TimeoutExpired):
                rollout.initialize_split_tables('sha256:new', self.database)
        self.assertEqual(commands[-1], ('docker', 'rm', '--force', 'initializer-container-id'))
        self.assertIn('none', commands[0])
        self.assertNotIn('--publish', commands[0])


if __name__ == '__main__':
    unittest.main()
