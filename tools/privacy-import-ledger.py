"""Root-only restore prerequisite: merge the independent deletion ledger, never replace it."""
from pathlib import Path
import json,os,sys,hashlib,fcntl,subprocess
if __name__=='__main__':
 if os.geteuid()!=0 or len(sys.argv)!=2:raise SystemExit('root required; supply independent deletions-current.json')
 source=json.loads(Path(sys.argv[1]).read_text());root=Path('/var/lib/pripyat-privacy');root.mkdir(mode=0o700,exist_ok=True)
 with (root/'.lock').open('a') as mutex:
  fcntl.flock(mutex,fcntl.LOCK_EX)
  dest=root/'deletions.json';current=json.loads(dest.read_text()) if dest.exists() else {'entries':{}}
  for key,row in source['entries'].items():
   assert row['world'] in ['site','vk','ok'] and isinstance(row['uid'],int) and 0<row['uid']<=2147483647
   assert key==hashlib.sha256((row['world']+':'+str(row['uid'])).encode()).hexdigest()
   if key not in current['entries'] or row.get('completed_at',0)>current['entries'][key].get('completed_at',0):current['entries'][key]=row
  tmp=dest.with_suffix('.new');tmp.write_text(json.dumps(current));tmp.chmod(0o600);tmp.replace(dest)
 subprocess.run(['systemctl','start','pripyat-privacy-maintenance.service'],check=True)
 print(json.dumps({'independent_ledger_merged':True,'restored_erased_accounts_reprocessed':True}))
