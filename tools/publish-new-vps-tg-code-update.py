"""Update TG TEST PHP/JS only; preserve assets, credentials, DBs, and all other environments."""
from pathlib import Path
import importlib.util,base64
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
names=['server/telegram-login.php','server/core/controllers/rewardlinks.php','server/core/models/rewardlinktargets.php','server/core/models/rewardlinkpublisher.php','server/core/models/telegrambothandler.php']
files={name:base64.b64encode((ROOT/name).read_bytes()).decode() for name in names}
for f in (ROOT/'_client/telegram-build/libs').glob('*.js'):files['libs/'+f.name]=base64.b64encode(f.read_bytes()).decode()
p.remote('root',r'''
from pathlib import Path
import base64,datetime,shutil,subprocess,re,json,hashlib
base=Path('/var/www/stalker-tg-test/public');assert base.is_dir()
backup=Path('/var/backups')/('pripyat-tg-code-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
for name,value in FILES.items():
 dest=base/name
 if dest.exists():
  old=backup/name;old.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest,old)
 dest.parent.mkdir(parents=True,exist_ok=True)
 tmp=dest.with_name(dest.name+'.tmp');tmp.write_bytes(base64.b64decode(value));tmp.chmod(0o644)
 if name.endswith('.php'):subprocess.run(['php','-l',str(tmp)],check=True,capture_output=True)
 tmp.replace(dest)
html=base/'index.html';shutil.copy2(html,backup/'index-before.html')
text=html.read_text();version=int(re.search(r'index\.js\?v=(\d+)',text)[1])+1
html.write_text(re.sub(r'index\.js\?v=\d+','index.js?v='+str(version),text))
manifest={name:hashlib.sha256((base/name).read_bytes()).hexdigest() for name in FILES};(backup/'manifest.json').write_text(json.dumps(manifest))
print(json.dumps({'telegram_test_version':version,'files_updated':len(FILES),'sql_executed':False,'prod_bot_changed':False,'backup':str(backup)}))
'''.replace('FILES',repr(files)))
