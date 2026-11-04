"""Update website HTML/CSS only, preserving HTTPS, all app configs and databases."""
from pathlib import Path
import importlib.util,base64
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
files={name:base64.b64encode((ROOT/'website'/name).read_bytes()).decode() for name in ['index.html','style.css','login.js','requisites/index.html','reward/index.html']}
files['assets/zone-release.jpg']=base64.b64encode((ROOT/'website/assets/zone-release.jpg').read_bytes()).decode()
p.remote('root',r'''
from pathlib import Path
import datetime,shutil,base64,subprocess,json
base=Path('/var/www/pripyat-site/public');assert base.is_dir()
backup=Path('/var/backups')/('pripyat-site-static-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
for name,value in FILES.items():
 target=base/name;target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists():
  old=backup/name;old.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,old)
 tmp=base/(name+'.tmp');tmp.write_bytes(base64.b64decode(value));tmp.chmod(0o644);tmp.replace(target)
subprocess.run(['nginx','-t'],check=True,capture_output=True)
print(json.dumps({'published':list(FILES),'backup':str(backup),'https_config_changed':False,'sql_executed':False}))
'''.replace('FILES',repr(files)))
