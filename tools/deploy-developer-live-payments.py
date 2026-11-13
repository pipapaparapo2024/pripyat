"""Owner-authorized developer-only live YooKassa with manual NPD receipts; VK sandbox fix."""
from pathlib import Path
import subprocess,tarfile,tempfile
ROOT=Path(__file__).resolve().parents[1];KEY=str(Path.home()/'.ssh/id_ed25519_stalker');HOST='root@135.106.159.212'
files={
 'site/app/siteyookassa.php':'website/app/siteyookassa.php',
 'site/app/sitepaymentaccess.php':'website/app/sitepaymentaccess.php',
 'site/app/sitehttp.php':'website/app/sitehttp.php',
 'native/server/core/models/vkprodpayments.php':'server/core/models/vkprodpayments.php',
 'native/server/universal_pay.php':'server/native-prod-vk-pay.php',
 'site/payment-mysql-fixture.php':'tests/_php_fixtures/site-payment-mysql.php',
}
archive=Path(tempfile.gettempdir())/'pripyat-developer-live.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
 for name,source in files.items():tar.add(ROOT/source,arcname=name)
subprocess.run(['scp','-i',KEY,str(archive),HOST+':/var/backups/pripyat-developer-live-upload.tar.gz'],check=True)
script=r'''
from pathlib import Path
import json,datetime,subprocess,shutil,tarfile,hashlib,os,urllib.request,base64
backup=Path('/var/backups')/('developer-live-payments-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
stage=backup/'stage';stage.mkdir();site=Path('/var/www/pripyat-site');native=Path('/var/www/stalker-native-prod')
shutil.copytree(site/'app',stage/'site/app')
for name in ['server/core/models/erasedaccounts.php','server/json/site_prices.json']:
 p=stage/'site'/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(site/name,p)
members=[]
with tarfile.open('/var/backups/pripyat-developer-live-upload.tar.gz') as tar:
 for m in tar.getmembers():
  assert m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts
  p=stage/m.name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(tar.extractfile(m).read());p.chmod(0o644)
  subprocess.run(['php','-l',str(p)],check=True,capture_output=True)
  if not m.name.endswith('-fixture.php'):members.append(m.name)
r=subprocess.run(['php',str(stage/'site/payment-mysql-fixture.php'),str(stage/'site/app/sitepayments.php')],check=True,capture_output=True,text=True);print(r.stdout.strip())
runtime=site/'private/site-runtime.json';livepath=Path('/etc/pripyat/yookassa-live.json');nativepath=Path('/etc/pripyat/vk-ok-native-prod.json')
c=json.loads(runtime.read_text());live=json.loads(livepath.read_text());nc=json.loads(nativepath.read_text())
assert c['payments']['require_test_payment'] is True and str(live['shop_id'])=='1517337'
request=urllib.request.Request('https://api.yookassa.ru/v3/me',headers={'Authorization':'Basic '+base64.b64encode((str(live['shop_id'])+':'+live['secret_key']).encode()).decode()})
with urllib.request.urlopen(request,timeout=15) as response:
 me=json.load(response);assert me['account_id']=='1517337' and me['test'] is False and me['status']=='enabled'
live.update(enabled=True,require_test_payment=False,live_checkout_enabled=True,receipt_automation_ready=False,receipt_mode='manual',manual_receipts_acknowledged=True)
previous={}
for old in [c['payments']]+c.get('payments_previous',[]):previous[(str(old.get('shop_id')),old.get('require_test_payment'))]=old
c.update(payments=live,payments_live=live.copy(),payments_previous=list(previous.values()))
nc['payments']['vk_developer_sandbox']=True;nc['payments']['vk_sandbox_ids']=['382448269','438953352','184138040']
configs=[(runtime,c),(livepath,live),(nativepath,nc)]
targets=[(site if name.startswith('site/') else native)/name.split('/',1)[1] for name in members]
protected=[native/'client/ver0_41/libs/index.js',native/'server/ok_pay_callback.php']
before=[hashlib.sha256(p.read_bytes()).digest() for p in protected]
saved={}
for i,p in enumerate(targets+[p for p,cfg in configs]):
 dest=backup/'before'/str(i);dest.parent.mkdir(exist_ok=True);shutil.copy2(p,dest);saved[p]=dest
def atomic(p,data):
 st=p.stat();temp=p.with_name(p.name+'.developer-live-tmp');temp.write_bytes(data);os.chmod(temp,st.st_mode&0o777);os.chown(temp,st.st_uid,st.st_gid);os.replace(temp,p)
try:
 for name,target in zip(members,targets):atomic(target,(stage/name).read_bytes())
 for p,cfg in configs:atomic(p,json.dumps(cfg).encode())
 for name,target in zip(members,targets):assert hashlib.sha256(target.read_bytes()).digest()==hashlib.sha256((stage/name).read_bytes()).digest()
 assert before==[hashlib.sha256(p.read_bytes()).digest() for p in protected]
 subprocess.run(['systemctl','reload','pripyat-native-prod-fpm.service'],check=True)
except Exception:
 for p,old in saved.items():atomic(p,old.read_bytes())
 subprocess.run(['systemctl','reload','pripyat-native-prod-fpm.service'],check=False)
 raise
print(json.dumps({'backup':str(backup),'yookassa_mode':'live','access':'explicit_developer_allowlist','receipts':'manual_owner_acknowledged','automatic_receipts':False,'vk_sandbox':'three_explicit_developers_only','shared_services_restarted':False,'schema_migrations':False}))
'''
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',KEY,HOST,'python3','-'],input=script,text=True,encoding='utf-8',capture_output=True)
if r.returncode:raise SystemExit(r.stderr)
print(r.stdout)
