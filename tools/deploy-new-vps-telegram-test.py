"""Deploy existing Telegram TEST to NEW VPS only. No SQL, payments, or PROD bot mutations."""
from pathlib import Path
import importlib.util,subprocess,json,re,zipfile,hashlib,sys
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
files={}
for f in (ROOT/'server').rglob('*'):
 if f.is_file() and f.suffix in ('.php','.json') and f.name not in ['registry.php','registry.example.php','universal.php','universal_pay.php','ok_pay_callback.php'] and not f.name.startswith(('migrate','reset_','dev_')):files[f.relative_to(ROOT).as_posix()]=f
for f in (ROOT/'_client/telegram-build/libs').glob('*.js'):files['libs/'+f.name]=f
assert 'libs/index.js' in files
manifest=json.loads((ROOT/'assets/manifest.json').read_text(encoding='utf-8'))
for name,entry in manifest.items():
 f=ROOT/'assets'/name;assert f.is_file() and hashlib.sha256(f.read_bytes()).hexdigest()==entry['sha256'],name
 dest='server/images/'+name.split('/',1)[1] if name.startswith('server-images/') else name
 if dest not in files:files[dest]=f
for name in ['telegram-welcome.jpg','telegram-icon.jpg']:files['images/'+name]=ROOT/'assets/images'/name
html=(ROOT/'_client/development/index.html').read_text(encoding='utf-8-sig')
html=re.sub(r'^.*<script[^>]+src=["\'][^"\']*(?:browser\.min\.js|api\.ok\.ru)[^"\']*["\'][^>]*></script>.*\n?','',html,flags=re.M)
html=re.sub(r'index\.js\?v=\d+','index.js?v=1006',html).replace('</head>','<script src="https://telegram.org/js/telegram-web-app.js"></script></head>')
html=html.replace('https://pripyat-game.ru/client/ver0_41/index.html','https://tg-test-pripyat-game.ru/')
archive=ROOT/'_client/telegram-build/new-vps-test.zip'
hashes={name:hashlib.sha256(f.read_bytes()).hexdigest() for name,f in files.items()};hashes['index.html']=hashlib.sha256(html.encode()).hexdigest()
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=1) as z:
 for name,f in files.items():z.write(f,name)
 z.writestr('index.html',html)
