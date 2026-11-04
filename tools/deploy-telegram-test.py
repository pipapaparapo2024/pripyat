"""Publish only isolated Telegram TEST. Never invoke legacy release scripts or SQL DDL."""
from pathlib import Path
import importlib.util,json,re,hashlib,zipfile
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
files={}
for p in (ROOT/'server').rglob('*'):
    if not p.is_file() or p.suffix not in ('.php','.json'):continue
    if p.name in ['registry.php','registry.example.php','universal.php','universal_pay.php','ok_pay_callback.php'] or p.name.startswith(('migrate','reset_','dev_')):continue
    files[p.relative_to(ROOT).as_posix()]=p.read_bytes()
for p in (ROOT/'_client/telegram-build/libs').glob('*'):
    if p.suffix=='.js' or p.name.endswith('.LICENSE.txt'):files['libs/'+p.name]=p.read_bytes()
assert 'libs/index.js' in files and any(n.endswith('.telegram.js') for n in files)
html=(ROOT/'_client/development/index.html').read_text(encoding='utf-8-sig')
html=re.sub(r'^.*<script[^>]+src=["\'][^"\']*(?:browser\.min\.js|api\.ok\.ru)[^"\']*["\'][^>]*></script>.*\n?','',html,flags=re.M)
html=re.sub(r'index\.js\?v=\d+','index.js?v=1001',html)
html=html.replace('</head>','<script src="https://telegram.org/js/telegram-web-app.js"></script></head>')
html=html.replace('https://pripyat-game.ru/client/ver0_41/index.html','https://tg-test-pripyat-game.ru/')
files['index.html']=html.encode('utf-8')
files['index.html']=files['index.html'].replace(b'v=1001',b'v=1005')
for name in ['telegram-welcome.jpg','telegram-icon.jpg']:
    files['images/'+name]=(ROOT/'assets/images'/name).read_bytes()
assets=json.loads((ROOT/'assets/manifest.json').read_text(encoding='utf-8'))
assetmap={}
for name,entry in assets.items():
    remote='server/images/'+name.split('/',1)[1] if name.startswith('server-images/') else name
    source=remote if name.startswith('server-images/') else 'client/ver0_41/'+name
    assetmap[remote]={'source':source,'sha256':entry['sha256']}
