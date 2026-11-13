"""Accept the PROD bot token privately and verify its identity through the Amsterdam relay."""
from pathlib import Path
import base64
import getpass
import json
import re
import subprocess

token = getpass.getpass("Токен @pripyat_game_bot (ввод скрыт): ").strip()
if not re.fullmatch(r"[1-9][0-9]+:[A-Za-z0-9_-]{20,}", token):
    raise SystemExit("Неверный формат токена")
payload = base64.b64encode(json.dumps({"bot_token": token}).encode()).decode()
remote = r"""
import base64, datetime, json, os, pathlib, subprocess, tempfile
data=json.loads(base64.b64decode(PAYLOAD))
token=data['bot_token']
request=subprocess.run(
 ['curl','--silent','--show-error','--noproxy','*','--max-time','15',
  '--connect-to','api.telegram.org:443:127.0.0.1:10443','--config','-'],
 input='url = "https://api.telegram.org/bot'+token+'/getMe"\n',
 text=True,capture_output=True)
try: response=json.loads(request.stdout)
except (ValueError,TypeError): raise SystemExit('Не удалось проверить токен через Telegram relay')
bot=response.get('result',{})
if request.returncode or not response.get('ok') or bot.get('username')!='pripyat_game_bot':
 raise SystemExit('Токен отклонён или принадлежит другому боту')
path=pathlib.Path('/etc/pripyat/telegram-prod-token.json')
if path.exists():
 previous=pathlib.Path('/var/backups')/('telegram-prod-token-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.json')
 previous.write_bytes(path.read_bytes());previous.chmod(0o600)
fd,tmp=tempfile.mkstemp(prefix='.telegram-prod-token-',dir=path.parent)
try:
 os.fchmod(fd,0o600)
 with os.fdopen(fd,'w') as stream: json.dump({'bot_token':token,'bot_id':bot['id'],'bot_username':bot['username']},stream)
 os.replace(tmp,path)
finally:
 if os.path.exists(tmp): os.unlink(tmp)
print('Токен сохранён. Подтверждён @pripyat_game_bot, ID '+str(bot['id']))
""".replace("PAYLOAD", repr(payload))
result = subprocess.run(
    ["ssh", "-o", "BatchMode=yes", "-i", str(Path.home()/".ssh/id_ed25519_stalker"),
     "root@135.106.159.212", "python3 -"],
    input=remote, text=True, encoding="utf-8", capture_output=True,
)
print(result.stdout.strip())
if result.returncode:
    raise SystemExit("Не удалось сохранить токен. Проверьте соединение и принадлежность токена боту.")
