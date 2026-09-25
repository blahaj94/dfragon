#!/usr/bin/python3 -I
"""Root-owned, fixed-repository deployment entry point for the restricted SSH key."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request

REPOSITORY = 'https://github.com/blahaj94/dfragon.git'
STATE = Path('/var/lib/dfragon-deploy')
RELEASES = Path('/opt/dfragon-releases')
EXECUTABLE = '/usr/local/sbin/dfragon-deploy'
SHARED_INPUTS = ('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'packages/ui', 'packages/licenses')


def run(*args, timeout=1200):
    result = subprocess.run(args, capture_output=True, timeout=timeout)
    if result.returncode:
        # Command output can contain configuration; never forward it to Actions or the journal.
        raise RuntimeError('command failed')
    return result.stdout.decode().strip()


def save(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value) + '\n')
    temporary.chmod(0o600)
    temporary.replace(path)


def write_text(path, text):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(text)
    temporary.chmod(0o600)
    temporary.replace(path)


def revision(value):
    if re.fullmatch(r'[0-9a-f]{40}', value) is None:
        raise ValueError('a full commit SHA is required')
    return value


def fingerprint(source, paths):
    digest = hashlib.sha256()
    for name in paths:
        root = source / name
        files = sorted(root.rglob('*')) if root.is_dir() else [root]
        for path in files:
            if any(part in ('node_modules', 'dist', '__pycache__', '.git') or part.startswith('.env') for part in path.relative_to(source).parts):
                continue
            if path.is_file() and path.suffix != '.md':
                digest.update(str(path.relative_to(source)).encode() + b'\0')
                digest.update(path.read_bytes())
    return digest.digest()


def changed_services(previous, source):
    changed = []
    for service in ('api', 'ocr'):
        inputs = (*SHARED_INPUTS, f'apps/{service}', f'deploy/{service}')
        if fingerprint(Path(previous[service]['source']), inputs) != fingerprint(source, inputs):
            changed.append(service)
    return changed


def require_compatible(previous, source, services):
    # Changes to storage and container topology require an explicit operator migration.
    for service in services:
        paths = [f'deploy/{service}/compose.yaml']
        if service == 'api':
            paths += ['apps/api/src/database', 'deploy/api/init-database.sh',
                      'deploy/api/grant-api.sql', 'deploy/api/migrate-legacy.sql',
                      'deploy/api/dfragon-auth-cleanup.service', 'deploy/api/dfragon-auth-cleanup.timer']
        else:
            paths += ['apps/ocr/src/store.ts']
        if fingerprint(Path(previous[service]['source']), paths) != fingerprint(source, paths):
            raise RuntimeError('storage or topology changed; operator migration required')


def environment_file(service):
    return Path('/etc/dfragon') / (service + '.env')


def tagged_environment(text, commit):
    if len(re.findall(r'^DFRAGON_IMAGE_TAG=.*$', text, flags=re.M)) != 1:
        raise RuntimeError('expected one release tag in environment')
    return re.sub(r'^DFRAGON_IMAGE_TAG=.*$', 'DFRAGON_IMAGE_TAG=' + commit, text, flags=re.M)


def compose(service, source, *args):
    return run('docker', 'compose', '--project-name', 'dfragon' if service == 'api' else 'dfragon-ocr',
               '--env-file', str(environment_file(service)), '-f', str(source / f'deploy/{service}/compose.yaml'), *args)


def container(service):
    project = 'dfragon' if service == 'api' else 'dfragon-ocr'
    ids = run('docker', 'ps', '-q', '--filter', 'label=com.docker.compose.project=' + project,
              '--filter', 'label=com.docker.compose.service=' + service).split()
    if len(ids) != 1:
        raise RuntimeError('expected one running service')
    return json.loads(run('docker', 'inspect', ids[0]))[0]


def ready(service):
    url, expected = ('http://127.0.0.1:3000/me', 401) if service == 'api' else ('http://127.0.0.1:3100/health', 200)
    for _ in range(60):
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                code = response.status
        except urllib.error.HTTPError as error:
            code = error.code
        except (OSError, urllib.error.URLError):
            code = 0
        if code == expected:
            return
        time.sleep(1)
    raise RuntimeError('service readiness failed')


def fetch_source(commit):
    request = urllib.request.Request(
        'https://api.github.com/repos/blahaj94/dfragon/actions/workflows/code-quality.yml/runs?'
        + 'event=push&status=success&per_page=10&head_sha=' + commit,
        headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'dfragon-deploy'})
    with urllib.request.urlopen(request, timeout=30) as response:
        runs = json.load(response)['workflow_runs']
    if not any(item['head_sha'] == commit and item['head_branch'] == 'main'
               and item['event'] == 'push' and item['conclusion'] == 'success'
               and item['head_repository']['full_name'] == 'blahaj94/dfragon' for item in runs):
        raise RuntimeError('successful main CI is required')
    repository = STATE / 'repository.git'
    if not repository.exists():
        run('git', 'init', '--bare', str(repository))
        run('git', '-C', str(repository), 'remote', 'add', 'origin', REPOSITORY)
    if run('git', '-C', str(repository), 'remote', 'get-url', 'origin') != REPOSITORY:
        raise RuntimeError('repository origin changed')
    run('git', '-C', str(repository), 'fetch', '--depth=1', 'origin', 'refs/heads/main')
    if run('git', '-C', str(repository), 'rev-parse', 'FETCH_HEAD') != commit:
        raise RuntimeError('requested commit is no longer main; run latest successful CI')
    source = RELEASES / commit
    if not source.exists():
        RELEASES.mkdir(mode=0o700, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=RELEASES) as temporary:
            archive = Path(temporary) / 'source.tar'
            run('git', '-C', str(repository), 'archive', '--format=tar', '--output=' + str(archive), commit)
            extracted = Path(temporary) / 'source'
            extracted.mkdir(mode=0o700)
            with tarfile.open(archive) as content:
                content.extractall(extracted, filter='data')
            write_text(extracted / 'RELEASE_COMMIT', commit + '\n')
            extracted.rename(source)
    if (source / 'RELEASE_COMMIT').read_text().strip() != commit:
        raise RuntimeError('release directory mismatch')
    return source


def point_api_source(source):
    link = Path('/opt/dfragon-api-current')
    temporary = link.with_suffix('.tmp')
    if temporary.is_symlink():
        temporary.unlink()
    temporary.symlink_to(source, target_is_directory=True)
    temporary.replace(link)


def apply(commit):
    revision(commit)
    with open('/run/lock/dfragon-deploy.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        deploy_release(commit)


def deploy_release(commit):
    previous = json.loads((STATE / 'state.json').read_text())
    phase = 'prepare'
    changed = []
    activated = []
    old_environments = {}
    before = {}
    cleanup_was_active = False
    status = {'revision': commit, 'status': 'running', 'phase': phase}
    save(STATE / 'status.json', status)
    try:
        source = fetch_source(commit)
        changed = changed_services(previous, source)
        phase = 'verify-compatibility'
        require_compatible(previous, source, changed)
        if changed and shutil.disk_usage(RELEASES).free < 5 * 1024**3:
            raise RuntimeError('insufficient disk reserve')
        for service in changed:
            before[service] = container(service)
            if before[service]['Config']['Image'] != 'dfragon-' + service + ':' + previous[service]['revision']:
                raise RuntimeError('running release changed independently')
            old_environments[service] = environment_file(service).read_text()
            if tagged_environment(old_environments[service], previous[service]['revision']) != old_environments[service]:
                raise RuntimeError('environment release changed independently')
            phase = 'build-' + service
            save(STATE / 'status.json', {**status, 'phase': phase})
            run('docker', 'build', '-f', str(source / f'deploy/{service}/Dockerfile'),
                '-t', 'dfragon-' + service + ':' + commit, str(source))
        # An older build must not replace a newer merged commit while CI is queued.
        if run('git', 'ls-remote', REPOSITORY, 'refs/heads/main').split()[0] != commit:
            raise RuntimeError('main advanced during build; run latest successful CI')
        if 'api' in changed:
            phase = 'wait-cleanup'
            save(STATE / 'status.json', {**status, 'phase': phase})
            cleanup_was_active = subprocess.run(['systemctl', 'is-active', '--quiet', 'dfragon-auth-cleanup.timer']).returncode == 0
            run('systemctl', 'stop', 'dfragon-auth-cleanup.timer')
            for _ in range(900):
                if subprocess.run(['systemctl', 'is-active', '--quiet', 'dfragon-auth-cleanup.service']).returncode != 0:
                    break
                time.sleep(1)
            else:
                raise RuntimeError('cleanup is still running')
        result = dict(previous)
        for service in changed:
            if container(service)['Id'] != before[service]['Id'] or environment_file(service).read_text() != old_environments[service]:
                raise RuntimeError('service or settings changed independently')
            phase = 'activate-' + service
            save(STATE / 'status.json', {**status, 'phase': phase})
            activated.append(service)
            write_text(environment_file(service), tagged_environment(old_environments[service], commit))
            compose(service, source, 'up', '-d', '--no-build', '--no-deps', service)
            ready(service)
            if container(service)['Config']['Image'] != 'dfragon-' + service + ':' + commit:
                raise RuntimeError('deployed image differs')
            result[service] = {'revision': commit, 'source': str(source)}
        if 'api' in changed:
            point_api_source(source)
        if changed:
            save(STATE / 'previous.json', previous)
        save(STATE / 'state.json', result)
        if cleanup_was_active:
            run('systemctl', 'start', 'dfragon-auth-cleanup.timer')
            cleanup_was_active = False
        save(STATE / 'status.json', {**status, 'status': 'succeeded', 'phase': 'complete', 'changed': changed})
    except Exception:
        restored = True
        for service in reversed(activated):
            try:
                phase = 'restore-' + service
                old_image = run('docker', 'image', 'inspect', '--format', '{{.Id}}', before[service]['Config']['Image'])
                if old_image != before[service]['Image']:
                    raise RuntimeError('previous image was changed')
                write_text(environment_file(service), old_environments[service])
                compose(service, Path(previous[service]['source']), 'up', '-d', '--no-build', '--no-deps', service)
                ready(service)
            except Exception:
                restored = False
        if 'api' in activated:
            try:
                point_api_source(Path(previous['api']['source']))
            except Exception:
                restored = False
        if restored:
            save(STATE / 'state.json', previous)
        save(STATE / 'status.json', {**status, 'status': 'failed', 'phase': phase, 'restored': restored})
        raise
    finally:
        if cleanup_was_active:
            run('systemctl', 'start', 'dfragon-auth-cleanup.timer')


def main():
    if os.geteuid() != 0:
        raise RuntimeError('root deployment helper required')
    os.umask(0o077)
    os.environ.clear()
    os.environ.update(PATH='/usr/sbin:/usr/bin:/sbin:/bin', HOME='/root', LANG='C.UTF-8')
    args = sys.argv[1:]
    if len(args) == 2 and args[0] == '--apply':
        apply(revision(args[1]))
    elif len(args) == 1 and args[0] == 'status':
        state = json.loads((STATE / 'state.json').read_text())
        status = json.loads((STATE / 'status.json').read_text()) if (STATE / 'status.json').exists() else {}
        print(json.dumps({'services': {s: state[s]['revision'] for s in ('api','ocr')}, 'deployment': status}))
    elif len(args) == 1 and re.fullmatch(r'deploy [0-9a-f]{40}', args[0]):
        commit = args[0].split()[1]
        run('systemd-run', '--quiet', '--wait', '--collect', '--unit=dfragon-deploy',
            '--property=RuntimeMaxSec=35min', '--property=TimeoutStopSec=120s',
            EXECUTABLE, '--apply', commit, timeout=2400)
        print('Deployment finished; use status to inspect service revisions')
    else:
        raise ValueError('only deploy SHA or status is accepted')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Deployment failed; inspect dfragon-deploy status on the server', file=sys.stderr)
        sys.exit(1)
