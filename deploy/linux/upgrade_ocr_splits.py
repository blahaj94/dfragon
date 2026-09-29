#!/usr/bin/python3 -I
"""Operator-only rollout of the two additive SQLite tables introduced by PR #546."""
from contextlib import closing
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile

spec = importlib.util.spec_from_file_location('deployment', Path(__file__).with_name('deploy.py'))
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)

# Reviewed store.ts bytes at f4d13638 (before) and 4db059e6 (PR #546).
OLD_STORE = '8c525a013e64cc2b62a8921fbfde50794c0fd2cd290f844da3a31ba9fff3b5b6'
NEW_STORE = '841331c2956cf10a669a936ffa1ca566292cfdac393d32f8f79cbe5b64769c6c'
TABLES = ('captures', 'samples', 'label_splits', 'models', 'model_files')
ADDED_COLUMNS = {
    'label_unassigned': [(0, 'text', 'TEXT', 0, None, 1)],
    'settings': [(0, 'key', 'TEXT', 0, None, 1), (1, 'value', 'TEXT', 1, None, 0)],
}


def require_split_transition(previous, source):
    old = Path(previous['ocr']['source'])
    for directory, expected in ((old, OLD_STORE), (source, NEW_STORE)):
        if hashlib.sha256((directory / 'apps/ocr/src/store.ts').read_bytes()).hexdigest() != expected:
            raise RuntimeError('this tool only supports the reviewed OCR split transition')
    topology = ['deploy/ocr/compose.yaml']
    if deployment.fingerprint(old, topology) != deployment.fingerprint(source, topology):
        raise RuntimeError('OCR topology changed; separate operator migration required')


def database_path(info, source):
    mounts = [mount for mount in info['Mounts'] if mount['Destination'] == '/data']
    if len(mounts) != 1 or mounts[0]['Type'] != 'bind' or not mounts[0]['RW']:
        raise RuntimeError('expected the existing writable OCR bind mount')
    directory = Path(mounts[0]['Source'])
    config = json.loads(deployment.compose('ocr', source, 'config', '--format', 'json'))
    volumes = [volume for volume in config['services']['ocr']['volumes'] if volume['target'] == '/data']
    if (not directory.is_absolute() or ',' in str(directory) or len(volumes) != 1
            or volumes[0]['type'] != 'bind' or volumes[0].get('read_only', False)
            or Path(volumes[0]['source']).resolve() != directory.resolve()):
        raise RuntimeError('configured OCR data directory differs from the running service')
    database = directory / 'ocr.sqlite'
    if database.is_symlink() or not database.is_file():
        raise RuntimeError('existing OCR database required')
    return database


def inspect_database(path, *, require_added=False):
    # Read-only open must never create an empty database at a mistyped path.
    with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as database:
        if database.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
            raise RuntimeError('OCR database integrity check failed')
        if database.execute('PRAGMA foreign_key_check').fetchall():
            raise RuntimeError('OCR database foreign key check failed')
        schema = database.execute(
            "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
        ).fetchall()
        tables = {row[1] for row in schema if row[0] == 'table'}
        if not set(TABLES) <= tables or tables - set(TABLES) - ADDED_COLUMNS.keys():
            raise RuntimeError('unexpected OCR database tables')
        for name, columns in ADDED_COLUMNS.items():
            if name not in tables:
                if require_added:
                    raise RuntimeError('split table was not created')
                continue
            if database.execute(f'PRAGMA table_info({name})').fetchall() != columns:
                raise RuntimeError('unexpected split table schema')
            if database.execute(f'SELECT COUNT(*) FROM {name}').fetchone()[0] != 0:
                raise RuntimeError('split settings already contain data; operator inspection required')
        digests = {}
        for name in TABLES:
            digest = hashlib.sha256()
            for row in database.execute(f'SELECT rowid, * FROM {name} ORDER BY rowid'):
                for value in row:
                    data = value if isinstance(value, bytes) else json.dumps(value, ensure_ascii=False).encode()
                    digest.update((type(value).__name__ + ':' + str(len(data)) + ':').encode())
                    digest.update(data)
            digests[name] = digest.hexdigest()
        return {'schema': [row for row in schema if row[1] not in ADDED_COLUMNS], 'rows': digests}


def backup_database(database):
    backups = deployment.STATE / 'backups'
    backups.mkdir(mode=0o700, exist_ok=True)
    directory = Path(tempfile.mkdtemp(prefix='ocr-splits-', dir=backups))
    backup = directory / 'ocr.sqlite'
    with closing(sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)) as original, \
         closing(sqlite3.connect(backup)) as copy:
        original.backup(copy)
    backup.chmod(0o600)
    baseline = inspect_database(backup)
    if inspect_database(database) != baseline:
        raise RuntimeError('OCR backup differs from the stopped database')
    return baseline


def initialize_split_tables(image, database):
    initializer = "import { OcrStore } from './dist/src/store.js'; new OcrStore('/data/ocr.sqlite', 1).close();"
    job = deployment.run(
        'docker', 'create', '--network', 'none', '--read-only', '--user', '1000:1000',
        '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '128',
        '--memory', '1g', '--cpus', '2', '--mount', f'type=bind,source={database.parent},target=/data',
        '--entrypoint', 'node', image, '--input-type=module', '-e', initializer)
    try:
        deployment.run('docker', 'start', '--attach', job, timeout=120)
        if deployment.run('docker', 'inspect', '--format', '{{.State.ExitCode}}', job) != '0':
            raise RuntimeError('OCR table initialization failed')
    finally:
        # A timed-out Docker CLI does not stop its container. Remove this exact job before recovery.
        deployment.run('docker', 'rm', '--force', job)


