"""Live HTTP checks ONLY on test-pripyat-game.ru, dedicated synthetic UID.
Reads the test signing key over SSH in memory; never prints or stores credentials.
"""
from pathlib import Path
import base64
import hashlib
import hmac
import importlib.util
import json
import re
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release', ROOT / 'tools/release-session-715.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
client = release.connect()
try:
    with client.open_sftp() as sftp:
        with sftp.open('/var/www/stalker-test/server/core/models/registry.php') as stream:
            config = stream.read().decode('utf-8')
finally:
    client.close()
secret = re.search(r"'api_secret'\s*=>\s*'([^']+)'", config).group(1)
app_id = re.search(r"'api_id'\s*=>\s*(\d+)", config).group(1)
mapping = json.loads(re.search(r'const SPEC_ENCODE_MAP = (\{[^\n]+\});', (ROOT / 'smoke_test_vk.js').read_text(encoding='utf-8')).group(1))
uid = 999000715  # Dedicated release-v715 synthetic account, isolated from older smoke runs.
token, key = '', 'srUjnhko'

def call(method, params):
    global token, key
    encoded = base64.b64encode(base64.b64encode(json.dumps(params, ensure_ascii=False).encode())).decode()
    encoded = ''.join(mapping.get(char, char) for char in encoded)
    data = urllib.parse.urlencode({'uid':uid,'method':method,'params':encoded,
                                  'token':token,'req_key':key,'platform':'vk'}).encode()
    request = urllib.request.Request('https://test-pripyat-game.ru/server/universal.php', data=data)
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.loads(response.read())
    if result.get('req_key'):
        key = result['req_key']
    return result

params = dict(vk_user_id=str(uid), vk_app_id=app_id, vk_ts=str(int(time.time())),
              vk_platform='desktop_web', vk_language='ru', vk_is_app_user='1')
digest = hmac.new(secret.encode(), urllib.parse.urlencode(sorted(params.items())).encode(), hashlib.sha256).digest()
params['sign'] = base64.urlsafe_b64encode(digest).decode().rstrip('=')
login = call('security.getToken', params)
assert login.get('token'), 'test login failed'
token = login['token']
assert call('users.get', {}).get('udata'), 'test user load failed'
print('OK: authenticated test login and user load', flush=True)
for method in ['raznaryadka.getState','game2048.getState','game2048.top']:
    result = call(method, {})
    assert result.get('ok') == 1, method + ' failed, code=' + str(result.get('code'))
    print('OK:', method, flush=True)
state = call('game2048.start', {})
assert len(state.get('session', {}).get('board', [])) == 16, '2048 start failed'
print('OK: ordinary test account starts/resumes a 2048 board', flush=True)
assert call('users.devGrantCurrency', {'currency':'coins','amount':1}).get('code') == 403
print('OK: ordinary test account denied dev currency', flush=True)
