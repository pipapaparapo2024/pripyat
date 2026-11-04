"""Prepare isolated, disabled Telegram TEST files. No DB, DNS, nginx reload or legacy edits."""
from pathlib import Path
import importlib.util, json, sys

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release', ROOT/'tools/release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
if sys.argv[1:] not in ([], ['--apply']):
    raise SystemExit('Use no arguments or --apply')
files = {
    '/var/www/stalker-tg-test/public/index.html': '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Припять — Telegram TEST</title><h1>Telegram TEST</h1><p>Окружение подготовлено. Вход ещё не включён.</p></html>\n',
    '/etc/pripyat/telegram-test.php': (ROOT/'docs/telegram-config.example.php').read_text(encoding='utf-8'),
    '/var/www/stalker-tg-test/config/nginx-http.conf': '''# Prepared only. NOT included in nginx configuration. HTTPS follows DNS setup.
server {
    listen 80;
    server_name tg-test-pripyat-game.ru;
    root /var/www/stalker-tg-test/public;
    index index.html;
    access_log /var/log/nginx/pripyat-tg-test-access.log;
    error_log /var/log/nginx/pripyat-tg-test-error.log;
    location / { try_files $uri $uri/ =404; }
    # PHP execution is deliberately disabled until the dedicated pool is configured.
    location ~ \\.php$ { return 503; }
    location ~ /\\. { deny all; }
}
''',
    '/var/www/stalker-tg-test/config/README.txt': '''Telegram TEST only. Domain: tg-test-pripyat-game.ru
No database created. No game deployed. No nginx site enabled.
Private bot token: /etc/pripyat/telegram-test.php (root-only, disabled).
Future dedicated PHP pool: PRIPYAT_TELEGRAM_CONFIG=/etc/pripyat/telegram-test.php
Review permissions for dedicated pool before enabling. Never copy legacy registry.php.
''',
}
code = '''import pathlib,json,hashlib
files=FILES
apply=APPLY
protected=[pathlib.Path(p) for p in ['/var/www/stalker/server/core/models/registry.php','/var/www/stalker-test/server/core/models/registry.php']]
sha=lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before={str(p):sha(p) for p in protected}
for name,content in files.items():
    p=pathlib.Path(name)
    assert str(p).startswith('/var/www/stalker-tg-test/') or str(p)=='/etc/pripyat/telegram-test.php'
    assert not p.is_symlink()
    if p.exists():
        # Never overwrite an operator's private configuration or an existing deployment.
        print(json.dumps({'path':name,'action':'preserved'}))
        continue
    print(json.dumps({'path':name,'action':'create' if apply else 'planned'}))
    if apply:
        p.parent.mkdir(parents=True,exist_ok=True)
        if name.startswith('/etc/pripyat/'):
            p.parent.chmod(0o700)
        with p.open('x',encoding='utf-8') as f:f.write(content)
        p.chmod(0o600 if name.startswith('/etc/pripyat/') else 0o644)
assert all(sha(pathlib.Path(p))==digest for p,digest in before.items())
print('Telegram TEST files prepared; legacy private configs verified unchanged; no DB operations')
'''.replace('FILES',repr(files)).replace('APPLY',repr(sys.argv[1:]==['--apply']))
client=release.connect()
try:
    print(release.run_remote_python(client,code))
finally:
    client.close()
