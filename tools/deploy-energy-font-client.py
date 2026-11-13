"""Client-only publication to native PROD and website. No PHP, SQL or access changes."""
from pathlib import Path
import subprocess,tarfile,tempfile
root=Path(__file__).resolve().parents[1];key=str(Path.home()/'.ssh/id_ed25519_stalker')
archive=Path(tempfile.gettempdir())/'pripyat-energy-font-client.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
 tar.add(root/'_client/development/libs/index.js',arcname='native/index.js')
 for p in (root/'_client/website-build/libs').glob('*.js'):tar.add(p,arcname='website/'+p.name)
subprocess.run(['scp','-q','-i',key,str(archive),'root@135.106.159.212:/var/backups/pripyat-energy-font-client.tar.gz'],check=True)
script=r'''
from pathlib import Path
import subprocess,tarfile,datetime,hashlib,json,re,shutil
native=Path('/var/www/stalker-native-prod');site=Path('/var/www/pripyat-site')
configs=[Path('/etc/pripyat/vk-ok-native-prod.json'),site/'private/site-runtime.json']
before=[hashlib.sha256(p.read_bytes()).hexdigest() for p in configs]
backup=Path('/var/backups')/('pripyat-energy-font-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
changed=[]
def publish(data,target):
 if target.exists():
  saved=backup/str(target).lstrip('/');saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,saved)
 else:saved=None
 changed.append((target,saved));tmp=target.with_name(target.name+'.new');tmp.write_bytes(data);tmp.chmod(0o644);tmp.replace(target)
try:
 with tarfile.open('/var/backups/pripyat-energy-font-client.tar.gz') as tar:
  for m in tar.getmembers():
   parts=Path(m.name).parts;assert m.isfile() and len(parts)==2 and parts[0] in ['native','website'] and parts[1].endswith('.js') and '..' not in parts
   target=(native/'client/ver0_41/libs' if parts[0]=='native' else site/'game-libs')/parts[1]
   publish(tar.extractfile(m).read(),target)
 html=native/'server/client-shell.html';text=html.read_text();match=re.search(r'index\.js\?v=(\d+)',text);assert match;version=int(match[1])+1
 publish(re.sub(r'index\.js\?v=\d+','index.js?v='+str(version),text).encode(),html)
 html=site/'game/index.html';text=html.read_text();assert re.search(r'libs/index\.js\?v=[^"\s]+',text)
 stamp=hashlib.sha256((site/'game-libs/index.js').read_bytes()).hexdigest()[:12]
 publish(re.sub(r'libs/index\.js\?v=[^"\s]+','libs/index.js?v='+stamp,text).encode(),html)
 assert [hashlib.sha256(p.read_bytes()).hexdigest() for p in configs]==before
 print(json.dumps({'backup':str(backup),'native_version':version,'website_version':stamp,'configs_unchanged':True,'sql_executed':False,'services_restarted':False}))
except Exception:
 for target,saved in reversed(changed):
  if saved:shutil.copy2(saved,target)
  elif target.exists():target.unlink()
 raise
'''
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',key,'root@135.106.159.212','python3','-'],input=script,text=True,encoding='utf-8',capture_output=True)
if r.returncode:raise SystemExit(r.stderr)
print(r.stdout)
