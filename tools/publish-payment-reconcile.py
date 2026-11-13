"""Publish the reviewed payment package only; no migrations or arbitrary player writes."""
from pathlib import Path
import subprocess,base64
root=Path(__file__).resolve().parents[1]
files={n:base64.b64encode((root/n).read_bytes()).decode() for n in ['website/app/rewardstotp.php','website/app/rewardstotp-gate.php','website/app/rewardspurchases.php','website/app/paymentattempts.php','tools/site-payment-reconcile.php','tools/run-site-payment-reconcile.php','tools/rewards-totp-state.php','tools/systemd/pripyat-payment-reconcile@.service','tools/systemd/pripyat-payment-reconcile@.timer','tools/systemd/pripyat-payment-reconcile.logrotate']}
code=r"""from pathlib import Path
import subprocess,base64,shutil,datetime,os,pwd,json,hashlib
backup=Path('/var/backups')/('pripyat-payment-reconcile-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
def run(args):
 r=subprocess.run(args,capture_output=True,text=True)
 if r.returncode:raise RuntimeError('Command failed: '+args[0]+' code '+str(r.returncode))
 return r.stdout
base=Path('/var/www/pripyat-site');gid=pwd.getpwnam('pripyat-site-test').pw_gid
state=Path('/var/lib/pripyat-payment-reconcile');state.mkdir(exist_ok=True);os.chown(state,0,gid);state.chmod(0o2750)
manifest={};changed=[]
try:
 for name,value in FILES.items():
  if name.startswith('website/app/'):dest=base/'app'/Path(name).name
  elif name.endswith('.logrotate'):dest=Path('/etc/logrotate.d/pripyat-payment-reconcile')
  elif '/systemd/' in name:dest=Path('/etc/systemd/system')/Path(name).name
  else:dest=base/name
  key=str(dest).lstrip('/').replace('/','__')
  if dest.exists():shutil.copy2(dest,backup/key)
  changed.append((dest,key));dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(base64.b64decode(value));dest.chmod(0o644)
  if dest.suffix=='.php':run(['php','-l',str(dest)])
  manifest[str(dest)]=hashlib.sha256(dest.read_bytes()).hexdigest()
 pool=Path('/etc/php/8.5/fpm/pool.d/pripyat-site-test.conf');key='site-pool.conf';shutil.copy2(pool,backup/key);changed.append((pool,key))
 text=pool.read_text()
 if '/var/lib/pripyat-payment-reconcile' not in text:text=text.replace('php_admin_value[open_basedir] = ','php_admin_value[open_basedir] = /var/lib/pripyat-payment-reconcile:')
 pool.write_text(text)
 run(['php-fpm8.5','-t']);run(['nginx','-t']);run(['systemd-analyze','verify','/etc/systemd/system/pripyat-payment-reconcile@.service','/etc/systemd/system/pripyat-payment-reconcile@.timer'])
 run(['systemctl','daemon-reload']);run(['systemctl','reload','php8.5-fpm'])
 for world in ['site','vk','ok','telegram']:
  # A normal verified reconciliation may credit succeeded orders through settle().
  result=subprocess.run(['systemctl','start','pripyat-payment-reconcile@'+world+'.service'],capture_output=True,text=True)
  print(world,'first_run_exit',result.returncode)
  if result.returncode:raise RuntimeError('Reconciliation first run failed for '+world)
 for world in ['site','vk','ok','telegram']:run(['systemctl','enable','--now','pripyat-payment-reconcile@'+world+'.timer'])
 (backup/'release-manifest.json').write_text(json.dumps(manifest,indent=2))
 print('Published reviewed payment package; backup '+str(backup))
except Exception:
 for world in ['site','vk','ok','telegram']:subprocess.run(['systemctl','disable','--now','pripyat-payment-reconcile@'+world+'.timer'],capture_output=True)
 for dest,key in reversed(changed):
  old=backup/key
  if old.exists():shutil.copy2(old,dest)
  elif dest.exists():dest.unlink()
 run(['systemctl','daemon-reload']);run(['systemctl','reload','php8.5-fpm']);raise
""".replace('FILES',repr(files))
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','python3','-'],input=code,text=True,capture_output=True)
print(r.stdout,r.stderr);raise SystemExit(r.returncode)
