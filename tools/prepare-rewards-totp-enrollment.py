"""Provision private TOTP enrollment without switching the existing generator gate."""
from pathlib import Path
import base64,subprocess
root=Path(__file__).resolve().parents[1]
files={n:base64.b64encode((root/n).read_bytes()).decode() for n in ['website/app/rewardstotp.php','website/app/rewardstotp-gate.php','rewards-admin/setup.php']}
code=r"""from pathlib import Path
import base64,subprocess,datetime,shutil,json,os,grp,secrets
backup=Path('/var/backups')/('pripyat-totp-enrollment-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
def run(args):
 r=subprocess.run(args,capture_output=True,text=True)
 if r.returncode:raise RuntimeError('Command failed: '+args[0])
 return r.stdout
try:grp.getgrnam('pripyat-admin-auth')
except KeyError:run(['groupadd','--system','pripyat-admin-auth'])
for user in ['pripyat-rewards-test','pripyat-site-test']:run(['usermod','-a','-G','pripyat-admin-auth',user])
gid=grp.getgrnam('pripyat-admin-auth').gr_gid
private=Path('/var/lib/pripyat-admin-auth');private.mkdir(exist_ok=True);os.chown(private,0,gid);private.chmod(0o750)
state=private/'totp.json'
assert not state.exists(),'Existing state requires review; refusing overwrite'
state.write_text(json.dumps({'secret':secrets.token_hex(20),'user':'admin','enabled':False,'step':-1,'retry_at':0}));os.chown(state,0,gid);state.chmod(0o660)
changed=[]
try:
 for name,data in FILES.items():
  dest=Path('/var/www/pripyat-rewards-test')/('public/setup.php' if name.endswith('setup.php') else 'app/'+Path(name).name)
  if dest.exists():shutil.copy2(dest,backup/dest.name)
  changed.append(dest);dest.write_bytes(base64.b64decode(data));dest.chmod(0o644);run(['php','-l',str(dest)])
 for pool in ['pripyat-rewards-test','pripyat-site-test']:
  path=Path('/etc/php/8.5/fpm/pool.d')/(pool+'.conf');shutil.copy2(path,backup/path.name);changed.append(path)
  text=path.read_text();assert 'PRIPYAT_REWARDS_TOTP_STATE' not in text
  text=text.replace('php_admin_value[open_basedir] = ','php_admin_value[open_basedir] = /var/lib/pripyat-admin-auth:')
  text+='\nenv[PRIPYAT_REWARDS_TOTP_STATE] = /var/lib/pripyat-admin-auth/totp.json\n';path.write_text(text)
 path=Path('/etc/nginx/sites-available/pripyat-site');shutil.copy2(path,backup/'pripyat-site');changed.append(path)
 text=path.read_text();needle='location ~ ^/rewards-admin/(index|logs)';assert needle in text;text=text.replace(needle,'location ~ ^/rewards-admin/(index|logs|setup)');path.write_text(text)
 run(['php-fpm8.5','-t']);run(['nginx','-t']);run(['systemctl','reload','php8.5-fpm']);run(['systemctl','reload','nginx'])
 print('Enrollment prepared; existing generator routes unchanged; backup '+str(backup))
except Exception:
 for dest in changed:
  old=backup/dest.name
  if old.exists():shutil.copy2(old,dest)
  elif dest.exists():dest.unlink()
 state.unlink(missing_ok=True)
 run(['systemctl','reload','php8.5-fpm']);run(['systemctl','reload','nginx']);raise
""".replace('FILES',repr(files))
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','python3','-'],input=code,text=True,capture_output=True)
print(r.stdout,r.stderr);raise SystemExit(r.returncode)
