"""Read-only browser maintenance check via temporary private SSH tunnel."""
from pathlib import Path
import importlib.util,subprocess,os,time,socket,tempfile
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
with socket.socket() as reserve:
 reserve.bind(('127.0.0.1',0));port=reserve.getsockname()[1]
process=subprocess.Popen(p.SSH+['-o','ExitOnForwardFailure=yes','-N','-L',f'127.0.0.1:{port}:127.0.0.1:8081','root@'+p.HOST],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
try:
 for attempt in range(50):
  if process.poll() is not None:raise RuntimeError('Private SSH tunnel failed')
  try:
   with socket.create_connection(('127.0.0.1',port),timeout=.2):break
  except OSError:time.sleep(.1)
 else:raise RuntimeError('SSH tunnel timeout')
 env=os.environ.copy();env['PLAYWRIGHT_MODULE_PATH']=str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
 env['PRIPYAT_CLOSED_PROD_URL']=f'http://127.0.0.1:{port}';env['PRIPYAT_GATE_SCREENSHOT_DIR']=str(Path(tempfile.gettempdir())/'pripyat-closed-prod-gate-20261104')
 subprocess.run(['node',str(ROOT/'tools/browser-native-prod-maintenance.cjs')],env=env,cwd=ROOT,check=True)
 print('Maintenance screenshots: '+env['PRIPYAT_GATE_SCREENSHOT_DIR'])
finally:
 process.terminate()
 try:process.wait(timeout=5)
 except subprocess.TimeoutExpired:process.kill();process.wait()
