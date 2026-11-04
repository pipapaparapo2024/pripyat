"""Read-only live schema capture. Writes proposed local SQL; never executes it."""
from pathlib import Path
import importlib.util, subprocess, json, re
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('provision',ROOT/'tools/provision-new-server.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
code=r'''
import subprocess,json,re
result={}
for db in ['stalker','stalker_ok','stalker_telegram']:
 r=subprocess.run(['mysqldump','--no-data','--skip-comments','--skip-add-drop-table','--set-gtid-purged=OFF','--no-tablespaces',db],capture_output=True,text=True,check=True)
 result[db]=r.stdout
print(json.dumps(result))
'''
r=subprocess.run(p.SSH+['root@'+p.HOST,'python3 -'],input=code,text=True,capture_output=True,check=True,timeout=90)
schemas=json.loads(r.stdout)
out=ROOT/'database/closed-test-new-server.proposed.sql'
parts=['-- PROPOSED ONLY. Requires explicit approval before execution.\n-- Fresh TEST databases only. No data import, ALTER, DROP, or production writes.\n']
for db,sql in schemas.items():
 target={'stalker':'stalker_test','stalker_ok':'stalker_ok_test','stalker_telegram':'stalker_telegram_test'}[db]
 sql=re.sub(r' AUTO_INCREMENT=\d+','',sql)
 assert not re.search(r'(?im)^\s*(?:ALTER|DROP|TRUNCATE|DELETE|UPDATE|REPLACE|USE)\b',sql)
 parts.append(f'CREATE DATABASE `{target}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE `{target}`;\n'+sql)
 parts.append("INSERT INTO roulette_state (id) VALUES (1);\nINSERT INTO event_settings (`key`,`value`) VALUES ('event_active','0'),('event_id',''),('event_ends_at','0');\nINSERT INTO zone_respect_leader (location_id) VALUES (0),(1),(2),(3),(4);\n")
 print(target,'tables',len(re.findall(r'CREATE TABLE ',sql)))
out.write_text('\n'.join(parts),encoding='utf-8')
print('SQL proposal saved locally. No SQL executed.')
