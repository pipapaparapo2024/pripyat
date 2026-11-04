"""Explicit approval 2026-11-03: native website TEST, no existing schema changes."""
from pathlib import Path
import importlib.util,re
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
ddl=(ROOT/'database/site-test-schema.proposed.sql').read_text(encoding='utf-8')
assert re.findall(r'CREATE DATABASE `([^`]+)`',ddl)==['stalker_site_test']
assert not re.search(r'(?im)^\s*(ALTER|DROP|TRUNCATE|DELETE|UPDATE|REPLACE)\b',ddl)
p.remote('root',r'''
from pathlib import Path
import subprocess,json,secrets,datetime,os
def sql(q,db=None):
 r=subprocess.run(['mysql','-NBr']+([db] if db else []),input=q,text=True,capture_output=True)
 if r.returncode:raise RuntimeError('SQL failed; private diagnostics suppressed')
 return r.stdout.strip()
db='stalker_site_test';user='pripyat_site_test'
assert db not in sql('SHOW DATABASES').splitlines()
assert sql("SELECT COUNT(*) FROM mysql.user WHERE User='"+user+"'")=='0'
path=Path('/etc/pripyat/site-test-database.json');assert not path.exists()
backup=Path('/var/backups')/('pripyat-create-site-test-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
(backup/'approved.sql').write_text(DDL);(backup/'approved.sql').chmod(0o600)
sql(DDL)
tables=sql("SELECT table_name FROM information_schema.tables WHERE table_schema='"+db+"'").splitlines();assert len(tables)==14
for table in tables:assert int(sql('SELECT COUNT(*) FROM `'+table+'`',db))=={'roulette_state':1,'event_settings':3,'zone_respect_leader':5}.get(table,0)
password=secrets.token_hex(32)
sql("CREATE USER '"+user+"'@'localhost' IDENTIFIED BY '"+password+"'")
sql("GRANT SELECT,INSERT,UPDATE,DELETE ON `stalker\\_site\\_test`.* TO '"+user+"'@'localhost'")
fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:json.dump({'host':'127.0.0.1','port':3306,'database':db,'user':user,'password':password},f)
php=PHP_CODE
r=subprocess.run(['php'],input=php,text=True,capture_output=True)
assert r.returncode==0,'Site isolation verification failed; private diagnostics suppressed'
print(json.dumps({'created':db,'tables':len(tables),'players':0,'accounts':0,'isolation_verified':True,'backup':str(backup)}))
'''.replace('DDL',repr(ddl)).replace('PHP_CODE',repr("""<?php
$c=json_decode(file_get_contents('/etc/pripyat/site-test-database.json'),true);
$db=new PDO('mysql:host=127.0.0.1;dbname='.$c['database'].';charset=utf8mb4',$c['user'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->query('SELECT COUNT(*) FROM site_accounts');
foreach(['stalker','stalker_ok','stalker_telegram','stalker_test','stalker_ok_test','stalker_telegram_test','stalker_vk_restore_20260926'] as $other){
 $denied=false;try{$db->query('SELECT 1 FROM '.$other.'.users LIMIT 0');}catch(PDOException $e){$denied=true;}
 if(!$denied)throw new RuntimeException('Cross-database access');
}
""")))
