"""Update private closed PROD client only; preserve access/payment flags and DNS."""
from pathlib import Path
import importlib.util,base64,hashlib
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
files={f.name:base64.b64encode(f.read_bytes()).decode() for f in (ROOT/'_client/development/libs').glob('*.js')}
expected=hashlib.sha256((ROOT/'_client/development/libs/index.js').read_bytes()).hexdigest()
p.remote('root',r'''
from pathlib import Path
import base64,shutil,datetime,re,json,hashlib
base=Path('/var/www/stalker-native-prod');config=json.loads(Path('/etc/pripyat/vk-ok-native-prod.json').read_text());assert config['environment']=='prod' and config['configuration_status']=='closed_loopback_staged'
backup=Path('/var/backups')/('closed-prod-client-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
for name,data in FILES.items():
 dest=base/'client/ver0_41/libs'/name
 if dest.exists():shutil.copy2(dest,backup/name)
 tmp=dest.with_suffix('.js.tmp');tmp.write_bytes(base64.b64decode(data));tmp.chmod(0o644);tmp.replace(dest)
html=base/'server/client-shell.html';shutil.copy2(html,backup/'client-shell.html');text=html.read_text();version=int(re.search(r'index\.js\?v=(\d+)',text)[1])+1;text=re.sub(r'index\.js\?v=\d+','index.js?v='+str(version),text);html.write_text(text)
assert hashlib.sha256((base/'client/ver0_41/libs/index.js').read_bytes()).hexdigest()=='EXPECTED'
print(json.dumps({'private_closed_prod_version':version,'bundle_hash_matches':True,'access_payment_dns_changed':False,'test_tg_changed':False,'backup':str(backup)}))
'''.replace('FILES',repr(files)).replace('EXPECTED',expected))
