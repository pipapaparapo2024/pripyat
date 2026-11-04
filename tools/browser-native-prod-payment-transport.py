"""Verify built PROD payment transport without sending any request to game API."""
from pathlib import Path
import importlib.util,subprocess,os,time,socket
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
code=r'''
from pathlib import Path
import json,hmac,hashlib,base64,urllib.parse,time
c=json.loads(Path('/etc/pripyat/vk-ok-native-prod.json').read_text());out={}
for world in ['vk','ok']:
 a={'vk_app_id':c['launch_app_ids'][world],'vk_user_id':'382448269','vk_client':'ok' if world=='ok' else 'desktop_web','vk_ts':str(int(time.time()))}
 if world=='ok':a.update(vk_ok_app_id=c['app_ids']['ok'],vk_ok_user_id='587256562321')
 a=dict(sorted(a.items()));a['sign']=base64.urlsafe_b64encode(hmac.new(c['api_secret'].encode(),urllib.parse.urlencode(a).encode(),hashlib.sha256).digest()).decode().rstrip('=');out[world]=a
print(json.dumps(out))
'''
r=subprocess.run(p.SSH+['root@'+p.HOST,'python3 -'],input=code,text=True,encoding='utf-8',capture_output=True,timeout=30);assert r.returncode==0,'Private launch fixtures failed';fixtures=r.stdout
with socket.socket() as reserve:reserve.bind(('127.0.0.1',0));port=reserve.getsockname()[1]
process=subprocess.Popen(p.SSH+['-o','ExitOnForwardFailure=yes','-N','-L',f'127.0.0.1:{port}:127.0.0.1:8081','root@'+p.HOST],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
try:
 for attempt in range(50):
  if process.poll() is not None:raise RuntimeError('Private SSH tunnel failed')
  try:
   with socket.create_connection(('127.0.0.1',port),timeout=.2):break
  except OSError:time.sleep(.1)
 else:raise RuntimeError('SSH tunnel timeout')
 env=os.environ.copy();env['PLAYWRIGHT_MODULE_PATH']=str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');env['PRIPYAT_CLOSED_PROD_URL']=f'http://127.0.0.1:{port}'
 subprocess.run(['node',str(ROOT/'tools/browser-native-prod-payment-transport.cjs')],input=fixtures,text=True,encoding='utf-8',env=env,cwd=ROOT,check=True)
finally:
 process.terminate()
 try:process.wait(timeout=5)
 except subprocess.TimeoutExpired:process.kill();process.wait()
