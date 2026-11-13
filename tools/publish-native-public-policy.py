"""Stage explicit public-capable policy, retaining closed configuration until release."""
from pathlib import Path
import base64,subprocess
root=Path(__file__).resolve().parents[1]
files={name:base64.b64encode((root/name).read_bytes()).decode() for name in ['server/core/models/nativeprodboundary.php','server/core/models/nativeprodregistrybootstrap.php','server/core/models/vkprodpayments.php']}
code=r'''
from pathlib import Path
import datetime,shutil,base64,subprocess,json
base=Path('/var/www/stalker-native-prod');b=Path('/var/backups')/('native-public-policy-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));b.mkdir(mode=0o700)
staged=[]
for name,data in FILES.items():
 p=base/name;old=b/name;old.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,old);candidate=b/(name+'.new');candidate.write_bytes(base64.b64decode(data));subprocess.run(['php','-l',str(candidate)],capture_output=True,check=True);staged.append((p,candidate))
p=base/'server/universal_pay.php';shutil.copy2(p,b/'universal_pay.php');s=p.read_text();old="$c['access']['vk']['ids'],$sandbox)";assert old in s;s=s.replace(old,"$c['access']['vk']['ids'],$sandbox,($c['public_access']??false)===true)")
candidate=b/'universal_pay.new.php';candidate.write_text(s);subprocess.run(['php','-l',str(candidate)],capture_output=True,check=True);staged.append((p,candidate))
for p,candidate in staged:p.write_bytes(candidate.read_bytes());p.chmod(0o644)
subprocess.run(['systemctl','reload','pripyat-native-prod-fpm'],check=True)
print(json.dumps({'backup':str(b),'files':len(staged),'public_config_not_activated':True}))
'''.replace('FILES',repr(files))
r=subprocess.run(['ssh','-o','ConnectTimeout=10','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','python3','-'],input=code,text=True,encoding='utf-8',capture_output=True)
if r.returncode:raise SystemExit(r.stderr)
print(r.stdout)
