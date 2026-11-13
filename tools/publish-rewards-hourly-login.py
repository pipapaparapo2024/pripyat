"""Replace browser-cached Basic Auth with a one-hour signed login while preserving credentials/TOTP."""
from pathlib import Path
import subprocess,base64
root=Path(__file__).resolve().parents[1]
names=['website/app/rewardsauth.php','website/app/rewardstotp.php','website/app/rewardstotp-gate.php','website/app/rewardspurchases.php','rewards-admin/config.php','rewards-admin/login.php','rewards-admin/setup.php']
files={n:base64.b64encode((root/n).read_bytes()).decode() for n in names}
code=r"""from pathlib import Path
import base64,subprocess,datetime,shutil,json,os,grp,secrets,urllib.request,urllib.error,time
backup=Path('/var/backups')/('pripyat-hourly-login-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
def run(args):
 r=subprocess.run(args,capture_output=True,text=True);assert r.returncode==0,'Check failed '+args[0]
 return r.stdout
private=Path('/var/lib/pripyat-admin-auth');gid=grp.getgrnam('pripyat-admin-auth').gr_gid
state=private/'totp.json';original_state=state.read_bytes();assert json.loads(original_state)['enabled'] is True
username,password_hash=Path('/etc/nginx/.htpasswd-pripyat-rewards-test').read_text().strip().split(':',1)
auth=private/'auth.json'
assert not auth.exists(),'Existing hourly auth requires reviewed update'
auth.write_text(json.dumps({'user':username,'password_hash':password_hash,'signing_key':secrets.token_hex(32),'throttle_path':str(private/'login-attempts.json')}));os.chown(auth,0,gid);auth.chmod(0o640)
throttle=private/'login-attempts.json';throttle.write_text('{}');os.chown(throttle,0,gid);throttle.chmod(0o660)
changed=[]
try:
 for name,value in FILES.items():
  if name.startswith('rewards-admin/'):
   destinations=[Path('/var/www/pripyat-rewards-test/public')/Path(name).name]
  elif name.endswith('rewardspurchases.php'):destinations=[Path('/var/www/pripyat-site/app/rewardspurchases.php')]
  else:destinations=[Path('/var/www/pripyat-rewards-test/app')/Path(name).name,Path('/var/www/pripyat-site/app')/Path(name).name]
  for dest in destinations:
   if dest.name=='config.php':
    candidate=base64.b64decode(value).decode().replace(chr(13),'').replace("require_once dirname(__DIR__).'/app/rewardsauth.php';\nrequireRewardsLogin();\n",'')
    assert candidate==dest.read_text(),'Generator configuration differs; refusing overwrite'
   key=str(dest).replace('/','__')
   if dest.exists():shutil.copy2(dest,backup/key)
   changed.append((dest,key));dest.write_bytes(base64.b64decode(value));dest.chmod(0o644);run(['php','-l',str(dest)])
 for pool in ['pripyat-site-test','pripyat-rewards-test']:
  dest=Path('/etc/php/8.5/fpm/pool.d')/(pool+'.conf');key=dest.name;shutil.copy2(dest,backup/key);changed.append((dest,key));text=dest.read_text();assert 'PRIPYAT_REWARDS_AUTH_CONFIG' not in text
  dest.write_text(text+'\nenv[PRIPYAT_REWARDS_AUTH_CONFIG] = /var/lib/pripyat-admin-auth/auth.json\n')
 dest=Path('/etc/nginx/sites-available/pripyat-site');key='nginx.conf';shutil.copy2(dest,backup/key);changed.append((dest,key));text=dest.read_text()
 text=text.replace('(index|logs|setup)', '(index|logs|setup|login)')
 text=text.replace('auth_basic "Pripyat TEST rewards";','auth_basic off;').replace('auth_basic_user_file /etc/nginx/.htpasswd-pripyat-rewards-test;','')
 needle=' location /rewards-admin/ {';assert needle in text
 text=text.replace(needle,' location ~ ^/rewards-admin/.*\\.php$ { return 404; }\n'+needle)
 dest.write_text(text)
 run(['php-fpm8.5','-t']);run(['nginx','-t']);run(['systemctl','reload','php8.5-fpm']);run(['systemctl','reload','nginx'])
 for retry in range(50):
  try:
   probe=urllib.request.urlopen('https://pripyat-game-site.ru/rewards-admin/login.php',timeout=10)
   if probe.code==200:break
  except urllib.error.HTTPError:pass
  time.sleep(.2)
 assert state.read_bytes()==original_state,'TOTP state changed unexpectedly'
 for route,want in [('login.php',200),('index.php',303),('logs.php',303),('purchases.php',303),('setup.php',303),('config.php',404)]:
  class NoRedirect(urllib.request.HTTPRedirectHandler):
   def redirect_request(self,*args,**kwargs):return None
  try:r=urllib.request.build_opener(NoRedirect).open('https://pripyat-game-site.ru/rewards-admin/'+route,timeout=20)
  except urllib.error.HTTPError as e:r=e
  body=r.read();assert r.code==want,(route,r.code,want)
  if route=='login.php':assert b'name="password"' in body
 print('Hourly login deployed; existing password and TOTP preserved; direct-route checks passed; backup '+str(backup))
except Exception:
 for dest,key in reversed(changed):
  if (backup/key).exists():shutil.copy2(backup/key,dest)
  elif dest.exists():dest.unlink()
 auth.unlink(missing_ok=True);throttle.unlink(missing_ok=True)
 run(['systemctl','reload','php8.5-fpm']);run(['systemctl','reload','nginx']);raise
""".replace('FILES',repr(files))
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','python3','-'],input=code,text=True,capture_output=True)
print(r.stdout,r.stderr);raise SystemExit(r.returncode)