assert not any('..' in Path(n).parts for n in list(files)+list(assetmap))
archive=ROOT/'_client/telegram-build/telegram-test.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for name,data in files.items():z.writestr(name,data)
expected={n:hashlib.sha256(data).hexdigest() for n,data in files.items()}
code=r'''
import pathlib,subprocess,json,hashlib,datetime,shutil,zipfile,os,grp,pwd,re
base=pathlib.Path('/var/www/stalker-tg-test/public').resolve()
assert str(base)=='/var/www/stalker-tg-test/public'
backup=pathlib.Path(BACKUP)
expected=EXPECTED;assets=ASSETS
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
protected=[pathlib.Path(p) for p in ['/var/www/stalker/client/ver0_41/index.html','/var/www/stalker/client/ver0_41/libs/index.js','/var/www/stalker-test/client/ver0_41/index.html','/var/www/stalker-test/client/ver0_41/libs/index.js','/var/www/stalker/server/core/models/registry.php','/var/www/stalker-test/server/core/models/registry.php','/etc/nginx/sites-available/stalker','/etc/nginx/sites-available/test-pripyat-game.ru','/etc/php/8.5/fpm/pool.d/www.conf']]
before={p:sha(p) for p in protected if p.is_file()}
def run(args):
    p=subprocess.run(args,capture_output=True,text=True)
    if p.returncode:raise RuntimeError('Command failed: '+args[0]+' '+p.stderr[:1000])
    return p.stdout
stage=backup/'stage';stage.mkdir()
with zipfile.ZipFile(backup/'release.zip') as z:
    assert set(z.namelist())==set(expected)
    for name,digest in expected.items():
        p=(stage/name).resolve();assert p.is_relative_to(stage.resolve())
        p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(name));assert sha(p)==digest
        if name.endswith('.php'):run(['php','-l',str(p)])
for name,entry in assets.items():
    if name in expected:
        assert expected[name]==entry['sha256'];continue
    source=pathlib.Path('/var/www/stalker-test')/entry['source']
    assert sha(source)==entry['sha256'],'Static source differs: '+name
for name in expected:
    dest=(base/name).resolve();assert dest.is_relative_to(base)
    if dest.is_file():
        old=backup/'original'/name;old.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest,old)
    dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(stage/name,dest);dest.chmod(0o644)
for name,entry in assets.items():
    dest=(base/name).resolve();assert dest.is_relative_to(base)
    if dest.is_file() and sha(dest)==entry['sha256']:continue
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(pathlib.Path('/var/www/stalker-test')/entry['source'],dest);dest.chmod(0o644)
# Independent PHP pool and Unix identity; never modify the legacy www pool.
try:pwd.getpwnam('pripyat-tg-test')
except KeyError:run(['useradd','--system','--no-create-home','--shell','/usr/sbin/nologin','pripyat-tg-test'])
gid=grp.getgrnam('pripyat-tg-test').gr_gid
config=pathlib.Path('/etc/pripyat/telegram-test.php')
shutil.copy2(config,backup/'config-before.php');(backup/'config-before.php').chmod(0o600)
original=config.read_text()
updated,n=re.subn(r"('enabled'\s*=>\s*)false",lambda m:m[1]+'true',original)
assert n==1 or re.search(r"'enabled'\s*=>\s*true",original),'Unexpected Telegram config'
config.write_text(updated);os.chown(config,0,gid);config.chmod(0o640)
os.chown(config.parent,0,gid);config.parent.chmod(0o750)
logs=pathlib.Path('/var/log/pripyat-tg-test');logs.mkdir(exist_ok=True);os.chown(logs,pwd.getpwnam('pripyat-tg-test').pw_uid,gid);logs.chmod(0o750)
updates=pathlib.Path('/var/lib/pripyat-tg-test/bot-updates');updates.mkdir(parents=True,exist_ok=True)
avatars=base/'images/telegram-avatars';avatars.mkdir(parents=True,exist_ok=True);os.chown(avatars,pwd.getpwnam('pripyat-tg-test').pw_uid,gid);avatars.chmod(0o755)
for directory in [updates.parent,updates]:os.chown(directory,pwd.getpwnam('pripyat-tg-test').pw_uid,gid);directory.chmod(0o700)
pool=pathlib.Path('/etc/php/8.5/fpm/pool.d/pripyat-tg-test.conf')
had_pool=pool.exists()
if had_pool:
    assert '[pripyat-tg-test]' in pool.read_text() and '/run/php/php8.5-fpm-tg-test.sock' in pool.read_text()
    shutil.copy2(pool,backup/'pool-before.conf')
pool.write_text(''' + '"""' + r'''[pripyat-tg-test]
user = pripyat-tg-test
group = pripyat-tg-test
listen = /run/php/php8.5-fpm-tg-test.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = ondemand
pm.max_children = 4
pm.process_idle_timeout = 20s
chdir = /var/www/stalker-tg-test/public/server
env[PRIPYAT_TELEGRAM_CONFIG] = /etc/pripyat/telegram-test.php
php_admin_flag[display_errors] = off
php_admin_flag[log_errors] = on
php_admin_value[error_log] = /var/log/pripyat-tg-test/php.log
php_admin_value[open_basedir] = /var/www/stalker-tg-test:/etc/pripyat/telegram-test.php:/var/log/pripyat-tg-test:/var/lib/pripyat-tg-test:/tmp
''' + '"""' + r''')
site=pathlib.Path('/etc/nginx/sites-available/tg-test-pripyat-game.ru')
shutil.copy2(site,backup/'nginx-before.conf')
text=site.read_text()
assert 'listen 443 ssl' in text
if 'location = /server/telegram-bot.php' not in text:
    text=text.replace('    location ~ \\.php$ { return 404; }', '    location = /server/telegram-bot.php {\n        include snippets/fastcgi-php.conf;\n        fastcgi_pass unix:/run/php/php8.5-fpm-tg-test.sock;\n    }\n    location ~ \\.php$ { return 404; }')
handler=''' + '"""' + r'''    location = /server/telegram-login.php {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.5-fpm-tg-test.sock;
    }
    location = /server/telegram-api.php {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.5-fpm-tg-test.sock;
    }
    location ~ \.php$ { return 404; }
''' + '"""' + r'''
text,n=re.subn(r'    location ~ \\\.php\$ \{ return 503; \}',lambda m:handler,text)
assert n==1 or ('location = /server/telegram-api.php' in text and '/run/php/php8.5-fpm-tg-test.sock' in text),'Unexpected Telegram PHP location'
if 'location = /server/telegram-bot.php' not in text:
    text=text.replace('    location ~ \\.php$ { return 404; }', '    location = /server/telegram-bot.php {\n        include snippets/fastcgi-php.conf;\n        fastcgi_pass unix:/run/php/php8.5-fpm-tg-test.sock;\n    }\n    location ~ \\.php$ { return 404; }')
site.write_text(text)
try:run(['php-fpm8.5','-t']);run(['nginx','-t'])
except BaseException:
    shutil.copyfile(backup/'config-before.php',config);shutil.copyfile(backup/'nginx-before.conf',site)
    if had_pool:shutil.copyfile(backup/'pool-before.conf',pool)
    else:pool.unlink()
    raise
# Graceful reload only. Legacy pool configuration and files are untouched.
run(['systemctl','reload','php8.5-fpm']);run(['systemctl','reload','nginx'])
assert all(sha(p)==digest for p,digest in before.items()),'Legacy files changed'
assert all(sha(base/n)==d for n,d in expected.items())
assert all(sha(base/n)==e['sha256'] for n,e in assets.items())
(backup/'manifest.json').write_text(json.dumps(expected));(backup/'manifest.json').chmod(0o600)
print(json.dumps({'published_files':len(expected),'verified_assets':len(assets),'backup':str(backup),'legacy_files_unchanged':True,'telegram_login_enabled':True}))
'''.replace('EXPECTED',repr(expected)).replace('ASSETS',repr(assetmap))
code=code.replace('EXPECTED',repr(expected)).replace('ASSETS',repr(assetmap))
client=release.connect()
try:
    from datetime import datetime,timezone
    backup='/var/backups/telegram-test-release-'+datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
    release.command(client,'mkdir -m 700 '+backup)
    with client.open_sftp() as sftp:sftp.put(str(archive),backup+'/release.zip')
    print(release.run_remote_python(client,code.replace('BACKUP',repr(backup))))
finally:client.close()
