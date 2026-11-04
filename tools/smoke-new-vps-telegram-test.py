"""Run the existing fixture-only TG HTTPS smoke against the NEW VPS, never old release host."""
from pathlib import Path
import ast,importlib.util
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
tree=ast.parse((ROOT/'tools/smoke-telegram-test.py').read_text(encoding='utf-8'))
php=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='php' for t in n.targets))
php=php.replace("$again=postTg('telegram-login.php'", "$oldSession=$session;\n    $again=postTg('telegram-login.php'")
php=php.replace("$reload=apiTg('users.get');", "$old=postTg('telegram-api.php',['method'=>'users.get','payload'=>'{}','token'=>$oldSession['token'],'req_key'=>$oldSession['req_key']]);checkSmoke(($old['code']??0)===5,'Previous session not revoked');\n    $reload=apiTg('users.get');")
p.remote('root',r'''
import subprocess
r=subprocess.run(['runuser','-u','pripyat-tg-test','--','php'],input=PHP_CODE,cwd='/var/www/stalker-tg-test/public/server',capture_output=True,text=True,timeout=150)
print(r.stdout)
if r.returncode:
 print(r.stderr[-1800:]);raise RuntimeError('New VPS Telegram HTTPS smoke failed')
'''.replace('PHP_CODE',repr(php)))
