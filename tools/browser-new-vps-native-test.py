"""Synthetic host VK/OK boot test; isolated TEST fixture and temporary VK allowlist entry."""
from pathlib import Path
import importlib.util,subprocess,json,os
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
def remote(code):
 r=subprocess.run(p.SSH+['root@'+p.HOST,'python3 -'],input=code,text=True,encoding='utf-8',capture_output=True,timeout=30)
 if r.returncode:raise RuntimeError('Private fixture operation failed; diagnostics suppressed')
 return r.stdout
setup=r'''
from pathlib import Path
import json,subprocess,os
path=Path('/etc/pripyat/vk-ok-native-test.json');c=json.loads(path.read_text());uid='999000715'
assert uid not in c['access']['vk']['ids']
php=r"""<?php
$c=json_decode(stream_get_contents(STDIN),true);$uid='999000715';$out=[];
foreach($c['databases'] as $name=>$v){$db=new PDO('mysql:host=127.0.0.1;dbname='.$name,$v['user'],$v['password']);foreach(['users','secure'] as $t){$q=$db->prepare('SELECT COUNT(*) FROM '.$t.' WHERE id=?');$q->execute([$uid]);if($q->fetchColumn()!=0)throw new RuntimeException('Fixture collision');}}
foreach(['vk','ok'] as $p){$v=['vk_user_id'=>$uid,'vk_ts'=>(string)time(),'vk_app_id'=>(string)$c['api_id'],'vk_client'=>$p==='ok'?'ok':'desktop_web'];ksort($v);$v['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($v),$c['api_secret'],true)),'+/','-_'),'=');$out[$p]=$v;}
echo json_encode(['launches'=>$out]);
"""
r=subprocess.run(['php','-r',php.removeprefix('<?php')],input=json.dumps(c),capture_output=True,text=True);assert r.returncode==0
c['access']['vk']['ids'].append(uid);path.write_text(json.dumps(c));path.chmod(0o640)
print(r.stdout)
'''
data=json.loads(remote(setup))
cleanup=r'''
from pathlib import Path
import json,subprocess
path=Path('/etc/pripyat/vk-ok-native-test.json');c=json.loads(path.read_text());uid='999000715'
c['access']['vk']['ids']=[v for v in c['access']['vk']['ids'] if v!=uid];path.write_text(json.dumps(c));path.chmod(0o640)
php=r"""<?php
$c=json_decode(stream_get_contents(STDIN),true);
foreach($c['databases'] as $name=>$v){$db=new PDO('mysql:host=127.0.0.1;dbname='.$name,$v['user'],$v['password']);foreach(['secure','users'] as $t){$q=$db->prepare('DELETE FROM '.$t.' WHERE id=?');$q->execute(['999000715']);}}
"""
r=subprocess.run(['php','-r',php.removeprefix('<?php')],input=json.dumps(c),capture_output=True,text=True);assert r.returncode==0
print('Native browser fixtures removed, VK allowlist restored')
'''
env=os.environ.copy();env['PLAYWRIGHT_MODULE_PATH']=str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
try:
 r=subprocess.run(['node',str(ROOT/'tools/browser-native-test.cjs')],input=json.dumps(data),text=True,encoding='utf-8',env=env,cwd=ROOT)
 if r.returncode:raise RuntimeError('Native browser check failed')
finally:print(remote(cleanup))
