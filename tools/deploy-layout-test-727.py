"""Publish the locally verified layout release to TEST only, without GitHub changes."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import importlib.util
import subprocess

ROOT = Path(__file__).resolve().parents[1]
if subprocess.check_output(['git', 'diff', 'HEAD', '--', '_client/src', 'server'], cwd=ROOT):
    raise RuntimeError('This layout-only publisher requires unchanged game source and PHP')
spec = importlib.util.spec_from_file_location('release', ROOT / 'tools/release-session-715.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
release.VERSION = 727
release.BASES = ['/var/www/stalker-test']
release.BACKUP = '/var/backups/pripyat-test-layout-727-' + datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
release.FILES = []
for prefix in ['client/ver0_41', 'client/ver0_41/development']:
    release.FILES.extend([
        ('_client/development/libs/index.js', prefix + '/libs/index.js'),
        ('_client/development/index.html', prefix + '/index.html'),
    ])
protected = 'sha256sum /var/www/stalker/client/ver0_41/index.html /var/www/stalker/client/ver0_41/libs/index.js /var/www/stalker/client/ver0_41/development/index.html /var/www/stalker/client/ver0_41/development/libs/index.js /var/www/stalker/server/core/models/registry.php /var/www/stalker-test/server/core/models/registry.php'
client = release.connect()
try:
    before = release.command(client, protected)
finally:
    client.close()
release.main()
client = release.connect()
try:
    assert release.command(client, protected) == before, 'Protected files changed'
    if '--apply' in __import__('sys').argv:
        with client.open_sftp() as sftp:
            for local, remote in release.FILES:
                expected = hashlib.sha256((ROOT / local).read_bytes()).digest()
                with sftp.open('/var/www/stalker-test/' + remote, 'rb') as stream:
                    assert hashlib.sha256(stream.read()).digest() == expected
        for prefix in ['client/ver0_41', 'client/ver0_41/development']:
            html = release.command(client, 'curl -fsS https://test-pripyat-game.ru/' + prefix + '/index.html')
            assert 'index.js?v=727' in html
        print('TEST v727 verified; PROD client and both private configs unchanged')
finally:
    client.close()
