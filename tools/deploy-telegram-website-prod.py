"""Deploy only Telegram website PROD, with backups and rollback on failed checks."""
import argparse
import base64
import hashlib
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def payload():
    files = {}
    for name in ('telegramprodhttp', 'telegramwebsitepayments', 'sitepayments',
                 'siteyookassa', 'sitesessions', 'sitereceipthistory'):
        files[f'telegram-website-prod/app/{name}.php'] = ROOT / f'website/app/{name}.php'
    for name in ('telegramauth', 'telegramenvironment', 'telegramloginstore',
                 'telegramplayerlock', 'telegramoidc', 'gameaccesspolicy', 'rewardlinktargets'):
        files[f'telegram-website-prod/app/{name}.php'] = ROOT / f'server/core/models/{name}.php'
    files['telegram-website-prod/server/core/models/erasedaccounts.php'] = ROOT / 'server/core/models/erasedaccounts.php'
    files['telegram-website-prod/server/json/site_prices.json'] = ROOT / 'server/json/site_prices.json'
    for name, source in {
        'app/sitepayments.php': 'website/app/sitepayments.php',
        'server/site-payments-webhook.php': 'server/site-payments-webhook.php',
        'public/login.js': 'website/login.js',
        'public/payment/receipts.js': 'website/payment/receipts.js',
        'public/telegram-payment-return.html': 'website/telegram-payment-return.html',
    }.items():
        files[name] = ROOT / source
    scripts = sorted((ROOT / '_client/website-build/libs').glob('*.js'))
    entry = ROOT / '_client/website-build/libs/index.js'
    if entry not in scripts or b'/auth/telegram-prod' not in entry.read_bytes():
        raise RuntimeError('Сначала выполните npm run build:website')
    version = hashlib.sha256(b''.join(hashlib.sha256(p.read_bytes()).digest() for p in scripts)).hexdigest()[:16]
    for path in scripts:
        files[f'game-libs/telegram-website-{version}/{path.name}'] = path
    button = re.search(r'<button data-provider="telegram".*?</button>',
                       (ROOT / 'website/index.html').read_text(encoding='utf-8')).group()
    worker = (ROOT / 'tools/site-npd-receipts.php').read_bytes()
    return {k: base64.b64encode(v.read_bytes()).decode() for k, v in files.items()}, version, button, base64.b64encode(worker).decode()


