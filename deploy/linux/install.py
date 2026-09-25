#!/usr/bin/python3 -I
"""One-time operator setup. Run from a reviewed, merged checkout with a public key."""
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('deployment', HERE / 'deploy.py')
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)


def main():
    if os.geteuid() != 0 or len(sys.argv) != 2:
        raise RuntimeError('usage: sudo python3 install.py /path/to/deployment-key.pub')
    os.umask(0o077)
    public_key = Path(sys.argv[1]).read_text().strip()
    if re.fullmatch(r'ssh-ed25519 [A-Za-z0-9+/]+={0,3}(?: [^\r\n]+)?', public_key) is None:
        raise RuntimeError('expected an Ed25519 public key')
    for path in (deployment.STATE, Path('/etc/dfragon/api.env'), Path('/opt/dfragon-api-current'),
                 Path('/var/lib/dfragon-deploy-user'), Path(deployment.EXECUTABLE),
                 Path('/usr/local/libexec/dfragon-deploy-ssh'), Path('/etc/sudoers.d/dfragon-deploy'),
                 Path('/etc/systemd/system/dfragon-auth-cleanup.service.d/deployment.conf')):
        if path.exists() or path.is_symlink():
            raise RuntimeError('deployment setup already exists; inspect before changing')
    try:
        pwd.getpwnam('dfragon-deploy')
    except KeyError:
        pass
    else:
        raise RuntimeError('deployment user already exists')
    preferences = json.loads(deployment.run('tailscale', 'debug', 'prefs'))
    status = json.loads(deployment.run('tailscale', 'status', '--json'))
    if preferences.get('RunSSH') or status.get('BackendState') != 'Running':
        raise RuntimeError('connected Tailscale with OpenSSH is required')
    sources = {}
    for service in ('api', 'ocr'):
        info = deployment.container(service)
        image = info['Config']['Image']
        match = re.fullmatch('dfragon-' + service + r':([0-9a-f]{40})', image)
        if match is None:
            raise RuntimeError('unexpected running image')
        compose_path = Path(info['Config']['Labels']['com.docker.compose.project.config_files'])
        source = compose_path.parents[2]
        if compose_path != source / f'deploy/{service}/compose.yaml':
            raise RuntimeError('unexpected compose source')
        sources[service] = {'source': str(source), 'revision': match[1]}
    api_env = Path(sources['api']['source']) / 'deploy/api/.env'
    for service, path in [('api', api_env), ('ocr', deployment.environment_file('ocr'))]:
        text = path.read_text()
        if deployment.tagged_environment(text, sources[service]['revision']) != text:
            raise RuntimeError('running service and environment revision differ')
    # Prepare a root-owned home: the SSH account cannot replace its key restrictions or helper.
    deployment.run('useradd', '--system', '--home-dir', '/var/lib/dfragon-deploy-user', '--shell', '/bin/sh', 'dfragon-deploy')
    home = Path('/var/lib/dfragon-deploy-user')
    home.mkdir(mode=0o755)
    home.chmod(0o755)
    ssh = home / '.ssh'
    ssh.mkdir(mode=0o755)
    ssh.chmod(0o755)
    key = ssh / 'authorized_keys'
    key.write_text('restrict,command="/usr/local/libexec/dfragon-deploy-ssh" ' + public_key + '\n')
    key.chmod(0o644)
    libexec = Path('/usr/local/libexec')
    if not libexec.exists():
        libexec.mkdir(mode=0o755)
        libexec.chmod(0o755)
    shutil.copyfile(HERE / 'ssh-command.sh', '/usr/local/libexec/dfragon-deploy-ssh')
    Path('/usr/local/libexec/dfragon-deploy-ssh').chmod(0o755)
    shutil.copyfile(HERE / 'deploy.py', deployment.EXECUTABLE)
    Path(deployment.EXECUTABLE).chmod(0o755)
    sudoers = Path('/etc/sudoers.d/dfragon-deploy')
    sudoers.write_text('dfragon-deploy ALL=(root) NOPASSWD: /usr/local/sbin/dfragon-deploy\n')
    sudoers.chmod(0o440)
    deployment.run('visudo', '-cf', str(sudoers))
    deployment.STATE.mkdir(mode=0o700)
    deployment.save(deployment.STATE / 'state.json', sources)
    shutil.copyfile(api_env, '/etc/dfragon/api.env')
    Path('/etc/dfragon/api.env').chmod(0o600)
    deployment.point_api_source(Path(sources['api']['source']))
    drop_in = Path('/etc/systemd/system/dfragon-auth-cleanup.service.d')
    drop_in.mkdir(mode=0o755, exist_ok=True)
    target = drop_in / 'deployment.conf'
    target.write_text('[Service]\nWorkingDirectory=/opt/dfragon-api-current/deploy/api\nExecStart=\nExecStart=/usr/bin/docker compose --project-name dfragon --env-file /etc/dfragon/api.env -f /opt/dfragon-api-current/deploy/api/compose.yaml --profile maintenance run --rm --no-deps cleanup\n')
    target.chmod(0o644)
    deployment.run('systemctl', 'daemon-reload')
    print('Deployment SSH helper installed; API and OCR containers were not restarted')
    print(json.dumps({'services': {service: data['revision'] for service, data in sources.items()}}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Deployment setup failed; inspect the operator setup before retrying', file=sys.stderr)
        sys.exit(1)
