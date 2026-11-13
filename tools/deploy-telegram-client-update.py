"""Publish client-only changes to existing Telegram TEST on the new VPS."""
from pathlib import Path
import subprocess,tarfile,tempfile,hashlib,json
root=Path(__file__).resolve().parents[1]
libs=root/'_client/telegram-build/libs'
assert (libs/'index.js').is_file()
archive=Path(tempfile.gettempdir())/'pripyat-telegram-client-update.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
 for f in libs.glob('*.js'):tar.add(f,arcname='libs/'+f.name)
 for name in ['левая рука.png','левая рука.png.webp']:tar.add(root/'assets/images'/name,arcname='images/'+name)
ssh=['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212']
subprocess.run(['scp','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),str(archive),'root@135.106.159.212:/var/backups/pripyat-telegram-client-update.tar.gz'],check=True)
code=r'''
from pathlib import Path
import datetime,tarfile,shutil,re,hashlib,json
base=Path('/var/www/stalker-tg-test/public');assert base.is_dir()
native=Path('/var/www/stalker-native-prod/client/ver0_41/libs/index.js');before=hashlib.sha256(native.read_bytes()).hexdigest()
backup=Path('/var/backups')/('telegram-client-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
index=base/'index.html';shutil.copy2(index,backup/'index.html')
with tarfile.open('/var/backups/pripyat-telegram-client-update.tar.gz') as tar:
 for m in tar.getmembers():
  assert m.isfile() and len(Path(m.name).parts)==2 and ((Path(m.name).parts[0]=='libs' and Path(m.name).suffix=='.js') or m.name in ['images/левая рука.png','images/левая рука.png.webp'])
  target=base/m.name
  if target.exists():
   old=backup/m.name;old.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,old)
  target.write_bytes(tar.extractfile(m).read());target.chmod(0o644)
text=index.read_text();match=re.search(r'index\.js\?v=([A-Za-z0-9._-]+)',text);assert match
version='stars-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
text=re.sub(r'index\.js\?v=[A-Za-z0-9._-]+','index.js?v='+version,text)
style='<style id="telegram-dark-backdrop">body{background:#000!important;isolation:isolate}body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(rgba(0,0,0,.78),rgba(0,0,0,.78)),url("./images/maintenance-background.jpg?v=2") center/cover no-repeat;}</style>'
if 'id="telegram-dark-backdrop"' in text:text=re.sub(r'<style id="telegram-dark-backdrop">.*?</style>',lambda _:style,text,flags=re.S)
else:text=text.replace('</head>',style+'</head>')
index.write_text(text)
assert hashlib.sha256(native.read_bytes()).hexdigest()==before
print(json.dumps({'backup':str(backup),'version':version,'native_bundle_unchanged':True,'database_changed':False,'service_restarted':False}))
'''
r=subprocess.run(ssh+['python3','-'],input=code,text=True,encoding='utf-8',capture_output=True)
if r.returncode:raise SystemExit(r.stderr)
print(r.stdout)
