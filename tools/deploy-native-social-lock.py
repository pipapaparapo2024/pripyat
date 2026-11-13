"""Reviewed minimal native PROD session-lock update; no SQL, no client/payment changes."""
from pathlib import Path
import subprocess,base64,json
root=Path(__file__).resolve().parents[1]
name='nativeprodregistrybootstrap.php'
original=subprocess.check_output(['git','show','HEAD:server/core/models/'+name],cwd=root).decode().replace('\r\n','\n')
files={n:base64.b64encode((root/'server/core/models'/n).read_bytes()).decode() for n in [name,'nativeplayersessionlock.php']}
code=r'''
from pathlib import Path
import base64,subprocess,datetime,shutil,hashlib,json
base=Path('/var/www/stalker-native-prod/server/core/models');target=base/'nativeprodregistrybootstrap.php'
current=target.read_text().replace('\r\n','\n');expected=ORIGINAL
assert current==expected or 'NativePlayerSessionLock::acquire' in current,'Native file changed independently; review required'
client=Path('/var/www/stalker-native-prod/client/ver0_41/libs/index.js');before=hashlib.sha256(client.read_bytes()).hexdigest()
backup=Path('/var/backups')/('native-social-lock-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
for name,data in FILES.items():
 p=base/name
 if p.exists():shutil.copy2(p,backup/name)
 tmp=base/(name+'.candidate');tmp.write_bytes(base64.b64decode(data));tmp.chmod(0o644)
 subprocess.run(['php','-l',str(tmp)],check=True,capture_output=True)
for name in FILES:(base/(name+'.candidate')).replace(base/name)
subprocess.run(['systemctl','reload','pripyat-native-prod-fpm'],check=True)
assert hashlib.sha256(client.read_bytes()).hexdigest()==before
print(json.dumps({'backup':str(backup),'native_client_unchanged':True,'only_service_reloaded':'pripyat-native-prod-fpm','sql_executed':False}))
'''.replace('ORIGINAL',repr(original)).replace('FILES',repr(files))
result=subprocess.run(['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','python3','-'],input=code,text=True,encoding='utf-8',capture_output=True)
if result.returncode:raise SystemExit(result.stderr+result.stdout)
print(result.stdout)
