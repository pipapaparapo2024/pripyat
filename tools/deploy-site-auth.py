"""Publish isolated website files to the new VPS; no SQL or service restart."""
from pathlib import Path
import subprocess,tarfile,tempfile,json,base64
ROOT=Path(__file__).resolve().parents[1]
SSH=['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212']
files={}
for name in ['index.html','login.js','style.css']:files['public/'+name]=ROOT/'website'/name
files['public/assets/mail-zone.jpg']=ROOT/'website/assets/mail-zone.jpg'
files['public/assets/site-game-background.jpg']=ROOT/'assets/images/maintenance-background.jpg'
for asset in ['левая рука.png','левая рука.png.webp']:files['game/images/'+asset]=ROOT/'assets/images'/asset
files['public/assets/favicon.jpg']=ROOT/'website/assets/favicon.jpg'
files['public/reward/index.html']=ROOT/'website/reward/index.html'
files['app/rewardintent.php']=ROOT/'website/app/rewardintent.php'
files['public/offer/index.html']=ROOT/'website/offer/index.html'
files['public/data/index.html']=ROOT/'website/data/index.html'
files['public/payment/index.html']=ROOT/'website/payment/index.html'
for p in (ROOT/'website/app').glob('site*.php'): files['app/'+p.name]=p
for p in (ROOT/'website/app').glob('social*.php'): files['app/'+p.name]=p
for p in (ROOT/'website/account').glob('*'): files['public/account/'+p.name]=p
for p in (ROOT/'_client/website-build/libs').glob('*'): files['game-libs/'+p.name]=p
tracked=subprocess.check_output(['git','ls-files','server'],cwd=ROOT,text=True).splitlines()
for name in tracked:
 if name.endswith(('.php','.json')) and '/registry' not in name:files[name]=ROOT/name
files['server/core/models/gamefriendrequests.php']=ROOT/'server/core/models/gamefriendrequests.php'
files['server/site-api.php']=ROOT/'server/site-api.php'
files['server/social-api.php']=ROOT/'server/social-api.php'
files['server/site-payments-webhook.php']=ROOT/'server/site-payments-webhook.php'
files['server/json/site_prices.json']=ROOT/'server/json/site_prices.json'
files['server/core/models/sitedatabase.php']=ROOT/'server/core/models/sitedatabase.php'
files['server/core/models/nativeplayersessionlock.php']=ROOT/'server/core/models/nativeplayersessionlock.php'
files['server/core/models/erasedaccounts.php']=ROOT/'server/core/models/erasedaccounts.php'
files['server/core/models/accounterasure.php']=ROOT/'server/core/models/accounterasure.php'
files['server/core/models/nativeavatarcache.php']=ROOT/'server/core/models/nativeavatarcache.php'
archive=Path(tempfile.gettempdir())/'pripyat-site-auth.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
 for name,p in files.items():tar.add(p,arcname=name)
