import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deployment', Path(__file__).parents[1] / 'deploy.py')
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)
OLD = 'a' * 40
NEW = 'b' * 40


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.old = self.root / 'old'
        self.new = self.root / 'new'
        for source in (self.old, self.new):
            for name in ('apps/api/src/main.ts', 'apps/ocr/src/main.ts', 'apps/ocr/src/store.ts',
                         'apps/api/src/database/migrations/initial.ts', 'deploy/api/compose.yaml',
                         'deploy/ocr/compose.yaml', 'packages/ui/src/typo.tsx', 'pnpm-lock.yaml'):
                path = source / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('unchanged')
        self.previous = {service: {'source': str(self.old), 'revision': OLD} for service in ('api', 'ocr')}

    def test_input_scope_and_existing_environment(self):
        (self.old / 'deploy/api/.env').write_text('private existing settings')
        (self.old / 'deploy/api/README.md').write_text('older documentation')
        self.assertEqual(deployment.changed_services(self.previous, self.new), [])
        (self.new / 'apps/ocr/src/main.ts').write_text('new OCR')
        self.assertEqual(deployment.changed_services(self.previous, self.new), ['ocr'])
        (self.new / 'packages/ui/src/typo.tsx').write_text('shared UI')
        self.assertEqual(deployment.changed_services(self.previous, self.new), ['api', 'ocr'])

    def test_schema_and_topology_changes_require_operator(self):
        for name, service in [('apps/ocr/src/store.ts', 'ocr'),
                              ('apps/api/src/database/migrations/initial.ts', 'api'),
                              ('deploy/api/compose.yaml', 'api')]:
            path = self.new / name
            path.write_text('incompatible')
            with self.assertRaises(RuntimeError):
                deployment.require_compatible(self.previous, self.new, [service])
            path.write_text('unchanged')

    def test_preserve_configuration_when_changing_tag(self):
        original = f'DFRAGON_IMAGE_TAG={OLD}\nOCR_OWNER_ID=synthetic\nOCR_DATA_DIRECTORY=/persistent\n'
        self.assertEqual(deployment.tagged_environment(original, NEW), original.replace(OLD, NEW))
        with self.assertRaises(RuntimeError):
            deployment.tagged_environment('OCR_DATA_DIRECTORY=/persistent', NEW)
        for bad in ['main', '--help', 'a' * 39, NEW + '\n', NEW + ';id']:
            with self.assertRaises(ValueError):
                deployment.revision(bad)

    def test_ci_and_branch_must_match_before_archive(self):
        class Response:
            runs = []
            def __enter__(self):
                return self
            def __exit__(self, *_args):
                pass
            def read(self):
                return json.dumps({'workflow_runs': self.runs})
        with patch.object(deployment.urllib.request, 'urlopen', return_value=Response()), patch.object(deployment, 'run') as run:
            with self.assertRaises(RuntimeError):
                deployment.fetch_source(NEW)
            run.assert_not_called()
            Response.runs = [{'head_sha': NEW, 'head_branch': 'feature', 'event': 'push',
                              'conclusion': 'success', 'head_repository': {'full_name': 'blahaj94/dfragon'}}]
            with self.assertRaises(RuntimeError):
                deployment.fetch_source(NEW)
            run.assert_not_called()

    def test_no_changes_leave_containers_and_rollback_baseline_untouched(self):
        state = self.root / 'state'
        state.mkdir()
        (state / 'state.json').write_text(json.dumps(self.previous))
        (state / 'previous.json').write_text('existing rollback baseline')
        with patch.object(deployment, 'STATE', state), \
             patch.object(deployment, 'fetch_source', return_value=self.new), \
             patch.object(deployment, 'run', return_value=NEW + '\trefs/heads/main') as run, \
             patch.object(deployment, 'container') as container:
            deployment.deploy_release(NEW)
        container.assert_not_called()
        run.assert_called_once_with('git', 'ls-remote', deployment.REPOSITORY, 'refs/heads/main')
        self.assertEqual(json.loads((state / 'state.json').read_text()), self.previous)
        self.assertEqual((state / 'previous.json').read_text(), 'existing rollback baseline')
        self.assertEqual(json.loads((state / 'status.json').read_text())['changed'], [])

    def test_readiness_failure_restores_only_changed_container_and_environment(self):
        state = self.root / 'state'
        state.mkdir()
        (state / 'state.json').write_text(json.dumps(self.previous))
        env = self.root / 'ocr.env'
        original = f'DFRAGON_IMAGE_TAG={OLD}\nOCR_OWNER_ID=synthetic\n'
        env.write_text(original)
        (self.new / 'apps/ocr/src/main.ts').write_text('changed')
        before = {'Id': 'old-container', 'Image': 'sha256:old', 'Config': {'Image': 'dfragon-ocr:' + OLD}}
        commands = []
        def run(*args, **_kwargs):
            commands.append(args)
            if args[:2] == ('git', 'ls-remote'):
                return NEW + '\trefs/heads/main'
            if args[:3] == ('docker', 'image', 'inspect'):
                return 'sha256:old'
            return ''
        real_open = open
        def owned_lock(path, *args, **kwargs):
            if path == '/run/lock/dfragon-deploy.lock':
                path = self.root / 'lock'
            return real_open(path, *args, **kwargs)
        with patch.object(deployment, 'STATE', state), patch.object(deployment, 'RELEASES', self.root), \
             patch.object(deployment, 'fetch_source', return_value=self.new), \
             patch.object(deployment, 'environment_file', return_value=env), \
             patch.object(deployment, 'container', return_value=before), \
             patch.object(deployment, 'run', side_effect=run), \
             patch.object(deployment, 'ready', side_effect=[RuntimeError('not ready'), None]), \
             patch('builtins.open', side_effect=owned_lock):
            with self.assertRaises(RuntimeError):
                deployment.apply(NEW)
        self.assertEqual(env.read_text(), original)
        self.assertEqual(json.loads((state / 'state.json').read_text()), self.previous)
        status = json.loads((state / 'status.json').read_text())
        self.assertEqual(status['status'], 'failed')
        self.assertTrue(status['restored'])
        switches = [args for args in commands if args[:2] == ('docker', 'compose')]
        self.assertEqual(len(switches), 2)
        for args in switches:
            self.assertIn('--no-deps', args)
            self.assertEqual(args[-1], 'ocr')
            self.assertNotIn('down', args)
            self.assertNotIn('database', args)


if __name__ == '__main__':
    unittest.main()
