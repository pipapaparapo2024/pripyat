"""Publish reviewed client assets to existing closed native PROD only. No SQL/PHP/payment changes."""
from pathlib import Path
import subprocess,tarfile,tempfile
root=Path(__file__).resolve().parents[1];archive=Path(tempfile.gettempdir())/'pripyat-closed-native-hand.tar.gz'
files={'client/ver0_41/libs/index.js':root/'_client/development/libs/index.js'}
for name in ['левая рука.png','левая рука.png.webp']:files['client/ver0_41/images/'+name]=root/'assets/images'/name
with tarfile.open(archive,'w:gz') as tar:
 for name,p in files.items():tar.add(p,arcname=name)
ssh=['ssh','-o','ConnectTimeout=10','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212']
subprocess.run(['scp','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),str(archive),'root@135.106.159.212:/var/backups/pripyat-closed-native-hand.tar.gz'],check=True)
code=r'''
from pathlib import Path
import datetime,tarfile,shutil,json,re,hashlib
base=Path('/var/www/stalker-native-prod');config=Path('/etc/pripyat/vk-ok-native-prod.json');before=config.read_bytes();c=json.loads(before)
assert c['enabled'] is True
assert 0<len(c['access']['vk']['ids'])<=10 and 0<len(c['access']['ok']['ids'])+len(c['access']['ok'].get('native_ids',[]))<=10
b=Path('/var/backups')/('closed-native-hand-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));b.mkdir(mode=0o700)
html=base/'server/client-shell.html';shutil.copy2(html,b/'client-shell.html')
with tarfile.open('/var/backups/pripyat-closed-native-hand.tar.gz') as tar:
 for m in tar.getmembers():
  assert m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts
  p=base/m.name;dest=b/m.name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest);p.write_bytes(tar.extractfile(m).read());p.chmod(0o644)
s=html.read_text();match=re.search(r'index\.js\?v=(\d+)',s);assert match
version=int(match[1])+1;html.write_text(re.sub(r'index\.js\?v=\d+','index.js?v='+str(version),s))
assert config.read_bytes()==before
print(json.dumps({'backup':str(b),'version':version,'access_unchanged':True,'sql_executed':False,'services_restarted':False}))
'''
r=subprocess.run(ssh+['python3','-'],input=code,text=True,encoding='utf-8',capture_output=True)
if r.returncode:raise SystemExit(r.stderr)
print(r.stdout)
