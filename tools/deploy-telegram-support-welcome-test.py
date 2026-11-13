"""Deploy only the reviewed bot handler/environment files to Telegram TEST."""
from pathlib import Path
import base64, hashlib, importlib.util, json

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('provision', ROOT / 'tools/provision-new-server.py')
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)

paths = [
    ROOT / 'server/core/models/telegrambothandler.php',
    ROOT / 'server/core/models/telegramenvironment.php',
]
files = {path.relative_to(ROOT).as_posix(): base64.b64encode(path.read_bytes()).decode() for path in paths}
expected = {name: hashlib.sha256(base64.b64decode(data)).hexdigest() for name, data in files.items()}
payload = json.dumps({'files': files, 'expected': expected})

REMOTE = r'''
from pathlib import Path
import base64,datetime,grp,hashlib,json,os,pwd,shutil,subprocess,tempfile

DATA=json.loads(PAYLOAD)
base=Path('/var/www/stalker-tg-test/public').resolve()
config=Path('/etc/pripyat/telegram-test.php')
assert base==Path('/var/www/stalker-tg-test/public') and config.is_file()
probe=subprocess.run(['php','-r',"$c=require '/etc/pripyat/telegram-test.php';echo json_encode(['enabled'=>$c['enabled']??false,'environment'=>$c['environment']??'','database'=>$c['database']??'']);"],capture_output=True,text=True,check=True)
runtime=json.loads(probe.stdout)
assert runtime=={'enabled':True,'environment':'test','database':'stalker_telegram_test'}
owner=pwd.getpwnam('pripyat-tg-test');group=grp.getgrnam('pripyat-tg-test')
backup=Path('/var/backups')/('telegram-support-welcome-test-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(mode=0o700)
changed=[]
def run(args):
    result=subprocess.run(args,capture_output=True,text=True)
    if result.returncode:raise RuntimeError('Deploy validation failed: '+args[0])
for name,encoded in DATA['files'].items():
    target=(base/name).resolve();assert target.is_relative_to(base)
    previous=target.read_bytes() if target.is_file() else None
    meta=target.stat() if target.exists() else None
    old=backup/name;old.parent.mkdir(parents=True,exist_ok=True)
    if previous is not None:shutil.copy2(target,old)
    if previous is not None and hashlib.sha256(previous).hexdigest()==DATA['expected'][name]:continue
    content=base64.b64decode(encoded);assert hashlib.sha256(content).hexdigest()==DATA['expected'][name]
    fd,tmp=tempfile.mkstemp(prefix='.'+target.name,dir=target.parent)
    try:
        os.fchmod(fd,(meta.st_mode & 0o777) if meta else 0o644);os.fchown(fd,owner.pw_uid,group.gr_gid)
        with os.fdopen(fd,'wb') as stream:stream.write(content)
        os.replace(tmp,target);changed.append((target,old,meta.st_uid,meta.st_gid,meta.st_mode & 0o777) if meta else (target,None,None,None,None))
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
try:
    for target,*_ in changed:run(['php','-l',str(target)])
    for name,digest in DATA['expected'].items():
        if hashlib.sha256((base/name).read_bytes()).hexdigest()!=digest:raise RuntimeError('Checksum mismatch: '+name)
    run(['systemctl','reload','php8.5-fpm'])
except Exception:
    for target,old,uid,gid,mode in reversed(changed):
        if old is None:
            if target.exists():target.unlink()
            continue
        data=old.read_bytes();fd,tmp=tempfile.mkstemp(prefix='.'+target.name,dir=target.parent)
        try:
            os.fchmod(fd,mode);os.fchown(fd,uid,gid)
            with os.fdopen(fd,'wb') as stream:stream.write(data)
            os.replace(tmp,target)
        finally:
            if os.path.exists(tmp):os.unlink(tmp)
    subprocess.run(['systemctl','reload','php8.5-fpm'],capture_output=True)
    raise
print(json.dumps({'environment':'telegram_test','files':sorted(DATA['files']),'php_lint':'passed','database_changed':False,'prod_changed':False,'backup':str(backup)}))
'''.replace('PAYLOAD', repr(payload))

provision.remote('root', REMOTE)
