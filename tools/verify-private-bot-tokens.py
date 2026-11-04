"""Read-only getMe/webhook check via local network, without printing or saving tokens."""
from pathlib import Path
import importlib.util,subprocess,json,urllib.request
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
code="from pathlib import Path\nimport json\nprint(json.dumps({e:json.loads(Path('/etc/pripyat/telegram-'+e+'-bot.json').read_text()) for e in ['test','prod']}))"
r=subprocess.run(p.SSH+['root@'+p.HOST,'python3 -'],input=code,text=True,capture_output=True,timeout=30)
if r.returncode:raise SystemExit('SSH unavailable; private diagnostic suppressed')
settings=json.loads(r.stdout)
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
for env,c in settings.items():
 report={'environment':env,'enabled':c.get('enabled')}
 try:
  def call(method):
   with opener.open('https://api.telegram.org/bot'+c['bot_token']+'/'+method,timeout=15) as response:return json.load(response)
  data=call('getMe');bot=data.get('result',{})
  report.update(valid=data.get('ok') is True,username=bot.get('username'),bot_id=bot.get('id'),expected_matches=bot.get('username')==c.get('bot_username'))
  hook=call('getWebhookInfo').get('result',{})
  report.update(webhook_configured=bool(hook.get('url')),pending_updates=hook.get('pending_update_count'),webhook_error=bool(hook.get('last_error_message')))
 except Exception as error:report.update(valid=None,error_type=type(error).__name__)
 print(json.dumps(report))
