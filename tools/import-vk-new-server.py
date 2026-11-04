"""Approved isolated September VK restore on NEW VPS. No deployment or migrations."""
from pathlib import Path
import importlib.util,subprocess,hashlib,json,re
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('provision',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
dump=Path(r'C:\Users\HONOR\Desktop\vk_game\projects_2026\db_backups\stalker_full_backup_20260926_before_wipe.sql')
raw=dump.read_bytes();text=raw.decode('utf-8')
assert not re.search(r'(?im)^\s*(?:USE |CREATE DATABASE|DROP DATABASE|CREATE USER|GRANT |SET GLOBAL|SET @@GLOBAL|INSTALL |SOURCE |\\!)',text)
assert not re.search(r'(?i)\b(?:INTO OUTFILE|INTO DUMPFILE|LOAD DATA|DEFINER\s*=)',text)
assert len(re.findall(r'CREATE TABLE',text))==22
digest=hashlib.sha256(raw).hexdigest();target='/var/backups/pripyat-vk-september-source.sql'
subprocess.run(p.SSH+['root@'+p.HOST,'install -d -m 700 /var/backups/pripyat-database'],check=True,capture_output=True)
subprocess.run(['scp','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',str(dump),'root@'+p.HOST+':'+target],check=True,capture_output=True)
baseline=json.loads((ROOT/'database/telegram-schema-source.json').read_text(encoding='utf-8'))['schemas']['stalker']
expected={name:re.findall(r'^\s*'+chr(96)+'([^'+chr(96)+']+)'+chr(96)+r'\s+',ddl,re.M) for name,ddl in baseline.items()}
code=r'''
from pathlib import Path
import subprocess,secrets,json,hashlib,re
DB='stalker_vk_restore_20260926';b=chr(96)
def sql(query):
 r=subprocess.run(['mysql','--batch','--skip-column-names','--raw'],input=query,text=True,capture_output=True)
 if r.returncode:raise RuntimeError('MySQL operation failed; private SQL details suppressed')
 return r.stdout.strip()
source=Path(SOURCE);source.chmod(0o600);assert hashlib.sha256(source.read_bytes()).hexdigest()==DIGEST
assert not sql("SELECT SCHEMA_NAME FROM information_schema.schemata WHERE SCHEMA_NAME='"+DB+"'"),'Restore database already exists; refusing overwrite'
sql('CREATE DATABASE '+b+DB+b+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
with source.open('rb') as f:r=subprocess.run(['mysql',DB],stdin=f,capture_output=True)
assert r.returncode==0,'Import failed; keep isolated database for diagnosis, no automatic overwrite'
tables=sql("SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA='"+DB+"'").splitlines();assert len(tables)==22
counts={table:int(sql('SELECT COUNT(*) FROM '+b+DB+b+'.'+b+table+b)) for table in tables};assert counts['users']>0
private=Path('/etc/pripyat');private.mkdir(mode=0o700,exist_ok=True)
config=private/'vk-september-restore.json';assert not config.exists(),'Private config already exists'
password=secrets.token_hex(32)
sql("CREATE USER 'vk_restore_app'@'localhost' IDENTIFIED BY '"+password+"'")
sql("GRANT SELECT, INSERT, UPDATE, DELETE ON "+b+DB+b+".* TO 'vk_restore_app'@'localhost'")
config.write_text(json.dumps({'host':'127.0.0.1','port':3306,'database':DB,'user':'vk_restore_app','password':password}));config.chmod(0o600)
missing={}
for table,cols in EXPECTED.items():
 actual=sql("SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA='"+DB+"' AND TABLE_NAME='"+table+"'").splitlines()
 absent=sorted(set(cols)-set(actual))
 if absent:missing[table]=absent
report={'host':HOST,'database':DB,'source_date':'2026-09-26','source_sha256':DIGEST,'tables':22,'users':counts['users'],'row_counts':counts,'missing_columns_vs_last_live_schema':missing,'game_published':False,'dns_changed':False,'migrations_applied':False}
path=Path('/var/backups/pripyat-database/restore-report.json');path.write_text(json.dumps(report,ensure_ascii=False,indent=2));path.chmod(0o600)
script=Path('/usr/local/sbin/pripyat-vk-backup')
script.write_text("""#!/bin/sh
set -eu
umask 077
dest=/var/backups/pripyat-database
stamp=$(date -u +%Y%m%dT%H%M%SZ)
tmp="$dest/vk-$stamp.sql.tmp"
mysqldump --single-transaction --quick --routines --events --triggers --hex-blob --set-gtid-purged=OFF --no-tablespaces stalker_vk_restore_20260926 > "$tmp"
test -s "$tmp"
gzip "$tmp"
mv "$tmp.gz" "$dest/vk-$stamp.sql.gz"
""");script.chmod(0o700)
Path('/etc/systemd/system/pripyat-vk-backup.service').write_text('[Unit]\nDescription=Private VK restore SQL backup\nAfter=mysql.service\n[Service]\nType=oneshot\nExecStart=/usr/local/sbin/pripyat-vk-backup\nUMask=0077\n')
Path('/etc/systemd/system/pripyat-vk-backup.timer').write_text('[Unit]\nDescription=Daily private VK SQL backup\n[Timer]\nOnCalendar=*-*-* 03:40:00 UTC\nRandomizedDelaySec=120\nPersistent=true\n[Install]\nWantedBy=timers.target\n')
subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','enable','--now','pripyat-vk-backup.timer'],check=True,capture_output=True)
subprocess.run([str(script)],check=True)
print(json.dumps(report,ensure_ascii=False))
'''.replace('SOURCE',repr(target)).replace('DIGEST',repr(digest)).replace('EXPECTED',repr(expected)).replace('HOST',repr(p.HOST))
p.remote('root',code)
