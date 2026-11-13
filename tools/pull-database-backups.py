"""Daily off-server copy. Only manifests and fixed recognised filenames are accepted."""
from pathlib import Path
import subprocess,json,hashlib,gzip,datetime,re,os,tarfile,time

DEST=Path.home()/'.pripyat-backups/daily'
KEY=Path.home()/'.ssh/id_ed25519_stalker'
SSH=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','-i',str(KEY),'root@135.106.159.212']
def main():
 DEST.mkdir(parents=True,exist_ok=True)
 now=datetime.datetime.now(datetime.timezone.utc)
 legacy=Path.home()/'Desktop/vk_game/projects_2026/db_backups/new-server-20261103'
 if legacy.is_dir():
  for p in legacy.iterdir():
   if p.is_symlink() or not p.is_file() or not re.fullmatch(r'(?:stalker[a-z_]*-\d{8}T\d{6}Z\.sql\.gz|game-databases-\d{8}T\d{6}Z\.zip)',p.name):continue
   if now.timestamp()-p.stat().st_mtime>30*86400:p.unlink()
 # Retention still runs when the remote server is unreachable.
 for p in DEST.iterdir():
  if p.is_symlink() or not p.is_file():continue
  m=re.search(r'(\d{8}T\d{6}Z)',p.name)
  if m and (now-datetime.datetime.strptime(m[1],'%Y%m%dT%H%M%SZ').replace(tzinfo=datetime.timezone.utc)).total_seconds()>30*86400:p.unlink()
 manifest=json.loads(subprocess.check_output(SSH+['cat /var/backups/pripyat-database/latest.json'],timeout=30))
 stamp=manifest['stamp']
 if not re.fullmatch(r'\d{8}T\d{6}Z',stamp) or len(manifest['files'])!=8:raise RuntimeError('Invalid manifest')
 if (now-datetime.datetime.strptime(stamp,'%Y%m%dT%H%M%SZ').replace(tzinfo=datetime.timezone.utc)).total_seconds()>30*86400:raise RuntimeError('Remote backup expired')
 downloaded=0;missing=[]
 for record in manifest['files']:
  name=record['name']
  if not re.fullmatch(r'(?:stalker(?:_ok|_telegram|_site)?(?:_test)?-'+stamp+r'\.sql\.gz|privacy-ledger-'+stamp+r'\.json)',name):raise RuntimeError('Unsafe filename')
  target=DEST/name
  if not target.is_file() or hashlib.file_digest(target.open('rb'),'sha256').hexdigest()!=record['sha256']:missing.append(record)
 if missing:
  pack=DEST/'download.tar.partial'
  try:
   for attempt in range(3):
    with pack.open('wb') as stream:
     result=subprocess.run(SSH+['tar -C /var/backups/pripyat-database -cf - '+' '.join(r['name'] for r in missing)],stdout=stream,stderr=subprocess.PIPE,timeout=1800)
    if result.returncode==0:break
    if attempt==2:raise RuntimeError('Remote backup download failed')
    time.sleep(2)
   expected={r['name']:r for r in missing}
   with tarfile.open(pack,'r:') as tar:
    for member in tar:
     if not member.isfile() or member.name not in expected:raise RuntimeError('Unsafe archive member')
     record=expected.pop(member.name);target=DEST/member.name;partial=target.with_suffix(target.suffix+'.partial')
     try:
      with partial.open('wb') as out:
       import shutil
       shutil.copyfileobj(tar.extractfile(member),out)
      if partial.stat().st_size!=record['size'] or hashlib.file_digest(partial.open('rb'),'sha256').hexdigest()!=record['sha256']:raise RuntimeError('Checksum mismatch')
      if member.name.endswith('.gz'):
       with gzip.open(partial,'rb') as f:
        while f.read(1024*1024):pass
      else:json.loads(partial.read_text())
      partial.replace(target);downloaded+=1
     finally:
      if partial.exists():partial.unlink()
   if expected:raise RuntimeError('Incomplete backup archive')
  finally:
   if pack.exists():pack.unlink()
 (DEST/'latest.json').write_text(json.dumps(manifest))
 # Refresh the independent erasure ledger, including erasures after this snapshot.
 data=subprocess.check_output(SSH+['cat /var/lib/pripyat-privacy/deletions.json'],timeout=30)
 ledger=json.loads(data);assert isinstance(ledger.get('entries'),dict)
 tmp=DEST/'deletions-current.new';tmp.write_bytes(data);tmp.replace(DEST/'deletions-current.json')
 print(json.dumps({'verified_files':len(manifest['files']),'downloaded':downloaded,'stamp':stamp,'independent_copy':True}))

if __name__=='__main__':main()
