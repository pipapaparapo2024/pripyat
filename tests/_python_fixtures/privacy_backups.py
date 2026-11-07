from pathlib import Path
import importlib.util,tempfile,os,time,json,hashlib,gzip,datetime
from unittest.mock import patch
root=Path(__file__).resolve().parents[2]
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,root/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
retention=module('retention','tools/privacy-maintenance.py');pull=module('pull','tools/pull-database-backups.py')
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp)/'file';p.write_text('test');now=time.time();os.utime(p,(now-31*86400,now-31*86400));assert retention.expired(p,30*86400,now)
 os.utime(p,(now,now));assert not retention.expired(p,30*86400,now)
 pull.DEST=Path(tmp)/'backups';pull.DEST.mkdir();stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');records=[]
 for db in ['stalker','stalker_ok','stalker_telegram','stalker_test','stalker_ok_test','stalker_telegram_test','stalker_site_test']:
  f=pull.DEST/(db+'-'+stamp+'.sql.gz');f.write_bytes(gzip.compress(b'-- test backup\n'));records.append({'name':f.name,'size':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
 f=pull.DEST/('privacy-ledger-'+stamp+'.json');f.write_text('{"entries":{}}');records.append({'name':f.name,'size':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
 manifest={'stamp':stamp,'files':records}
 with patch.object(pull.subprocess,'check_output',side_effect=[json.dumps(manifest).encode(),b'{"entries":{}}']):pull.main()
 assert (pull.DEST/'deletions-current.json').is_file()
 bad=json.loads(json.dumps(manifest));bad['files'][0]['name']='../escape.sql.gz'
 with patch.object(pull.subprocess,'check_output',return_value=json.dumps(bad).encode()):
  try:pull.main();raise AssertionError('Unsafe path accepted')
  except RuntimeError as e:assert 'Unsafe' in str(e)
 print('Retention/backups: expiry boundary, eight-file manifest, SHA256, cached snapshots, erasure ledger and path traversal denial passed')
