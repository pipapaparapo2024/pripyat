"""Explicitly approved 2026-11-03: three fresh TEST DBs. Never migrate existing DBs."""
from pathlib import Path
import importlib.util,re
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
proposal=(ROOT/'database/closed-test-new-server.proposed.sql').read_text(encoding='utf-8')
names=['stalker_test','stalker_ok_test','stalker_telegram_test']
assert re.findall(r'CREATE DATABASE `([^`]+)`',proposal)==names
assert not re.search(r'(?im)^\s*(ALTER|DROP|TRUNCATE|DELETE|UPDATE|REPLACE)\b',proposal)
code=r'''
from pathlib import Path
import subprocess,json,secrets,datetime,os
ddl=DDL
names=['stalker_test','stalker_ok_test','stalker_telegram_test']
def sql(query,db=None):
 r=subprocess.run(['mysql','-NBr']+([db] if db else []),input=query,text=True,capture_output=True)
 if r.returncode:raise RuntimeError('SQL operation failed; private diagnostics suppressed')
 return r.stdout.strip()
existing=set(sql('SHOW DATABASES').splitlines())
assert not existing.intersection(names),'Refusing to overwrite any existing TEST database'
path=Path('/etc/pripyat/test-platform-databases.json');assert not path.exists()
users=['pripyat_vk_test','pripyat_ok_test','pripyat_tg_test']
for user in users:assert sql("SELECT COUNT(*) FROM mysql.user WHERE User='"+user+"'")=='0'
backup=Path('/var/backups')/('pripyat-create-test-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
(backup/'approved.sql').write_text(ddl);(backup/'approved.sql').chmod(0o600)
before={db:sql('SELECT COUNT(*) FROM users',db) for db in ['stalker','stalker_ok','stalker_telegram','stalker_vk_restore_20260926']}
sql(ddl)
creds={};report={}
for db,user in zip(names,users):
 password=secrets.token_hex(32)
 sql("CREATE USER '"+user+"'@'localhost' IDENTIFIED BY '"+password+"'")
 escaped=db.replace('_',chr(92)+'_')
 sql("GRANT SELECT,INSERT,UPDATE,DELETE ON `"+escaped+"`.* TO '"+user+"'@'localhost'")
 creds[db]={'host':'127.0.0.1','port':3306,'database':db,'user':user,'password':password}
 tables=sql("SELECT table_name FROM information_schema.tables WHERE table_schema='"+db+"'").splitlines()
 assert len(tables)==(17 if db=='stalker_telegram_test' else 13)
 for table in tables:
  assert int(sql('SELECT COUNT(*) FROM `'+table+'`',db))=={'roulette_state':1,'event_settings':3,'zone_respect_leader':5}.get(table,0)
 report[db]={'tables':len(tables),'players':0,'service_seeds_only':True}
fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:json.dump(creds,f)
php=PHP_CODE
r=subprocess.run(['php'],input=php,text=True,capture_output=True)
assert r.returncode==0,'Application account isolation failed; diagnostics suppressed'
for db,count in before.items():assert sql('SELECT COUNT(*) FROM users',db)==count
print(json.dumps({'created':report,'existing_player_counts_unchanged':True,'restricted_account_isolation':True,'backup':str(backup)}))
'''
php="""<?php
$all=json_decode(file_get_contents('/etc/pripyat/test-platform-databases.json'),true);
foreach($all as $name=>$c){
 $db=new PDO('mysql:host=127.0.0.1;dbname='.$name.';charset=utf8mb4',$c['user'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 if((int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn()!==0)throw new RuntimeException('Unexpected players');
 foreach(array_merge(array_keys($all),['stalker','stalker_ok','stalker_telegram','stalker_vk_restore_20260926']) as $other){
  if($other===$name)continue;$denied=false;
  try{$db->query('SELECT 1 FROM '.$other.'.users LIMIT 0');}catch(PDOException $e){$denied=true;}
  if(!$denied)throw new RuntimeException('Cross-database access');
 }
}
"""
# Substitute a repr string rather than allowing source text to become Python code.
code=code.replace('php=PHP_CODE','php='+repr(php)).replace('ddl=DDL','ddl='+repr(proposal))
p.remote('root',code)
