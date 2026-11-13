"""Publish international phone syntax; retain provider proof and payment gates."""
from pathlib import Path
import subprocess,tarfile,tempfile
ROOT=Path(__file__).resolve().parents[1]
KEY=str(Path.home()/'.ssh/id_ed25519_stalker');HOST='root@135.106.159.212'
files={'app/sitephoneidentity.php':'website/app/sitephoneidentity.php','app/sitephoneactions.php':'website/app/sitephoneactions.php','app/sitehttp.php':'website/app/sitehttp.php','public/account/index.html':'website/account/index.html','identity-fixture.php':'tests/_php_fixtures/site-phone-identity.php','provider-fixture.php':'tests/_php_fixtures/site-phone-provider.php'}
archive=Path(tempfile.gettempdir())/'pripyat-international-phone.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
 for name,source in files.items():tar.add(ROOT/source,arcname=name)
subprocess.run(['scp','-i',KEY,str(archive),HOST+':/var/backups/pripyat-international-phone-upload.tar.gz'],check=True)
script=r'''
from pathlib import Path
import json,datetime,shutil,tarfile,subprocess,hashlib,os
base=Path('/var/www/pripyat-site');backup=Path('/var/backups')/('international-phone-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
stage=backup/'stage';stage.mkdir();shutil.copytree(base/'app',stage/'app')
members=[]
with tarfile.open('/var/backups/pripyat-international-phone-upload.tar.gz') as tar:
 for m in tar.getmembers():
  assert m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts
  p=stage/m.name;p.parent.mkdir(parents=True,exist_ok=True);data=tar.extractfile(m).read()
  if m.name.endswith('-fixture.php'):
   source='sitephoneidentity.php' if m.name.startswith('identity') else 'sitephoneprovider.php'
   data=data.replace(("__DIR__.'/../../website/app/"+source+"'").encode(),("__DIR__.'/app/"+source+"'").encode())
  p.write_bytes(data);p.chmod(0o644)
  if p.suffix=='.php':subprocess.run(['php','-l',str(p)],check=True,capture_output=True)
  if m.name.endswith('-fixture.php'):
   r=subprocess.run(['php',str(p)],check=True,capture_output=True,text=True);print(r.stdout.strip())
  else:members.append(m.name)
runtime=base/'private/site-runtime.json';before=hashlib.sha256(runtime.read_bytes()).digest()
c=json.loads(runtime.read_text());assert c['payments']['require_test_payment'] is True and c['payments_live']['live_checkout_enabled'] is False
native=Path('/var/www/stalker-native-prod/client/ver0_41/libs/index.js');native_before=hashlib.sha256(native.read_bytes()).digest()
try:
 for name in members:
  target=base/name;saved=backup/'before'/name;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,saved)
  tmp=target.with_name(target.name+'.international-tmp');shutil.copy2(stage/name,tmp);os.replace(tmp,target)
 for name in members:assert hashlib.sha256((base/name).read_bytes()).digest()==hashlib.sha256((stage/name).read_bytes()).digest()
 assert hashlib.sha256(runtime.read_bytes()).digest()==before and hashlib.sha256(native.read_bytes()).digest()==native_before
except Exception:
 for name in members:
  saved=backup/'before'/name
  if saved.exists():shutil.copy2(saved,base/name)
 raise
print(json.dumps({'backup':str(backup),'payment_config_unchanged':True,'native_unchanged':True,'schema_changes':False,'restarts':False}))
'''
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',KEY,HOST,'python3','-'],input=script,text=True,encoding='utf-8',capture_output=True)
if r.returncode:raise SystemExit(r.stderr)
print(r.stdout)
