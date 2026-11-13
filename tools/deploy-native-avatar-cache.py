"""Add an authenticated own-avatar cache hook; keep native game/payment bundle intact."""
from pathlib import Path
import base64,subprocess
root=Path(__file__).resolve().parents[1]
model=base64.b64encode((root/'server/core/models/nativeavatarcache.php').read_bytes()).decode()
javascript=base64.b64encode((root/'server/native-avatar-sync.js').read_bytes()).decode()
code=r'''
from pathlib import Path
import base64,datetime,shutil,subprocess,os,pwd,hashlib,json
base=Path('/var/www/stalker-native-prod');users=base/'server/core/controllers/users.php';index=base/'server/client-shell.html';bundle=base/'client/ver0_41/libs/index.js';before=hashlib.sha256(bundle.read_bytes()).hexdigest()
backup=Path('/var/backups')/('native-avatar-cache-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
for p,n in [(users,'users.php'),(index,'index.html')]:shutil.copy2(p,backup/n)
model=base/'server/core/models/nativeavatarcache.php';model.write_bytes(base64.b64decode(MODEL));model.chmod(0o644)
text=users.read_text()
if 'function cacheAvatar()' not in text:
 text=text.replace("$this->permits = [", "$this->permits = ['cacheAvatar', ",1)
 method="""function cacheAvatar(){
 $url=$this->registry['user_params']['url']??null;$platform=$this->registry['platform']??'';
 if(!is_string($url)||!in_array($platform,['vk','ok'],true))return $this->registry['tools']->error(54);
 $this->registry['tools']->output(['ok'=>NativeAvatarCache::put($platform,(int)$this->registry['uid'],$url)]);
 }
 """
 assert 'function get(){' in text;text=text.replace('function get(){',method+'function get(){',1)
candidate=users.with_suffix('.candidate.php');candidate.write_text(text);candidate.chmod(0o644)
for p in [model,candidate]:subprocess.run(['php','-l',str(p)],check=True,capture_output=True)
candidate.replace(users)
script=base/'client/ver0_41/libs/native-avatar-sync.js';script.write_bytes(base64.b64decode(JAVASCRIPT));script.chmod(0o644)
html=index.read_text()
if 'native-avatar-sync.js' not in html:
 assert '</body>' in html;html=html.replace('</body>','<script src="./libs/native-avatar-sync.js?v=1"></script></body>');index.write_text(html)
cache=Path('/tmp/pripyat-native-avatar-cache');cache.mkdir(mode=0o755,exist_ok=True);u=pwd.getpwnam('pripyat-native-prod')
for world in ['vk','ok']:
 p=cache/world;p.mkdir(mode=0o755,exist_ok=True);os.chown(p,u.pw_uid,u.pw_gid)
subprocess.run(['systemctl','reload','pripyat-native-prod-fpm'],check=True)
assert hashlib.sha256(bundle.read_bytes()).hexdigest()==before
print(json.dumps({'backup':str(backup),'native_bundle_unchanged':True,'sql_executed':False}))
'''.replace('MODEL',repr(model)).replace('JAVASCRIPT',repr(javascript))
r=subprocess.run(['ssh','-o','BatchMode=yes','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'root@135.106.159.212','python3','-'],input=code,text=True,encoding='utf-8',capture_output=True)
if r.returncode:raise SystemExit(r.stderr+r.stdout)
print(r.stdout)