subprocess.run(['scp','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),str(archive),'root@135.106.159.212:/var/backups/pripyat-site-auth-upload.tar.gz'],check=True)
script=r'''
from pathlib import Path
import tarfile,datetime,subprocess,shutil,json,secrets,os,pwd,hashlib,re
base=Path('/var/www/pripyat-site');assert base.is_dir()
native=Path('/var/www/stalker-native-prod/client/ver0_41/libs/index.js')
before=hashlib.sha256(native.read_bytes()).hexdigest()
backup=Path('/var/backups')/('site-auth-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
vhost=Path('/etc/nginx/sites-available/pripyat-site');shutil.copy2(vhost,backup/'nginx.conf')
with tarfile.open('/var/backups/pripyat-site-auth-upload.tar.gz') as tar:
 for m in tar.getmembers():
  assert not m.name.startswith('/') and '..' not in Path(m.name).parts and m.isfile()
  target=base/m.name
  if target.exists():
   dest=backup/m.name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,dest)
  target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(tar.extractfile(m).read());target.chmod(0o644)
private=base/'private';private.mkdir(mode=0o750,exist_ok=True);u=pwd.getpwnam('pripyat-site-test');os.chown(private,0,u.pw_gid)
config=private/'site-runtime.json'
if config.exists(): c=json.loads(config.read_text());shutil.copy2(config,backup/'private-runtime.json')
else:c={'rate_secret':secrets.token_hex(32),'phone_hmac_key':secrets.token_hex(32),'phone_encryption_key':secrets.token_hex(32)}
for key,name in [('database','site-test-database.json'),('access','website-access-test.json'),('mail','website-mail-test.json'),('phone','website-phone-test.json')]:c[key]=json.loads((Path('/etc/pripyat')/name).read_text())
if 'payments' not in c:c['payments']=json.loads(Path('/etc/pripyat/yookassa-test.json').read_text())
c['vkid']=json.loads(Path('/etc/pripyat/website-vkid-test.json').read_text())
c['native']=json.loads(Path('/etc/pripyat/vk-ok-native-prod.json').read_text())
c.setdefault('social_links',{}).setdefault('ok',{})['382448269']='587256562321'
c['mail']['enabled']=True;c['phone']['enabled']=True
assert c['database']['database']=='stalker_site_test'
if 'developer_emails' not in c:
 c['developer_emails']=['fleeexim@gmail.com','bedzanansergej5110@gmail.com','mr.vladimirkhikaev@gmail.com','killer_ik@mail.ru']
config.write_text(json.dumps(c));config.chmod(0o640);os.chown(config,0,u.pw_gid)
limits=Path('/var/lib/pripyat-site-test/limits');limits.mkdir(mode=0o700,exist_ok=True);os.chown(limits,u.pw_uid,u.pw_gid)
avatars=base/'public/assets/avatars';avatars.mkdir(mode=0o755,exist_ok=True);os.chown(avatars,u.pw_uid,u.pw_gid)
checks=private/'social-checks';checks.mkdir(mode=0o700,exist_ok=True);os.chown(checks,u.pw_uid,u.pw_gid)
profiles=private/'social-profiles';profiles.mkdir(mode=0o700,exist_ok=True);os.chown(profiles,u.pw_uid,u.pw_gid)
links=private/'social-links';links.mkdir(mode=0o700,exist_ok=True);os.chown(links,u.pw_uid,u.pw_gid)
gameindex=base/'game/index.html'
if gameindex.exists():
 shutil.copy2(gameindex,backup/'game-index.html')
 version=hashlib.sha256((base/'game-libs/index.js').read_bytes()).hexdigest()[:12]
 gameindex.write_text(re.sub(r'libs/index\.js\?v=[^"\s]+','libs/index.js?v='+version,gameindex.read_text()))
 text=gameindex.read_text()
 background='<style id="site-game-background">body{background-color:#101513!important;background-image:linear-gradient(rgba(0,0,0,.78),rgba(0,0,0,.78)),url("/assets/site-game-background.jpg")!important;background-position:center center!important;background-size:cover!important;background-repeat:no-repeat!important;background-attachment:fixed!important}</style>'
 if 'id="site-game-background"' in text:gameindex.write_text(re.sub(r'<style id="site-game-background">.*?</style>',lambda _:background,text,flags=re.S))
 else:gameindex.write_text(text.replace('</head>',background+'</head>'))
 text=gameindex.read_text()
 if '/assets/favicon.jpg' not in text:gameindex.write_text(text.replace('</head>','<link rel="icon" type="image/jpeg" href="/assets/favicon.jpg?v=1"></head>'))
for name in ['app/sitehttp.php','app/sitephoneactions.php','server/site-api.php']:
 subprocess.run(['php','-l',str(base/name)],check=True,capture_output=True)
text=vhost.read_text()
if 'sociallinkhttp.php' not in text:text=text.replace(' location ~ ^/auth/', ' location ~ ^/auth/social/(link|native)$ {\n access_log off;\n include fastcgi_params;\n fastcgi_param SCRIPT_FILENAME /var/www/pripyat-site/app/sociallinkhttp.php;\n fastcgi_pass unix:/run/php/php8.5-fpm-site-test.sock;\n }\n location ~ ^/auth/',1)
if 'location = /server/social-api.php' not in text:text=text.replace(' location = /server/site-api.php {',' location = /server/social-api.php {\n include fastcgi_params;\n fastcgi_param SCRIPT_FILENAME /var/www/pripyat-site/server/social-api.php;\n fastcgi_pass unix:/run/php/php8.5-fpm-site-test.sock;\n }\n location = /server/site-api.php {',1)
if 'socialhttp.php' not in text:text=text.replace(' location ~ ^/auth/', ' location ~ ^/auth/(vk/start|ok/start|vk/callback)$ {\n access_log off;\n include fastcgi_params;\n fastcgi_param SCRIPT_FILENAME /var/www/pripyat-site/app/socialhttp.php;\n fastcgi_pass unix:/run/php/php8.5-fpm-site-test.sock;\n }\n location ~ ^/auth/',1)
route=' location ~ ^/auth/(status|bootstrap|logout|site/(register|login|verify|resend|forgot|reset|phone-start|phone-check))$ {\n include fastcgi_params;\n fastcgi_param SCRIPT_FILENAME /var/www/pripyat-site/app/sitehttp.php;\n fastcgi_pass unix:/run/php/php8.5-fpm-site-test.sock;\n }\n location = /server/site-api.php {\n include fastcgi_params;\n fastcgi_param SCRIPT_FILENAME /var/www/pripyat-site/server/site-api.php;\n fastcgi_pass unix:/run/php/php8.5-fpm-site-test.sock;\n }\n'
if 'sitehttp.php' not in text:text=text.replace(' location ~ ^/auth/',route+' location ~ ^/auth/',1)
text=text.replace('reset|phone-start|phone-check))','reset|phone-start|phone-check|avatar))')
text=text.replace('phone-check|avatar))','phone-check|avatar|set-password))')
if 'location = /server/site-payments-webhook.php' not in text:text=text.replace(' location = /server/site-api.php {',' location = /server/site-payments-webhook.php {\n include fastcgi_params;\n fastcgi_param SCRIPT_FILENAME /var/www/pripyat-site/server/site-payments-webhook.php;\n fastcgi_pass unix:/run/php/php8.5-fpm-site-test.sock;\n }\n location = /server/site-api.php {',1)
if 'client_max_body_size 3m;' not in text:text=text.replace(' root /var/www/pripyat-site/public;',' root /var/www/pripyat-site/public;\n client_max_body_size 3m;',1)
vhost.write_text(text)
try:subprocess.run(['nginx','-t'],check=True,capture_output=True)
except Exception:vhost.write_bytes((backup/'nginx.conf').read_bytes());raise
subprocess.run(['systemctl','reload','nginx'],check=True)
assert hashlib.sha256(native.read_bytes()).hexdigest()==before
print(json.dumps({'backup':str(backup),'native_client_unchanged':True,'sql_executed':False,'fpm_restarted':False}))
'''
result=subprocess.run(SSH+['python3','-'],input=script,text=True,encoding='utf-8',capture_output=True)
if result.returncode:raise SystemExit(result.stderr)
print(result.stdout)
