"""Publish the reviewed session changes to test and production, with verified backups.
No registry upload, credentials, migrations or player-data writes.
Run without arguments for a read-only plan, --apply to publish.
"""
from pathlib import Path
import hashlib
import json
import shlex
import sys

ROOT = Path(__file__).resolve().parents[1]
VERSION = 715
sys.path.insert(0, str(ROOT / '.deploy_deps'))
import paramiko

SERVER_FILES = [
    'server/core/models/database.php',
    'server/core/controllers/security.php',
    'server/core/controllers/users.php',
    'server/core/controllers/event.php',
    'server/core/controllers/bosses.php',
    'server/core/controllers/game2048.php',
    'server/core/controllers/raznaryadka.php',
    'server/core/controllers/zanachki.php',
    'server/dev_energy.php',
    'server/universal.php',
]
FILES = [(name, name) for name in SERVER_FILES]
for prefix in ['client/ver0_41', 'client/ver0_41/development']:
    FILES += [('_client/development/libs/index.js', prefix + '/libs/index.js'),
              ('_client/development/index.html', prefix + '/index.html')]
BASES = ['/var/www/stalker-test', '/var/www/stalker']
BACKUP = '/var/backups/pripyat-session-v715-20261030-request-key'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def command(client, code):
    _, out, err = client.exec_command(code, timeout=60)
    result = out.read().decode('utf-8', 'replace')
    error = err.read().decode('utf-8', 'replace')
    if out.channel.recv_exit_status() != 0:
        raise RuntimeError(code.split()[0] + ': ' + error + result)
    return result

def connect():
    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    client.connect('155.212.211.202', username='root',
                   key_filename=str(Path.home() / '.ssh/id_ed25519_stalker'), timeout=20)
    return client

def main():
    apply = sys.argv[1:] == ['--apply']
    if sys.argv[1:] not in [[], ['--apply']]:
        raise ValueError('Use no arguments or --apply')
    html = (ROOT / '_client/development/index.html').read_text(encoding='utf-8')
    if ('index.js?v=' + str(VERSION)) not in html:
        raise RuntimeError('Unexpected HTML version')
    client = connect()
    changed = []
    try:
        print('MODE:', 'APPLY' if apply else 'PLAN', flush=True)
        if apply:
            command(client, 'mkdir -p ' + shlex.quote(BACKUP) + ' && chmod 700 ' + shlex.quote(BACKUP))
        with client.open_sftp() as sftp:
            staged = []
            for base in BASES:
                for local, relative in FILES:
                    data = (ROOT / local).read_bytes()
                    target = base + '/' + relative
                    try:
                        with sftp.open(target, 'rb') as source:
                            previous = source.read()
                    except FileNotFoundError:
                        previous = None
                    print(json.dumps({'path': target, 'changed': previous != data, 'sha256': sha(data)}, ensure_ascii=False), flush=True)
                    if not apply or previous == data:
                        continue
                    backup = BACKUP + '/' + target.strip('/').replace('/', '_')
                    try:
                        sftp.stat(backup)
                        raise RuntimeError('Backup already exists: ' + backup)
                    except FileNotFoundError:
                        pass
                    if previous is not None:
                        with sftp.open(backup, 'wb') as dest:
                            dest.write(previous)
                        with sftp.open(backup, 'rb') as dest:
                            if sha(dest.read()) != sha(previous):
                                raise RuntimeError('Backup verification failed')
                    pending = target + '.v' + str(VERSION) + '.pending'
                    with sftp.open(pending, 'wb') as dest:
                        dest.write(data)
                    with sftp.open(pending, 'rb') as dest:
                        if sha(dest.read()) != sha(data):
                            raise RuntimeError('Staged SHA256 mismatch')
                    if relative.endswith('.php'):
                        command(client, 'php -l ' + shlex.quote(pending))
                    staged.append((target, pending, backup, data, previous))
            # All PHP and hashes checked before the first public file is replaced.
            try:
                for target, pending, backup, data, previous in staged:
                    sftp.posix_rename(pending, target)
                    changed.append((target, backup, previous))
                    with sftp.open(target, 'rb') as source:
                        if sha(source.read()) != sha(data):
                            raise RuntimeError('Published SHA256 mismatch: ' + target)
                if apply and any(relative.endswith('.php') for _, relative in FILES):
                    print(command(client, 'systemctl restart php8.5-fpm && systemctl is-active php8.5-fpm'), flush=True)
            except Exception:
                for target, backup, previous in reversed(changed):
                    if previous is not None:
                        with sftp.open(target + '.rollback.pending', 'wb') as dest:
                            dest.write(previous)
                        sftp.posix_rename(target + '.rollback.pending', target)
                if any(relative.endswith('.php') for _, relative in FILES):
                    command(client, 'systemctl restart php8.5-fpm')
                raise
        print('Verified files:', len(FILES) * len(BASES), '| replaced:', len(changed), flush=True)
    finally:
        client.close()

if __name__ == '__main__':
    main()
