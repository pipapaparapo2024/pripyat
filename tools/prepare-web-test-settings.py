"""Prepare disabled private settings on NEW VPS; no app deploy, API requests or SQL."""
from pathlib import Path
import importlib.util,json
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('provision',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
policy=json.loads((ROOT/'docs/closed-test-access.example.json').read_text(encoding='utf-8'))
code=r'''
from pathlib import Path
import os,json,secrets
base=Path('/etc/pripyat');assert base.is_dir()
settings={
 'closed-test-access.json':POLICY,
 'yookassa-test.json':{'enabled':False,'shop_id':'','secret_key':'','require_test_payment':True,'website_origin':'https://pripyat-game-site.ru'},
 'telegram-test-network.json':{'enabled':False,'bot_api_environment':'test','bot_token':'','webhook_secret':secrets.token_hex(32),'database':'stalker_telegram_sandbox','owner_test_telegram_id':'','allowed_test_telegram_ids':[]},
}
report=[]
for name,value in settings.items():
 path=base/name
 try:fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 except FileExistsError:report.append({'file':str(path),'created':False,'existing_settings_preserved':True});continue
 with os.fdopen(fd,'w') as f:json.dump(value,f,ensure_ascii=False,indent=2)
 report.append({'file':str(path),'created':True,'permissions':'0600'})
print(json.dumps({'settings':report,'providers_enabled':False,'sql_executed':False,'website_authentication_deployed':False,'access_policy_enforced_by_live_site':False}))
'''.replace('POLICY',repr(policy))
p.remote('root',code)
