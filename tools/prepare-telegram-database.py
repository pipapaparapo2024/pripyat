"""Schema-only inspection and creation of the isolated Telegram TEST database.
No args: export reviewed proposal. --apply: create only the new named database.
"""
from pathlib import Path
import importlib.util,json,re,sys,hashlib
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
if sys.argv[1:] not in ([],['--apply']):raise SystemExit('Use --apply or no arguments')
TABLES=['users','boss_damage_log','boss_instances','boss_instance_claims','boss_last_kill','roulette_state','zone_respect_leader','event_settings','reward_links','reward_link_claims']
inspect=r'''
import subprocess,json,re
def sql(query):
    p=subprocess.run(['mysql','--batch','--skip-column-names','--raw','-e',query],capture_output=True,text=True,check=True)
    return p.stdout.rstrip('\n')
def normalized(ddl):return re.sub(r' AUTO_INCREMENT=\d+','',ddl)
tables=TABLES
schemas={}
for db in ['stalker','stalker_test','stalker_ok']:
    schemas[db]={}
    for name in tables:
        ddl=sql('SHOW CREATE TABLE `'+db+'`.`'+name+'`').split('\t',1)[1]
        schemas[db][name]=normalized(ddl)
exists=sql("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='stalker_telegram_test'")
print(json.dumps({'schemas':schemas,'target_exists':bool(exists)}))
'''.replace('TABLES',repr(TABLES))
client=release.connect()
try:snapshot=json.loads(release.run_remote_python(client,inspect))
finally:client.close()
schemas=snapshot['schemas'];reference=schemas['stalker']
for db, schema in schemas.items():
    different=[t for t in TABLES if schema[t]!=reference[t]]
    print(json.dumps({'schema':db,'different_tables':different,'compared_tables':len(schema)},ensure_ascii=False))
assert all('ENGINE=InnoDB' in ddl for ddl in reference.values()),'Transactional engine required'
new=(ROOT/'database/telegram-new-tables.sql').read_text(encoding='utf-8')
seeds="""
INSERT INTO `roulette_state` (`id`) VALUES (1);
INSERT INTO `event_settings` (`key`,`value`) VALUES ('event_active','0'),('event_id',''),('event_ends_at','0');
INSERT INTO `zone_respect_leader` (`location_id`) VALUES (0),(1),(2),(3),(4);
"""
final='-- Schema-only Telegram TEST installation. No VK/OK rows. Source: live SHOW CREATE TABLE.\n'
final+='CREATE DATABASE `stalker_telegram_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE `stalker_telegram_test`;\n'
final+='\n\n'.join(reference[t]+';' for t in TABLES)+'\n\n'+new+'\n'+seeds
expected=TABLES+['telegram_identities','telegram_sessions','telegram_roles','telegram_friendships','telegram_friend_invites']
assert sorted(re.findall(r'CREATE TABLE `([^`]+)`',final))==sorted(expected)
assert not re.search(r'\b(DROP|TRUNCATE|ALTER|DELETE|REPLACE)\b',final,re.I)
assert not any('`'+db+'`.' in final for db in ['stalker','stalker_test','stalker_ok'])
# Generated schema artifacts, never player data or credentials.
(ROOT/'database/telegram-test-schema.sql').write_text(final,encoding='utf-8')
(ROOT/'database/telegram-schema-source.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2),encoding='utf-8')
print('Generated database/telegram-test-schema.sql; 15 tables; target_exists='+str(snapshot['target_exists']))
if sys.argv[1:]!=['--apply']:raise SystemExit(0)
assert not snapshot['target_exists'],'Target exists: refusing installation or overwrite'
code=r'''
import subprocess,json,pathlib,hashlib,re,datetime,secrets
def sql(query):
    p=subprocess.run(['mysql','--batch','--skip-column-names','--raw','-e',query],capture_output=True,text=True)
    if p.returncode:raise RuntimeError('SQL operation failed; details suppressed')
    return p.stdout.rstrip('\n')
def normalized(ddl):return re.sub(r' AUTO_INCREMENT=\d+','',ddl)
baseline=BASELINE
def verify_legacy():
    for db,tables in baseline.items():
        for name,ddl in tables.items():
            assert normalized(sql('SHOW CREATE TABLE `'+db+'`.`'+name+'`').split('\t',1)[1])==ddl, 'Legacy schema changed'
verify_legacy()
assert not sql("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='stalker_telegram_test'"),'Target exists'
assert sql("SELECT COUNT(*) FROM mysql.user WHERE User='tg_test_game'")=='0','Dedicated user already exists'
backup=pathlib.Path('/var/backups')/('telegram-db-create-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S'))
backup.mkdir(mode=0o700)
ddl=DDL
(backup/'schema.sql').write_text(ddl);(backup/'schema.sql').chmod(0o600)
(backup/'source-schemas.json').write_text(json.dumps(baseline));(backup/'source-schemas.json').chmod(0o600)
# DDL commits implicitly. If installation fails, preserve partial target for inspection.
# Never roll back by dropping any database.
sql(ddl)
actual=sql("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='stalker_telegram_test' ORDER BY TABLE_NAME").splitlines()
assert sorted(actual)==sorted(EXPECTED),'Table set differs'
counts={t:int(sql('SELECT COUNT(*) FROM `stalker_telegram_test`.`'+t+'`')) for t in actual}
assert counts['roulette_state']==1 and counts['event_settings']==3 and counts['zone_respect_leader']==5
assert all(n==0 for t,n in counts.items() if t not in ['roulette_state','event_settings','zone_respect_leader'])
password=secrets.token_hex(32)
sql("CREATE USER 'tg_test_game'@'localhost' IDENTIFIED BY '"+password+"'; GRANT SELECT,INSERT,UPDATE,DELETE ON `stalker_telegram_test`.* TO 'tg_test_game'@'localhost';")
# Preserve bot token and enabled=false, update only new DB credentials privately.
config=pathlib.Path('/etc/pripyat/telegram-test.php')
original=config.read_text();(backup/'config-before.php').write_text(original);(backup/'config-before.php').chmod(0o600)
updated,n=re.subn(r"('db_user'\s*=>\s*)'[^']*'",lambda m:m[1]+"'tg_test_game'",original);assert n==1
updated,n=re.subn(r"('db_password'\s*=>\s*)'[^']*'",lambda m:m[1]+"'"+password+"'",updated);assert n==1
pending=backup/'config-new.php';pending.write_text(updated);pending.chmod(0o600)
subprocess.run(['php','-l',str(pending)],capture_output=True,check=True)
config.write_text(updated);config.chmod(0o600)
grants=sql("SHOW GRANTS FOR 'tg_test_game'@'localhost'").splitlines()
assert len(grants)==2 and any('`stalker_telegram_test`.*' in g for g in grants)
assert not any('ALL PRIVILEGES' in g or 'GRANT OPTION' in g for g in grants)
verify_legacy()
report={'database':'stalker_telegram_test','tables':counts,'backup':str(backup),'legacy_schemas_unchanged':True,'dedicated_user':'tg_test_game@localhost','login_enabled':False}
(backup/'report.json').write_text(json.dumps(report,indent=2));(backup/'report.json').chmod(0o600)
print(json.dumps(report))
'''.replace('BASELINE',repr(schemas)).replace('DDL',repr(final)).replace('EXPECTED',repr(expected))
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