print('TEST archive prepared:',len(hashes),'files,',archive.stat().st_size,'bytes',flush=True)
if '--reuse-upload' not in sys.argv:
 subprocess.run(['scp','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'-o','BatchMode=yes',str(archive),'root@'+p.HOST+':/var/backups/pripyat-tg-new-vps.zip'],check=True)
p.remote('root',r'''
from pathlib import Path
import subprocess,json,zipfile,hashlib,pwd,os,grp,secrets,datetime,shutil
def run(args):
 r=subprocess.run(args,capture_output=True,text=True)
 if r.returncode:raise RuntimeError('Command failed: '+args[0]+'; private diagnostics suppressed')
 return r.stdout
base=Path('/var/www/stalker-tg-test/public');assert not base.exists(),'Refusing to overwrite existing TEST deployment'
backup=Path('/var/backups')/('pripyat-tg-new-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
archive=Path('/var/backups/pripyat-tg-new-vps.zip');archive.chmod(0o600)
with zipfile.ZipFile(archive) as z:
 assert set(z.namelist())==set(HASHES)
 for name,digest in HASHES.items():
  dest=(base/name).resolve();assert dest.is_relative_to(base.resolve())
  data=z.read(name);assert hashlib.sha256(data).hexdigest()==digest
  dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);dest.chmod(0o644)
  if name.endswith('.php'):run(['php','-l',str(dest)])
try:account=pwd.getpwnam('pripyat-tg-test')
except KeyError:
 run(['useradd','--system','--no-create-home','--shell','/usr/sbin/nologin','pripyat-tg-test']);account=pwd.getpwnam('pripyat-tg-test')
private=Path('/etc/pripyat');private.chmod(0o711)
c=json.loads((private/'telegram-test-bot.json').read_text());db=json.loads((private/'test-platform-databases.json').read_text())['stalker_telegram_test']
assert c['environment']=='test' and c['bot_api_environment']=='production' and c['bot_token']
config={'enabled':True,'stars_enabled':False,'environment':'test','database':'stalker_telegram_test','bot_api_environment':'production','bot_token':c['bot_token'],'db_user':db['user'],'db_password':db['password'],'webhook_secret':c['webhook_secret']}
path=private/'telegram-test.php';assert not path.exists()
import base64
payload=base64.b64encode(json.dumps(config).encode()).decode()
path.write_text("<?php return json_decode(base64_decode('"+payload+"'),true);");os.chown(path,0,account.pw_gid);path.chmod(0o640)
for directory in [Path('/var/log/pripyat-tg-test'),Path('/var/lib/pripyat-tg-test'),Path('/var/lib/pripyat-tg-test/bot-updates'),base/'images/telegram-avatars']:
 directory.mkdir(parents=True,exist_ok=True);os.chown(directory,account.pw_uid,account.pw_gid);directory.chmod(0o755 if directory==base/'images/telegram-avatars' else 0o700)
policy=json.loads((private/'closed-test-access.json').read_text())['telegram']['ids']
access=Path('/var/lib/pripyat-tg-test/access.json');access.write_text(json.dumps({'allowed':policy}));os.chown(access,account.pw_uid,account.pw_gid);access.chmod(0o600)
pool=Path('/etc/php/8.5/fpm/pool.d/pripyat-tg-test.conf');assert not pool.exists()
pool.write_text(POOL)
site=Path('/etc/nginx/sites-available/tg-test-pripyat-game.ru');assert not site.exists();site.write_text(SITE)
Path('/etc/nginx/sites-enabled/tg-test-pripyat-game.ru').symlink_to(site)
try:run(['php-fpm8.5','-t']);run(['nginx','-t'])
except Exception:
 Path('/etc/nginx/sites-enabled/tg-test-pripyat-game.ru').unlink();site.unlink();pool.unlink();raise
run(['systemctl','reload','php8.5-fpm']);run(['systemctl','reload','nginx'])
(backup/'manifest.json').write_text(json.dumps(HASHES))
print(json.dumps({'test_files':len(HASHES),'test_login_enabled':True,'stars_enabled':False,'prod_bot_changed':False,'sql_executed':False,'backup':str(backup)}))
'''.replace('HASHES',repr(hashes)).replace('POOL',repr('''[pripyat-tg-test]
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
''')).replace('SITE',repr('''server {
 listen 80;
 listen [::]:80;
 server_name tg-test-pripyat-game.ru;
 root /var/www/stalker-tg-test/public;
 index index.html;
 add_header X-Content-Type-Options nosniff always;
 location = /server/telegram-login.php { include snippets/fastcgi-php.conf; fastcgi_pass unix:/run/php/php8.5-fpm-tg-test.sock; }
 location = /server/telegram-api.php { include snippets/fastcgi-php.conf; fastcgi_pass unix:/run/php/php8.5-fpm-tg-test.sock; }
 location = /server/telegram-bot.php { include snippets/fastcgi-php.conf; fastcgi_pass unix:/run/php/php8.5-fpm-tg-test.sock; }
 location ~ \\.php$ { return 404; }
 location ~ /\\. { deny all; }
 location ~ \\.(?:stamp|lock|tmp)$ { deny all; }
 location = /server/json/links.json { try_files $uri =404; }
 location = /server/json/donuts.json { try_files $uri =404; }
 location ~ ^/server/images/[^/]+\\.(?:png|webp|jpg)$ { try_files $uri =404; }
 location /server/ { return 404; }
 location / { try_files $uri $uri/ =404; }
}
''')))