REMOTE = r"""
import base64, hashlib, json, os, pathlib, pwd, re, subprocess, tempfile, time, urllib.error, urllib.parse, urllib.request
P = pathlib.Path
site = P('/var/www/pripyat-site')
nginx = P('/etc/nginx/sites-available/pripyat-site')
pools = P('/etc/php/8.5/fpm/pool.d')
legacy_pool = pools / 'pripyat-site-test.conf'
prod_pool = pools / 'pripyat-telegram-website-prod.conf'
oidc = P('/etc/pripyat/website-auth-prod.json')
payment = P('/etc/pripyat/telegram-website-payment-prod.json')
worker = P('/usr/local/sbin/pripyat-npdcheck')
worker_unit = P('/etc/systemd/system/pripyat-npdcheck.service.d/telegram-website.conf')
state = P('/var/lib/pripyat-telegram-website')
prod = pwd.getpwnam('pripyat-tg-prod')
legacy = pwd.getpwnam('pripyat-site-test')
host = 'https://pripyat-game-site.ru'

def run(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError('Ошибка команды ' + ' '.join(args[:3]))
    return result.stdout

def replace_once(value, old, new):
    if value.count(old) != 1:
        raise RuntimeError('Неожиданная конфигурация: ' + old)
    return value.replace(old, new, 1)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None

client = urllib.request.build_opener(NoRedirect())

def request(url, data=None):
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        response = client.open(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.code, response.headers, response.read()

def check_oauth():
    code, headers, _ = request(host + '/auth/telegram-prod/start')
    target = urllib.parse.urlsplit(headers.get('Location', ''))
    params = urllib.parse.parse_qs(target.query)
    if (code != 302 or (target.scheme, target.netloc, target.path) != ('https', 'oauth.telegram.org', '/auth')
            or params.get('redirect_uri') != [host + '/auth/telegram-prod/callback']
            or params.get('code_challenge_method') != ['S256']):
        raise RuntimeError('Сайт вернул неверный редирект Telegram OAuth')
    response = run('curl','--compressed','--noproxy','*','--silent','--max-time','12',
                   '--connect-to','oauth.telegram.org:443:127.0.0.1:10444',
                   '--write-out','\n%{http_code} %{content_type}',target.geturl())
    body, _, metadata = response.rpartition('\n')
    if 'redirect_uri required' in body.lower():
        raise RuntimeError('Telegram ответил redirect_uri required. Проверьте точный callback в BotFather → Login Widget → Allowed URLs.')
    if not metadata.startswith('200 text/html') or len(body) < 200:
        raise RuntimeError(f'Telegram не вернул страницу входа: HTTP {metadata.split()[0]}')

if OAUTH_ONLY:
    check_oauth()
    print('Telegram вернул страницу входа.')
    raise SystemExit(0)

def legacy_checks():
    paths = [host + '/', host + '/game/', host + '/payment/', host + '/account/',
             host + '/auth/status',
             'https://pripyat-game.ru/client/ver0_41/']
    result = []
    for url in paths:
        code, headers, body = request(url)
        if code not in (200, 301, 302, 303):
            raise RuntimeError(f'{url}: HTTP {code}')
        providers = json.loads(body)['providers'] if url.endswith('/auth/status') else None
        if providers is not None and not all(providers.get(key) for key in ('site','vk','ok')):
            raise RuntimeError('Недоступен существующий способ входа')
        result.append((code, providers))
    code, _, _ = request(host + '/server/site-payments-webhook.php', b'{}')
    if code != 200:
        raise RuntimeError(f'Общий webhook: HTTP {code}')
    return result

config = json.loads(oidc.read_text())
runtime = json.loads((site/'private/site-runtime.json').read_text())
assert config['environment'] == 'prod' and config['database'] == 'stalker_telegram'
assert config['oidc']['redirect_uri'] == host + '/auth/telegram-prod/callback'
assert config['oidc']['client_id'] == config['bot_token'].split(':', 1)[0]
assert len(config['oidc']['client_secret']) >= 16
pay = config['website_rub_payments']
assert pay['require_test_payment'] is False and pay['live_checkout_enabled'] is True
assert all(str(pay[k]) == str(runtime['payments'][k]) for k in ('shop_id','secret_key'))
assert not prod_pool.exists() and not payment.exists() and not state.exists()
run('runuser','-u',prod.pw_name,'--','test','-r',str(oidc))
assert json.loads(run('curl','--compressed','--noproxy','*','--fail','--silent','--max-time','12','--connect-to',
    'oauth.telegram.org:443:127.0.0.1:10444','https://oauth.telegram.org/.well-known/jwks.json'))['keys']
before = legacy_checks()

changes = {site/name: base64.b64decode(data) for name,data in FILES.items()}
changes[worker] = base64.b64decode(WORKER)
home = (site/'public/index.html').read_text()
home = replace_once(home, '<button data-provider="site"', BUTTON + '<button data-provider="site"')
home, count = re.subn(r'/login\.js\?v=[^"]+', '/login.js?v=telegram-prod-' + VERSION, home)
assert count == 1
changes[site/'public/index.html'] = home.encode()
receipt_page = site/'public/payment/index.html'
changes[receipt_page] = replace_once(receipt_page.read_text(), '/payment/receipts.js?v=1',
                                    '/payment/receipts.js?v=telegram-prod-' + VERSION).encode()
game, count = re.subn(r'(?<=src="\./libs/)index\.js\?v=[^"]+', 'telegram-website-' + VERSION + '/index.js',
                      (site/'game/index.html').read_text())
assert count == 1
changes[site/'game/telegram.html'] = game.encode()
route = '''
 location ~ ^/auth/telegram-prod/(status|start|callback|bootstrap|logout|receipts|payment-create|payment-status)$ {
  access_log off;
  add_header Referrer-Policy no-referrer always;
  include fastcgi_params;
  fastcgi_param SCRIPT_FILENAME /var/www/pripyat-site/telegram-website-prod/app/telegramprodhttp.php;
  fastcgi_pass unix:/run/php/php8.5-fpm-telegram-website-prod.sock;
 }
 location = /game/telegram.html { alias /var/www/pripyat-site/game/telegram.html; }
'''
marker = ' location = /game/index.html {'
changes[nginx] = replace_once(nginx.read_text(), marker, route + marker).encode()
pool = legacy_pool.read_text()
assert 'PRIPYAT_TELEGRAM_WEBSITE_PAYMENT_CONFIG' not in pool
pool, count = re.subn(r'(?m)^(php_admin_value\[open_basedir\].*)$', r'\1:' + str(payment), pool)
assert count == 1
changes[legacy_pool] = (pool.rstrip() + '\nenv[PRIPYAT_TELEGRAM_WEBSITE_PAYMENT_CONFIG] = ' + str(payment) + '\n').encode()
changes[prod_pool] = b'''[pripyat-telegram-website-prod]
user = pripyat-tg-prod
group = pripyat-tg-prod
listen = /run/php/php8.5-fpm-telegram-website-prod.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = ondemand
pm.max_children = 4
pm.process_idle_timeout = 20s
env[PRIPYAT_WEBSITE_TELEGRAM_PROD_CONFIG] = /etc/pripyat/website-auth-prod.json
php_admin_value[session.save_path] = /var/lib/pripyat-telegram-website/sessions
php_admin_value[open_basedir] = /var/www/pripyat-site/telegram-website-prod:/etc/pripyat/website-auth-prod.json:/var/lib/pripyat-telegram-website:/tmp
php_admin_flag[display_errors] = off
php_admin_flag[log_errors] = on
'''
changes[payment] = json.dumps({'environment':'prod','database':'stalker_telegram','host':'127.0.0.1',
                               'port':3306,'user':config['db_user'],'password':config['db_password']}).encode()
changes[worker_unit] = b'[Service]\nReadWritePaths=/var/lib/pripyat-telegram-website/receipts\n'

if CHECK_ONLY:
    print('Проверка PROD перед выкладкой пройдена, изменений на сервере нет.')
    raise SystemExit(0)

backup = P(tempfile.mkdtemp(prefix='telegram-website-prod-', dir='/var/backups'))
print('Точка отката: ' + str(backup), flush=True)
saved = {}
for target in changes:
    if target.exists():
        metadata = target.stat()
        old = backup / target.relative_to('/')
        old.parent.mkdir(parents=True, exist_ok=True)
        old.write_bytes(target.read_bytes())
        saved[target] = (old, metadata.st_mode & 0o777, metadata.st_uid, metadata.st_gid)

def atomic(target, body, mode=0o644, uid=0, gid=0):
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=target.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(body)
            os.fchown(stream.fileno(), uid, gid)
            os.fchmod(stream.fileno(), mode)
        os.replace(name, target)
    finally:
        P(name).unlink(missing_ok=True)

applied = []
try:
    state.mkdir(mode=0o755)
    for path, mode, uid in ((state/'sessions',0o700,prod.pw_uid),(state/'receipts',0o2750,0)):
        path.mkdir()
        os.chown(path, uid, prod.pw_gid)
        path.chmod(mode)
    for target, data in changes.items():
        if target == payment:
            permissions = (0o640, 0, legacy.pw_gid)
        elif target in saved:
            permissions = saved[target][1:]
        else:
            permissions = (0o644, 0, 0)
        atomic(target, data, *permissions)
        applied.append(target)
        if target.suffix == '.php' or target == worker:
            run('php','-l',str(target))
    run('php-fpm8.5','-t')
    run('nginx','-t')
    run('php',str(worker),'--check')
    run('systemctl','daemon-reload')
    run('systemctl','reload','php8.5-fpm')
    run('systemctl','reload','nginx')
    assert legacy_checks() == before
    for attempt in range(6):
        code, _, body = request(host+'/auth/telegram-prod/status')
        if code == 200 and json.loads(body)['providers']['telegram'] is True:
            break
        time.sleep(1)
    else:
        raise RuntimeError(f'Telegram status: HTTP {code}')
    check_oauth()
    assert request(host+'/auth/telegram-prod/receipts')[0] == 401
    assert request(host+'/auth/telegram-prod/payment-create')[0] == 405
    assert request(host+'/auth/telegram-prod/payment-create', b'{}')[0] == 403
    assert request(host+'/game/telegram.html')[2] == changes[site/'game/telegram.html']
    for target, data in changes.items():
        if target.parent.name == 'telegram-website-' + VERSION:
            url = host+'/game/libs/'+target.parent.name+'/'+target.name
            assert request(url)[2] == data
except BaseException:
    for target in reversed(applied):
        if target in saved:
            original, *permissions = saved[target]
            atomic(target, original.read_bytes(), *permissions)
        else:
            target.unlink(missing_ok=True)
    for path in (state/'sessions', state/'receipts', state):
        try:
            path.rmdir()
        except OSError:
            pass
    for args in (('daemon-reload',),('reload','php8.5-fpm'),('reload','nginx')):
        subprocess.run(('systemctl',*args), check=False)
    raise
print('Telegram website PROD опубликован. Smoke сайта, VK/OK, OAuth и webhook пройден.')
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--oauth-check', action='store_true')
    args = parser.parse_args()
    files, version, button, worker = ({}, '', '', '') if args.oauth_check else payload()
    variables = dict(FILES=files, VERSION=version, BUTTON=button, WORKER=worker,
                     CHECK_ONLY=args.check, OAUTH_ONLY=args.oauth_check)
    script = ''.join(f'{key}={value!r}\n' for key, value in variables.items()) + REMOTE
    subprocess.run(['ssh', '-o', 'BatchMode=yes', '-i', str(Path.home()/'.ssh/id_ed25519_stalker'),
                    'root@135.106.159.212', 'python3', '-'], input=script.encode(), check=True)


if __name__ == '__main__':
    main()
