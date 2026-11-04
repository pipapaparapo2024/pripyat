"""Explicitly approved fresh VK/OK/TG schemas on new VPS only; never alter existing databases."""
from pathlib import Path
import importlib.util,json,re
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('provision',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
b=chr(96)
base=json.loads((ROOT/'database/telegram-schema-source.json').read_text(encoding='utf-8'))['schemas']['stalker']
common='\n'.join(re.sub(r' AUTO_INCREMENT=\d+','',ddl).rstrip(';')+';' for ddl in base.values())
schema=(ROOT/'database/schema.sql').read_text(encoding='utf-8')
def legacy(name):
    m=re.search(r'CREATE TABLE IF NOT EXISTS '+b+name+b+r' \(.*?\) ENGINE=[^;]+;',schema,re.S);assert m
    return m[0].replace('IF NOT EXISTS ','')
seeds="\nINSERT INTO "+b+"roulette_state"+b+" (id) VALUES (1);\nINSERT INTO "+b+"event_settings"+b+" ("+b+"key"+b+","+b+"value"+b+") VALUES ('event_active','0'),('event_id',''),('event_ends_at','0');\nINSERT INTO "+b+"zone_respect_leader"+b+" (location_id) VALUES (0),(1),(2),(3),(4);\n"
oksource=(ROOT/'server/core/models/okpaymentcredit.php').read_text(encoding='utf-8')
ok=re.search(r'const CREATE_SQL="([^"]+)";',oksource).group(1).replace('IF NOT EXISTS ','')+';'
tg=(ROOT/'database/telegram-new-tables.sql').read_text(encoding='utf-8')
stars=(ROOT/'database/telegram-stars.sql').read_text(encoding='utf-8')
stars=re.sub(r'(?m)^USE .*;\s*','',stars)
schemas={
 'stalker':common+legacy('secure')+legacy('trans')+legacy('reward_admin_totp')+seeds,
 'stalker_ok':common+legacy('secure')+legacy('trans')+ok+seeds,
 'stalker_telegram':common+tg+stars+seeds,
}
for sql in schemas.values():
    assert not re.search(r'(?im)^\s*(?:USE |ALTER |DROP |TRUNCATE |DELETE |UPDATE |REPLACE )',sql)
code=r'''
from pathlib import Path
import subprocess,secrets,json,datetime,hashlib,gzip
schemas=SCHEMAS
def sql(query,db=None):
 args=['mysql','--batch','--skip-column-names','--raw']+([db] if db else [])
 r=subprocess.run(args,input=query,text=True,capture_output=True)
 if r.returncode:raise RuntimeError('Clean SQL setup failed; sensitive diagnostics suppressed')
 return r.stdout.strip()
existing=set(sql('SHOW DATABASES').splitlines());assert not existing.intersection(schemas),'Target already exists; refusing any overwrite'
old=sql('SELECT COUNT(*) FROM stalker_vk_restore_20260926.users');assert old=='6'
backup=Path('/var/backups')/('pripyat-clean-platforms-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S'));backup.mkdir(mode=0o700)
credentials={};report={};b=chr(96)
for db,ddl in schemas.items():
 (backup/(db+'.schema.sql')).write_text(ddl);(backup/(db+'.schema.sql')).chmod(0o600)
 sql('CREATE DATABASE '+b+db+b+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');sql(ddl,db)
 tables=sql("SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA='"+db+"'").splitlines()
 expected=17 if db=='stalker_telegram' else 13;assert len(tables)==expected
 counts={t:int(sql('SELECT COUNT(*) FROM '+b+t+b,db)) for t in tables}
 assert counts['users']==0
 for table,count in counts.items():
  assert count=={'roulette_state':1,'event_settings':3,'zone_respect_leader':5}.get(table,0),'Unexpected nonempty game data'
 user={'stalker':'pripyat_vk_app','stalker_ok':'pripyat_ok_app','stalker_telegram':'pripyat_tg_app'}[db];password=secrets.token_hex(32)
 sql("CREATE USER '"+user+"'@'localhost' IDENTIFIED BY '"+password+"'")
 escaped=db.replace('_',chr(92)+'_')
 sql("GRANT SELECT, INSERT, UPDATE, DELETE ON "+b+escaped+b+".* TO '"+user+"'@'localhost'")
 credentials[db]={'host':'127.0.0.1','port':3306,'database':db,'user':user,'password':password}
 report[db]={'tables':len(tables),'players':0,'only_service_seed_rows':True,'source_schema_sha256':hashlib.sha256(ddl.encode()).hexdigest()}
private=Path('/etc/pripyat');private.mkdir(mode=0o700,exist_ok=True);path=private/'new-platform-databases.json';assert not path.exists();path.write_text(json.dumps(credentials));path.chmod(0o600)
# Verify each private account has access to its own database and none of the others.
php=r"""<?php
$all=json_decode(file_get_contents('/etc/pripyat/new-platform-databases.json'),true);
foreach($all as $name=>$c){
 $db=new PDO('mysql:host=127.0.0.1;port=3306;dbname='.$name.';charset=utf8mb4',$c['user'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 if((int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn()!==0)throw new RuntimeException('Unexpected player');
 foreach(array_merge(array_keys($all),['stalker_vk_restore_20260926','mysql']) as $other){
  if($other===$name)continue;
  $table=$other==='mysql'?'user':'users';$denied=false;
  try{$db->query('SELECT 1 FROM '.$other.'.'.$table.' LIMIT 0');}catch(PDOException $e){$denied=true;}
  if(!$denied)throw new RuntimeException('Database isolation failed');
 }
}
echo 'All three restricted application accounts and cross-database denial verified';
"""
r=subprocess.run(['php'],input=php,text=True,capture_output=True);assert r.returncode==0,'Private account isolation verification failed'
assert sql('SELECT COUNT(*) FROM stalker_vk_restore_20260926.users')==old,'September restore changed'
script=Path('/usr/local/sbin/pripyat-platform-backup')
script.write_text("""#!/bin/sh
set -eu
umask 077
dest=/var/backups/pripyat-database
stamp=$(date -u +%Y%m%dT%H%M%SZ)
for db in stalker stalker_ok stalker_telegram; do
 tmp="$dest/$db-$stamp.sql.tmp"
 mysqldump --single-transaction --quick --routines --events --triggers --hex-blob --set-gtid-purged=OFF --no-tablespaces "$db" > "$tmp"
 test -s "$tmp"
 gzip "$tmp"
 mv "$tmp.gz" "$dest/$db-$stamp.sql.gz"
done
""");script.chmod(0o700)
Path('/etc/systemd/system/pripyat-platform-backup.service').write_text('[Unit]\nDescription=Private VK OK Telegram SQL backups\nAfter=mysql.service\n[Service]\nType=oneshot\nExecStart=/usr/local/sbin/pripyat-platform-backup\nUMask=0077\n')
Path('/etc/systemd/system/pripyat-platform-backup.timer').write_text('[Unit]\nDescription=Daily private game SQL backups\n[Timer]\nOnCalendar=*-*-* 03:40:00 UTC\nRandomizedDelaySec=120\nPersistent=true\n[Install]\nWantedBy=timers.target\n')
subprocess.run(['systemctl','daemon-reload'],check=True)
subprocess.run(['systemctl','disable','--now','pripyat-vk-backup.timer'],check=True,capture_output=True)
subprocess.run(['systemctl','enable','--now','pripyat-platform-backup.timer'],check=True,capture_output=True)
subprocess.run([str(script)],check=True)
for db in schemas:
 latest=max(Path('/var/backups/pripyat-database').glob(db+'-*.sql.gz'),key=lambda x:x.stat().st_mtime)
 with gzip.open(latest,'rt') as f:body=f.read()
 assert '-- Dump completed on' in body
result={'host':'135.106.159.212','databases':report,'private_schema_backup':str(backup),'isolated_accounts':'verified','september_restore_preserved':True,'existing_database_migrations':False,'dns_changed':False,'game_published':False}
(backup/'report.json').write_text(json.dumps(result,indent=2));(backup/'report.json').chmod(0o600)
print(json.dumps(result))
'''.replace('SCHEMAS',repr(schemas))
p.remote('root',code)
