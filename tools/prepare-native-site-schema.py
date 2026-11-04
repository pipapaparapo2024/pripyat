"""Prepare WEBSITE TEST SQL locally; does not connect to MySQL or create accounts."""
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
base=json.loads((ROOT/'database/telegram-schema-source.json').read_text(encoding='utf-8'))['schemas']['stalker']
assert len(base)==10
common='\n'.join(re.sub(r' AUTO_INCREMENT=\d+','',ddl).rstrip(';')+';' for ddl in base.values())
extra=(ROOT/'database/site-auth-tables.proposed.sql').read_text(encoding='utf-8')
seeds="INSERT INTO roulette_state (id) VALUES (1);\nINSERT INTO event_settings (`key`,`value`) VALUES ('event_active','0'),('event_id',''),('event_ends_at','0');\nINSERT INTO zone_respect_leader (location_id) VALUES (0),(1),(2),(3),(4);\n"
sql='-- PROPOSED ONLY. Do not apply without explicit approval.\nCREATE DATABASE `stalker_site_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE `stalker_site_test`;\n'+common+'\n'+extra+'\n'+seeds
assert len(re.findall(r'CREATE TABLE ',sql))==14
(ROOT/'database/site-test-schema.proposed.sql').write_text(sql,encoding='utf-8')
print('Prepared 14-table native WEBSITE TEST proposal. No SQL executed.')
