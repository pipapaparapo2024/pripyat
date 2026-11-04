"""Publish isolated TEST callbacks; keep client billing and OK processing disabled."""
from pathlib import Path
import importlib.util,base64
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
sources={'server/universal_pay.php':'server/native-test-vk-pay.php','server/ok_pay_callback.php':'server/native-test-ok-pay.php','server/ok-pay-legacy-core.php':'server/ok_pay_callback.php','server/core/models/vktestpayments.php':'server/core/models/vktestpayments.php'}
files={name:base64.b64encode((ROOT/source).read_bytes()).decode() for name,source in sources.items()}
p.remote('root',r'''
from pathlib import Path
import base64,subprocess,datetime,shutil,json,os
base=Path('/var/www/stalker-native-test');assert base.is_dir()
backup=Path('/var/backups')/('native-test-payment-callbacks-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
for name,data in FILES.items():
 dest=base/name
 if dest.exists():
  old=backup/name;old.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest,old)
 tmp=dest.with_name(dest.name+'.tmp');tmp.write_bytes(base64.b64decode(data));tmp.chmod(0o644);subprocess.run(['php','-l',str(tmp)],check=True,capture_output=True);tmp.replace(dest)
config=Path('/etc/pripyat/vk-ok-native-test.json');shutil.copy2(config,backup/'config-before.json');(backup/'config-before.json').chmod(0o600)
c=json.loads(config.read_text());assert c['environment']=='test' and set(c['databases'])=={'stalker_test','stalker_ok_test'}
c['vk_test_callbacks_enabled']=True;c['ok_test_callbacks_enabled']=False
st=config.stat();tmp=config.with_suffix('.json.tmp');tmp.write_text(json.dumps(c));os.chown(tmp,st.st_uid,st.st_gid);tmp.chmod(0o640);tmp.replace(config)
site=Path('/etc/nginx/sites-available/test-pripyat-game.ru');text=site.read_text();shutil.copy2(site,backup/'nginx-before.conf')
for path in ['universal_pay.php','ok_pay_callback.php']:
 if 'location = /server/'+path not in text:
  needle=' location = /server/universal.php';assert needle in text
  text=text.replace(needle,' location = /server/'+path+' { include snippets/fastcgi-php.conf; fastcgi_pass unix:/run/php/php8.5-fpm-native-test.sock; }\n'+needle)
site.write_text(text)
try:subprocess.run(['nginx','-t'],check=True,capture_output=True)
except Exception:shutil.copy2(backup/'nginx-before.conf',site);raise
subprocess.run(['systemctl','reload','nginx'],check=True)
assert '__nativeTestPaymentsDisabled=true' in (base/'client/ver0_41/index.html').read_text()
print(json.dumps({'callbacks_published':True,'vk_accepts_only_signed_test_notifications':True,'ok_processing_enabled':False,'client_billing_enabled':False,'sql_executed':False,'prod_changed':False,'backup':str(backup)}))
'''.replace('FILES',repr(files)))
