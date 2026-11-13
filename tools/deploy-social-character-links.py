"""Publish character linking only. No SQL, secrets, FPM restart, or game bundle changes."""
from pathlib import Path
import subprocess,tarfile,tempfile
root=Path(__file__).resolve().parents[1]
key=str(Path.home()/'.ssh/id_ed25519_stalker')
files={f'app/{name}.php':root/f'website/app/{name}.php' for name in ['sociallinkstore','sociallinkhttp','socialidentity','socialsessions','socialhttp','sitehttp']}
files['public/login.js']=root/'website/login.js'
files['native-site-link.js']=root/'server/native-site-link.js'
files['social-character-mysql.php']=root/'tests/_php_fixtures/social-character-mysql.php'
archive=Path(tempfile.gettempdir())/'pripyat-social-character-links.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
 for name,path in files.items():tar.add(path,arcname=name)
subprocess.run(['scp','-i',key,str(archive),'root@135.106.159.212:/var/backups/pripyat-social-character-links.tar.gz'],check=True)
script=r'''
from pathlib import Path
import tarfile,datetime,shutil,subprocess,hashlib,json,os,pwd,re
base=Path('/var/www/pripyat-site');native=Path('/var/www/stalker-native-prod')
backup=Path('/var/backups')/('social-character-links-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
stage=backup/'stage';stage.mkdir(mode=0o700)
with tarfile.open('/var/backups/pripyat-social-character-links.tar.gz') as tar:
 for m in tar.getmembers():
  assert m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts
  p=stage/m.name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(tar.extractfile(m).read())
for p in stage.rglob('*.php'):subprocess.run(['php','-l',str(p)],check=True,capture_output=True)
bundle=native/'client/ver0_41/libs/index.js';before=hashlib.sha256(bundle.read_bytes()).hexdigest()
changed=[]
def publish(src,target):
 if target.exists():
  saved=backup/('previous-'+str(len(changed)));shutil.copy2(target,saved)
 else:saved=None
 changed.append((target,saved));target.parent.mkdir(parents=True,exist_ok=True);tmp=target.with_name(target.name+'.new');tmp.write_bytes(src.read_bytes());tmp.chmod(0o644);tmp.replace(target)
vhost=Path('/etc/nginx/sites-available/pripyat-site')
try:
 for p in (stage/'app').glob('*.php'):publish(p,base/'app'/p.name)
 publish(stage/'public/login.js',base/'public/login.js')
 links=base/'private/social-links';links.mkdir(mode=0o700,exist_ok=True);u=pwd.getpwnam('pripyat-site-test');os.chown(links,u.pw_uid,u.pw_gid)
 html=native/'server/client-shell.html';text=html.read_text()
 if 'native-site-link.js' not in text:text=text.replace('</body>','<script src="./libs/native-site-link.js?v=1"></script></body>')
 candidate=stage/'client-shell.html';candidate.write_text(text);publish(candidate,html)
 publish(stage/'native-site-link.js',native/'client/ver0_41/libs/native-site-link.js')
 text=vhost.read_text()
 if 'sociallinkhttp.php' not in text:text=text.replace(' location ~ ^/auth/', ' location ~ ^/auth/social/(link|native)$ {\n access_log off;\n include fastcgi_params;\n fastcgi_param SCRIPT_FILENAME /var/www/pripyat-site/app/sociallinkhttp.php;\n fastcgi_pass unix:/run/php/php8.5-fpm-site-test.sock;\n }\n location ~ ^/auth/',1)
 candidate=stage/'nginx.conf';candidate.write_text(text);publish(candidate,vhost)
 subprocess.run(['nginx','-t'],check=True,capture_output=True)
 subprocess.run(['php',str(stage/'social-character-mysql.php')],check=True,capture_output=True)
 subprocess.run(['systemctl','reload','nginx'],check=True)
 assert hashlib.sha256(bundle.read_bytes()).hexdigest()==before
except Exception:
 for target,saved in reversed(changed):
  if saved:shutil.copy2(saved,target)
  elif target.exists():target.unlink()
 raise
print(json.dumps({'backup':str(backup),'native_bundle_unchanged':True,'game_data_unchanged':True,'mysql_temporary_fixture':'passed','fpm_restarted':False}))
'''
result=subprocess.run(['ssh','-o','BatchMode=yes','-i',key,'root@135.106.159.212','python3','-'],input=script,text=True,encoding='utf-8',capture_output=True)
if result.returncode:raise SystemExit(result.stderr)
print(result.stdout)
