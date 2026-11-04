"""Create current backup of seven game DBs and copy it outside the repo. No SQL mutations."""
from pathlib import Path
import importlib.util,subprocess,json,re,hashlib,gzip,zipfile
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
code=r'''
from pathlib import Path
import subprocess,json,hashlib,gzip,re,zipfile
subprocess.run(['/usr/local/sbin/pripyat-platform-backup'],check=True,capture_output=True)
base=Path('/var/backups/pripyat-database');files=sorted(base.glob('*.sql.gz'))
stamp=max(re.search(r'-(\d{8}T\d{6}Z)\.sql\.gz$',f.name)[1] for f in files)
selected=[f for f in files if f.name.endswith('-'+stamp+'.sql.gz')];assert len(selected)==7
for f in selected:
 with gzip.open(f,'rb') as source:assert source.read(50)
archive=base/('game-databases-'+stamp+'.zip')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as z:
 for f in selected:z.write(f,f.name)
archive.chmod(0o600)
print(json.dumps({'files':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in selected},'archive':archive.name,'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
'''
r=subprocess.run(p.SSH+['root@'+p.HOST,'python3 -'],input=code,text=True,encoding='utf-8',capture_output=True,timeout=90)
if r.returncode:raise RuntimeError('Backup creation failed; private diagnostics suppressed')
metadata=json.loads(r.stdout);manifest=metadata['files']
dest=Path.home()/'Desktop/vk_game/projects_2026/db_backups/new-server-20261103';dest.mkdir(parents=True,exist_ok=True)
for name in manifest:assert re.fullmatch(r'[a-z_]+-\d{8}T\d{6}Z\.sql\.gz',name)
archive=metadata['archive'];assert re.fullmatch(r'game-databases-\d{8}T\d{6}Z\.zip',archive)
subprocess.run(['scp','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'-o','BatchMode=yes','-o','ConnectTimeout=12','root@'+p.HOST+':/var/backups/pripyat-database/'+archive,str(dest/archive)],check=True)
assert hashlib.sha256((dest/archive).read_bytes()).hexdigest()==metadata['archive_sha256']
with zipfile.ZipFile(dest/archive) as z:
 assert set(z.namelist())==set(manifest)
 for name in manifest:(dest/name).write_bytes(z.read(name))
for name,digest in manifest.items():
 assert hashlib.sha256((dest/name).read_bytes()).hexdigest()==digest
 with gzip.open(dest/name,'rb') as source:assert source.read(50)
print('Verified local gzip/SHA256 backups:',len(manifest),'files in',dest)
