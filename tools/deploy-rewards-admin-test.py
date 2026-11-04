"""New TEST generator only: four TEST databases, HTTPS Basic Auth, no DDL or PROD access."""
from pathlib import Path
import importlib.util,base64
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
files={'public/'+f.name:base64.b64encode(f.read_bytes()).decode() for f in (ROOT/'rewards-admin').iterdir() if f.is_file()}
for name in ['rewardlinkpublisher.php','rewardlinktargets.php']:files['app/'+name]=base64.b64encode((ROOT/'server/core/models'/name).read_bytes()).decode()
p.remote('root',r'''
from pathlib import Path
import json,os,pwd,secrets,subprocess,base64,shutil,datetime
def run(args):
 r=subprocess.run(args,capture_output=True,text=True)
 if r.returncode:raise RuntimeError('Command failed: '+args[0]+'; private diagnostics suppressed')
 return r.stdout
base=Path('/var/www/pripyat-rewards-test');assert not base.exists(),'Refusing overwrite'
backup=Path('/var/backups')/('pripyat-rewards-test-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
run(['useradd','--system','--no-create-home','--shell','/usr/sbin/nologin','pripyat-rewards-test']);account=pwd.getpwnam('pripyat-rewards-test')
for name,value in FILES.items():
 dest=base/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(base64.b64decode(value));dest.chmod(0o644)
 if dest.suffix=='.php':run(['php','-l',str(dest)])
private=Path('/etc/pripyat');credentials=json.loads((private/'test-platform-databases.json').read_text());site=json.loads((private/'site-test-database.json').read_text());credentials[site['database']]=site
assert set(credentials)=={'stalker_test','stalker_ok_test','stalker_telegram_test','stalker_site_test'}
password=secrets.token_urlsafe(24);user='admin'
r=subprocess.run(['php','-r',"echo password_hash(stream_get_contents(STDIN),PASSWORD_BCRYPT);"],input=password,capture_output=True,text=True);assert r.returncode==0
htpasswd=Path('/etc/nginx/.htpasswd-pripyat-rewards-test');assert not htpasswd.exists();htpasswd.write_text(user+':'+r.stdout+'\n');os.chown(htpasswd,0,pwd.getpwnam('www-data').pw_gid);htpasswd.chmod(0o640)
access=private/'rewards-admin-test-access.json';assert not access.exists();access.write_text(json.dumps({'username':user,'password':password,'url':'https://pripyat-game-site.ru/rewards-admin/'}));access.chmod(0o600)
config=private/'rewards-admin-test.json';assert not config.exists();config.write_text(json.dumps({'enabled':True,'environment':'test','admin_user':user,'databases':credentials}));os.chown(config,0,account.pw_gid);config.chmod(0o640)
state=Path('/var/lib/pripyat-rewards-test');state.mkdir();os.chown(state,account.pw_uid,account.pw_gid);state.chmod(0o700)
pool=Path('/etc/php/8.5/fpm/pool.d/pripyat-rewards-test.conf');assert not pool.exists()
pool.write_text('[pripyat-rewards-test]\nuser = pripyat-rewards-test\ngroup = pripyat-rewards-test\nlisten = /run/php/php8.5-fpm-rewards-test.sock\nlisten.owner = www-data\nlisten.group = www-data\nlisten.mode = 0660\npm = ondemand\npm.max_children = 2\npm.process_idle_timeout = 20s\nenv[PRIPYAT_REWARDS_CONFIG] = /etc/pripyat/rewards-admin-test.json\nphp_admin_value[session.save_path] = /var/lib/pripyat-rewards-test\nphp_admin_flag[display_errors] = off\nphp_admin_value[open_basedir] = /var/www/pripyat-rewards-test:/etc/pripyat/rewards-admin-test.json:/var/lib/pripyat-rewards-test:/tmp\n')
site=Path('/etc/nginx/sites-available/pripyat-site');text=site.read_text();shutil.copy2(site,backup/'nginx-before.conf');assert 'rewards-admin' not in text
needle=' location / { try_files $uri $uri/ =404; }';assert needle in text
block=NGINX_BLOCK
site.write_text(text.replace(needle,block+'\n'+needle))
try:run(['php-fpm8.5','-t']);run(['nginx','-t'])
except Exception:
 shutil.copy2(backup/'nginx-before.conf',site);pool.unlink();raise
run(['systemctl','reload','php8.5-fpm']);run(['systemctl','reload','nginx'])
print('TEST reward generator deployed behind HTTPS Basic Auth; private credentials prepared; four TEST databases only; no DDL')
'''.replace('FILES',repr(files)).replace('NGINX_BLOCK',repr(''' location = /rewards-admin { return 301 /rewards-admin/; }
 location ~ ^/rewards-admin/(index|logs)\\.php$ {
  auth_basic "Pripyat TEST rewards";
  auth_basic_user_file /etc/nginx/.htpasswd-pripyat-rewards-test;
  include fastcgi_params;
  fastcgi_param SCRIPT_FILENAME /var/www/pripyat-rewards-test/public/$1.php;
  fastcgi_param REMOTE_USER $remote_user;
  fastcgi_pass unix:/run/php/php8.5-fpm-rewards-test.sock;
 }
 location /rewards-admin/ {
  auth_basic "Pripyat TEST rewards";
  auth_basic_user_file /etc/nginx/.htpasswd-pripyat-rewards-test;
  alias /var/www/pripyat-rewards-test/public/;
  index index.php;
 }
''')))
