"""Publish website JS only, retaining old chunks for already-open game tabs."""
from pathlib import Path
import subprocess,tarfile,tempfile
root=Path(__file__).resolve().parents[1];key=str(Path.home()/'.ssh/id_ed25519_stalker')
archive=Path(tempfile.gettempdir())/'pripyat-site-client.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
 for p in (root/'_client/website-build/libs').glob('*.js'):tar.add(p,arcname=p.name)
subprocess.run(['scp','-q','-i',key,str(archive),'root@135.106.159.212:/var/backups/pripyat-site-client.tar.gz'],check=True)
script=r'''
from pathlib import Path
import tarfile,datetime,hashlib,re,shutil,json
base=Path('/var/www/pripyat-site');native=Path('/var/www/stalker-native-prod/client/ver0_41/libs/index.js')
before=hashlib.sha256(native.read_bytes()).hexdigest()
backup=Path('/var/backups')/('site-client-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
html=base/'game/index.html';shutil.copy2(html,backup/'index.html')
with tarfile.open('/var/backups/pripyat-site-client.tar.gz') as tar:
 for m in tar.getmembers():
  assert m.isfile() and '/' not in m.name and '..' not in m.name and m.name.endswith('.js')
  target=base/'game-libs'/m.name
  if target.exists():shutil.copy2(target,backup/m.name)
  temp=target.with_suffix('.new');temp.write_bytes(tar.extractfile(m).read());temp.chmod(0o644);temp.replace(target)
version=hashlib.sha256((base/'game-libs/index.js').read_bytes()).hexdigest()[:12]
text=html.read_text();assert re.search(r'libs/index\.js\?v=[^"\s]+',text)
temp=html.with_suffix('.new');temp.write_text(re.sub(r'libs/index\.js\?v=[^"\s]+','libs/index.js?v='+version,text));temp.chmod(0o644);temp.replace(html)
assert hashlib.sha256(native.read_bytes()).hexdigest()==before
print(json.dumps({'backup':str(backup),'website_version':version,'native_unchanged':True,'sql_executed':False,'service_restarted':False}))
'''
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',key,'root@135.106.159.212','python3','-'],input=script,text=True,encoding='utf-8',capture_output=True)
if r.returncode:raise SystemExit(r.stderr)
print(r.stdout)