def upgrade(commit):
    previous = json.loads((deployment.STATE / 'state.json').read_text())
    old = previous['ocr']
    phase = 'prepare-ocr-splits'
    stopped = False
    safe_to_restart = True
    status = {'revision': commit, 'status': 'running', 'phase': phase}
    deployment.save(deployment.STATE / 'status.json', status)
    try:
        source = deployment.fetch_source(commit)
        require_split_transition(previous, source)
        before = deployment.container('ocr')
        environment = deployment.environment_file('ocr')
        original_environment = environment.read_text()
        if (before['Config']['Image'] != 'dfragon-ocr:' + old['revision']
                or deployment.tagged_environment(original_environment, old['revision']) != original_environment):
            raise RuntimeError('running OCR release differs from recorded state')
        database = database_path(before, source)
        if shutil.disk_usage(deployment.RELEASES).free < 5 * 1024**3:
            raise RuntimeError('insufficient build disk reserve')
        phase = 'build-ocr'
        deployment.save(deployment.STATE / 'status.json', {**status, 'phase': phase})
        deployment.run('docker', 'build', '-f', str(source / 'deploy/ocr/Dockerfile'),
                       '-t', 'dfragon-ocr:' + commit, str(source))
        image = deployment.run('docker', 'image', 'inspect', '--format', '{{.Id}}', 'dfragon-ocr:' + commit)
        if deployment.run('git', 'ls-remote', deployment.REPOSITORY, 'refs/heads/main').split()[0] != commit:
            raise RuntimeError('main advanced during build; use latest successful CI')
        if (deployment.container('ocr')['Id'] != before['Id']
                or environment.read_text() != original_environment):
            raise RuntimeError('OCR service or settings changed independently')
        if shutil.disk_usage(deployment.STATE).free < database.stat().st_size + 5 * 1024**3:
            raise RuntimeError('insufficient backup disk reserve')
        phase = 'backup-ocr-splits'
        deployment.save(deployment.STATE / 'status.json', {**status, 'phase': phase})
        stopped = True
        deployment.compose('ocr', Path(old['source']), 'stop', 'ocr')
        stopped_state = deployment.run('docker', 'inspect', '--format',
                                      '{{.State.Running}} {{.State.ExitCode}} {{.State.OOMKilled}}', before['Id'])
        if stopped_state != 'false 0 false':
            raise RuntimeError('OCR did not stop cleanly')
        baseline = backup_database(database)
        phase = 'migrate-ocr-splits'
        deployment.save(deployment.STATE / 'status.json', {**status, 'phase': phase})
        safe_to_restart = False
        initialize_split_tables(image, database)
        if inspect_database(database, require_added=True) != baseline:
            raise RuntimeError('existing OCR data changed during migration')
        if environment.read_text() != original_environment:
            raise RuntimeError('OCR settings changed during migration; operator inspection required')
        safe_to_restart = True
        phase = 'activate-ocr'
        deployment.save(deployment.STATE / 'status.json', {**status, 'phase': phase})
        deployment.write_text(environment, deployment.tagged_environment(original_environment, commit))
        deployment.compose('ocr', source, 'up', '-d', '--no-build', '--no-deps', 'ocr')
        deployment.ready('ocr')
        deployed = deployment.container('ocr')
        if deployed['Config']['Image'] != 'dfragon-ocr:' + commit or deployed['Image'] != image:
            raise RuntimeError('deployed OCR image differs')
        result = {**previous, 'ocr': {'revision': commit, 'source': str(source)}}
        deployment.save(deployment.STATE / 'previous.json', previous)
        deployment.save(deployment.STATE / 'state.json', result)
        deployment.save(deployment.STATE / 'status.json', {
            **status, 'status': 'succeeded', 'phase': 'complete', 'changed': ['ocr'], 'backup': True})
    except Exception:
        restored = not stopped
        if stopped and safe_to_restart:
            try:
                old_image = deployment.run('docker', 'image', 'inspect', '--format', '{{.Id}}', before['Config']['Image'])
                if old_image != before['Image']:
                    raise RuntimeError('previous OCR image changed')
                deployment.write_text(environment, original_environment)
                deployment.compose('ocr', Path(old['source']), 'up', '-d', '--no-build', '--no-deps', 'ocr')
                deployment.ready('ocr')
                deployment.save(deployment.STATE / 'state.json', previous)
                restored = True
            except Exception:
                restored = False
        deployment.save(deployment.STATE / 'status.json', {
            **status, 'status': 'failed', 'phase': phase, 'restored': restored})
        raise


def main():
    if os.geteuid() != 0 or len(sys.argv) != 2:
        raise RuntimeError('usage: sudo python3 -I deploy/linux/upgrade_ocr_splits.py COMMIT')
    commit = deployment.revision(sys.argv[1])
    os.umask(0o077)
    os.environ.clear()
    os.environ.update(PATH='/usr/sbin:/usr/bin:/sbin:/bin', HOME='/root', LANG='C.UTF-8')
    with open('/run/lock/dfragon-deploy.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        upgrade(commit)
    print('OCR split rollout finished; inspect dfragon-deploy status before resuming automatic deployment')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('OCR split rollout failed; inspect deployment status and the protected backup before retrying', file=sys.stderr)
        sys.exit(1)
