"""New VPS synthetic host test: save/reload/friends; no invoices or real accounts."""
from pathlib import Path
import ast,subprocess,importlib.util,json,os,tempfile
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
tree=ast.parse((ROOT/'tools/run-telegram-browser-test.py').read_text(encoding='utf-8'))
def fixture(name):
 node=next(n.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id==name for t in n.targets))
 return ast.literal_eval(node.func.value).replace('EXTERNAL','4503599627370402')
def remote_php(php):
 code="import subprocess\nr=subprocess.run(['runuser','-u','pripyat-tg-test','--','php'],input="+repr(php)+",cwd='/var/www/stalker-tg-test/public/server',capture_output=True,text=True)\nif r.returncode:raise RuntimeError('Private fixture operation failed')\nprint(r.stdout)"
 r=subprocess.run(p.SSH+['root@'+p.HOST,'python3 -'],input=code,text=True,encoding='utf-8',capture_output=True,timeout=60)
 if r.returncode:raise RuntimeError('Fixture operation failed; private diagnostic suppressed')
 return r.stdout
prepare=fixture('php')
prepare=prepare.replace("$f=['auth_date'", "require '/var/www/stalker-tg-test/public/server/core/models/rewardlinktargets.php';\n$label='new-vps-browser-reward-fixture';$q=$db->prepare('SELECT COUNT(*) FROM reward_links WHERE label=?');$q->execute([$label]);if($q->fetchColumn()!=0)throw new RuntimeException('Reward fixture collision');\n$rewardCode=RewardLinkTargets::code('test','telegram');$q=$db->prepare('INSERT INTO reward_links(code,reward,label,created_at,active) VALUES (?,?,?,?,1)');$q->execute([$rewardCode,json_encode([['kind'=>'currency','field'=>'coins','amount'=>7]]),$label,time()]);\n$f=['auth_date'")
prepare=prepare.replace(';ksort($f);',";$f['start_param']='g_'.$rewardCode;ksort($f);")
data=json.loads(remote_php(prepare))
data['screenshot']=str(ROOT/'_client/telegram-build/new-vps-browser-smoke.png')
source=(ROOT/'tools/browser-telegram-test.cjs').read_text(encoding='utf-8')
start=source.index('        const payment=');end=source.index("        if(loaded.platform",start)
source=source[:start]+"        if(await page.evaluate(()=>!!window.telegramEruda))throw new Error('Developer console visible to ordinary player');\n"+source[end:]
source=source.replace("console.log('Telegram browser: игровой экран загружен');","await page.waitForFunction(()=>Number(udata.coins)===17,null,{timeout:20000});\n        console.log('Telegram browser: игровой экран и награда загружены');")
source=source.replace("await page.reload({waitUntil:'domcontentloaded'});", "const repeatedReward=page.waitForResponse(r=>new URL(r.url()).pathname==='/server/telegram-api.php'&&new URLSearchParams(r.request().postData()).get('method')==='rewardlinks.claim',{timeout:150000});\n        await page.reload({waitUntil:'domcontentloaded'});")
source=source.replace("const restored=await page.evaluate", "const receipt=await(await repeatedReward).json();if(receipt.reason!=='already'||await page.evaluate(()=>Number(udata.coins))!==17)throw new Error('Reward duplicated after reload');\n        const restored=await page.evaluate")
source=source.replace("args:['--mute-audio']","args:['--mute-audio','--no-proxy-server','--host-resolver-rules=MAP tg-test-pripyat-game.ru 135.106.159.212']")
env=os.environ.copy();env['PLAYWRIGHT_MODULE_PATH']=str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
script=ROOT/'_client/telegram-build/new-vps-browser-smoke.cjs';script.write_text(source,encoding='utf-8')
try:
 result=subprocess.run(['node',str(script)],input=json.dumps(data),text=True,encoding='utf-8',env=env,cwd=ROOT)
 if result.returncode:raise RuntimeError('New VPS browser smoke failed')
finally:
 cleanup=fixture('cleanup')
 cleanup=cleanup.replace("$s=$db->prepare('DELETE FROM users WHERE id=?');", "$s=$db->prepare('DELETE FROM reward_link_claims WHERE user_id=?');$s->execute([$uid]);\n$s=$db->prepare('DELETE FROM reward_links WHERE label=?');$s->execute(['new-vps-browser-reward-fixture']);\n$s=$db->prepare('DELETE FROM users WHERE id=?');")
 print(remote_php(cleanup))
