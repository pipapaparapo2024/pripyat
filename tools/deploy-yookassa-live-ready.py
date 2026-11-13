"""Publish website-only test/live separation; do not open real checkouts."""
from pathlib import Path
import subprocess, tarfile, tempfile

ROOT = Path(__file__).resolve().parents[1]
KEY = str(Path.home()/'.ssh/id_ed25519_stalker')
HOST = 'root@135.106.159.212'
FILES = {
 'app/siteyookassa.php': 'website/app/siteyookassa.php',
 'app/sitepayments.php': 'website/app/sitepayments.php',
 'app/sitehttp.php': 'website/app/sitehttp.php',
 'server/site-api.php': 'server/site-api.php',
 'server/social-api.php': 'server/social-api.php',
 'server/site-payments-webhook.php': 'server/site-payments-webhook.php',
 'payment-mysql-fixture.php': 'tests/_php_fixtures/site-payment-mysql.php',
}
archive = Path(tempfile.gettempdir())/'pripyat-live-ready.tar.gz'
with tarfile.open(archive, 'w:gz') as tar:
 for target, source in FILES.items():
  tar.add(ROOT/source, arcname=target)
subprocess.run(['scp','-i',KEY,str(archive),HOST+':/var/backups/pripyat-live-ready-upload.tar.gz'],check=True)
SCRIPT = r'''
from pathlib import Path
import datetime,hashlib,json,os,shutil,subprocess,tarfile
base=Path('/var/www/pripyat-site')
backup=Path('/var/backups')/('yookassa-live-ready-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(mode=0o700);stage=backup/'stage';stage.mkdir()
shutil.copytree(base/'app',stage/'app')
for name in ['server/core/models/erasedaccounts.php','server/json/site_prices.json']:
 p=stage/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(base/name,p)
files=[]
with tarfile.open('/var/backups/pripyat-live-ready-upload.tar.gz') as tar:
 for member in tar.getmembers():
  assert member.isfile() and not member.name.startswith('/') and '..' not in Path(member.name).parts
  p=stage/member.name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(tar.extractfile(member).read());p.chmod(0o644)
  subprocess.run(['php','-l',str(p)],check=True,capture_output=True)
  if member.name!='payment-mysql-fixture.php':files.append(member.name)
# Temporary tables shadow the real table names only in this connection.
r=subprocess.run(['php',str(stage/'payment-mysql-fixture.php'),str(stage/'app/sitepayments.php')],check=True,capture_output=True,text=True)
print(r.stdout.strip())
native=Path('/var/www/stalker-native-prod')
protected=[native/'client/ver0_41/libs/index.js',native/'server/universal_pay.php',native/'server/ok_pay_callback.php',Path('/etc/pripyat/vk-ok-native-prod.json')]
def hashes():return {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
before=hashes();runtime=base/'private/site-runtime.json';oldbytes=runtime.read_bytes();c=json.loads(oldbytes)
assert c['payments']['require_test_payment'] is True
live=json.loads(Path('/etc/pripyat/yookassa-live.json').read_text())
assert str(live['shop_id'])=='1517337' and live['secret_key'].startswith('live_')
live.update(enabled=True,require_test_payment=False,live_checkout_enabled=False,receipt_automation_ready=False)
c['payments_live']=live
# Used when the active config is eventually switched, preserving old test settlements.
c['payments_previous']=[c['payments'].copy()]
shutil.copy2(runtime,backup/'runtime-before.json')
try:
 for name in files:
  target=base/name;saved=backup/'before'/name;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,saved)
  tmp=target.with_name(target.name+'.live-ready-tmp');shutil.copy2(stage/name,tmp);os.replace(tmp,target)
 st=runtime.stat();tmp=runtime.with_name('site-runtime.live-ready-tmp');tmp.write_text(json.dumps(c));os.chmod(tmp,st.st_mode&0o777);os.chown(tmp,st.st_uid,st.st_gid);os.replace(tmp,runtime)
 assert hashes()==before
 for name in files:assert hashlib.sha256((base/name).read_bytes()).digest()==hashlib.sha256((stage/name).read_bytes()).digest()
except Exception:
 for name in files:
  saved=backup/'before'/name
  if saved.exists():shutil.copy2(saved,base/name)
 runtime.write_bytes(oldbytes)
 raise
print(json.dumps({'backup':str(backup),'active_mode':'test','live_checkout_enabled':False,'native_unchanged':True,'schema_migrations':False,'service_restarts':False}))
'''
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',KEY,HOST,'python3','-'],input=SCRIPT,text=True,encoding='utf-8',capture_output=True)
if r.returncode:raise SystemExit(r.stderr)
print(r.stdout)
