"""Publish native TEST client only, with native billing disabled. No SQL/PROD changes."""
from pathlib import Path
import importlib.util,base64,re,argparse
parser=argparse.ArgumentParser()
parser.add_argument('--enable-vk-test-payments',action='store_true')
args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
files={f.name:base64.b64encode(f.read_bytes()).decode() for f in (ROOT/'_client/development/libs').glob('*.js')}
p.remote('root',r'''
from pathlib import Path
import base64,shutil,datetime,re,json
enable_vk=ENABLE_VK
if enable_vk:
 config=json.loads(Path('/etc/pripyat/vk-ok-native-test.json').read_text())
 assert config.get('environment')=='test' and config.get('vk_test_callbacks_enabled') is True and str(config.get('api_id'))=='54679940','VK TEST callbacks must be configured first'
base=Path('/var/www/stalker-native-test/client/ver0_41');backup=Path('/var/backups')/('pripyat-native-client-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
for name,data in FILES.items():
 dest=base/'libs'/name
 if dest.exists():shutil.copy2(dest,backup/name)
 tmp=dest.with_suffix('.js.tmp');tmp.write_bytes(base64.b64decode(data));tmp.chmod(0o644);tmp.replace(dest)
html=base/'index.html';shutil.copy2(html,backup/'index.html');text=html.read_text();version=int(re.search(r'index\.js\?v=(\d+)',text)[1])+1
text=re.sub(r'index\.js\?v=\d+','index.js?v='+str(version),text)
if '__nativeTestPaymentsDisabled' not in text:text=text.replace('</head>','<script>window.__nativeTestPaymentsDisabled=true;</script></head>')
text=re.sub(r'<script>window\.__nativeTestVkPaymentsEnabled=(?:true|false);</script>','',text)
text=text.replace('</head>','<script>window.__nativeTestVkPaymentsEnabled='+('true' if enable_vk else 'false')+';</script></head>')
html.write_text(text);print(json.dumps({'native_test_version':version,'vk_test_payments':enable_vk,'ok_payments_disabled':True,'backup':str(backup),'sql_executed':False,'prod_changed':False}))
'''.replace('FILES',repr(files)).replace('ENABLE_VK',repr(args.enable_vk_test_payments)))
