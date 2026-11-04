"""User-approved: add exactly two Stars tables in TG TEST and grant one verified developer."""
from pathlib import Path
import importlib.util,re,sys
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py');release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
if sys.argv[1:]!=['--apply']:raise SystemExit('Use --apply after explicit user approval')
ddl=(ROOT/'database/telegram-stars.sql').read_text(encoding='utf-8')
assert re.findall(r'CREATE TABLE `([^`]+)`',ddl)==['telegram_payment_orders','telegram_payment_transactions']
assert not re.search(r'\b(DROP|TRUNCATE|ALTER|DELETE|REPLACE)\b',ddl,re.I)
code=r'''
import pathlib,subprocess,json,datetime,hashlib
def sql(query):
    p=subprocess.run(['mysql','--batch','--skip-column-names','--raw','-e',query],capture_output=True,text=True)
    assert p.returncode==0,'TG-only SQL failed; private diagnostics suppressed'
    return p.stdout.strip()
assert sql("SELECT telegram_id FROM stalker_telegram_test.telegram_identities WHERE player_id=18")=='1355806786'
assert sql("SELECT COUNT(*) FROM stalker_telegram_test.telegram_roles WHERE role IN ('developer','admin') AND player_id<>18")=='0','Unexpected existing developer'
backup=pathlib.Path('/var/backups')/('telegram-stars-prepare-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S'))
backup.mkdir(mode=0o700);ddl=DDL
(backup/'schema.sql').write_text(ddl);(backup/'schema.sql').chmod(0o600)
config=pathlib.Path('/etc/pripyat/telegram-test.php');(backup/'config-before.php').write_bytes(config.read_bytes());(backup/'config-before.php').chmod(0o600)
existing=sql("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='stalker_telegram_test' AND TABLE_NAME IN ('telegram_payment_orders','telegram_payment_transactions')").splitlines()
assert len(existing) in (0,2),'Partial Stars installation; do not overwrite'
if not existing:sql(ddl)
assert sql("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='stalker_telegram_test'")=='17'
sql("INSERT IGNORE INTO stalker_telegram_test.telegram_roles (player_id,role,created_at) VALUES (18,'developer',UNIX_TIMESTAMP())")
assert sql("SELECT COUNT(*) FROM stalker_telegram_test.telegram_roles WHERE role='developer'")=='1'
print(json.dumps({'database':'stalker_telegram_test','new_tables':2,'tables_total':17,'only_developer_player_id':18,'telegram_id':'1355806786','backup':str(backup)}))
'''.replace('DDL',repr(ddl))
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
