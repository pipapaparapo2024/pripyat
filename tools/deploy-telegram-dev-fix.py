"""Publish only Telegram TEST controller/gateway fixes; no native/SQL/service changes."""
from pathlib import Path
import subprocess,base64,json
root=Path(__file__).resolve().parents[1]
files={name:base64.b64encode((root/name).read_bytes()).decode() for name in ['server/core/controllers/users.php','server/core/controllers/bosses.php','server/core/models/telegramgateway.php','server/core/models/telegramauth.php','server/telegram-api.php','server/telegram-login.php','server/core/models/telegrambothandler.php']}
code=r'''
from pathlib import Path
import base64,datetime,subprocess,shutil,hashlib,json
base=Path('/var/www/stalker-tg-test/public');assert base.is_dir()
native=Path('/var/www/stalker-native-prod/client/ver0_41/libs/index.js');before=hashlib.sha256(native.read_bytes()).hexdigest()
backup=Path('/var/backups')/('telegram-dev-fix-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
staged=[]
for name,data in FILES.items():
 target=base/name;assert target.is_file()
 old=backup/name;old.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,old)
 candidate=backup/(name+'.candidate');candidate.write_bytes(base64.b64decode(data));candidate.chmod(0o600)
 subprocess.run(['php','-l',str(candidate)],capture_output=True,check=True);staged.append((target,candidate))
for target,candidate in staged:target.write_bytes(candidate.read_bytes());target.chmod(0o644)
assert hashlib.sha256(native.read_bytes()).hexdigest()==before
print(json.dumps({'backup':str(backup),'php_files':len(staged),'native_bundle_unchanged':True,'sql_executed':False,'services_restarted':False}))
'''.replace('FILES',repr(files))
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','python3','-'],input=code,text=True,encoding='utf-8',capture_output=True)
if r.returncode:raise SystemExit(r.stderr)
print(r.stdout)
