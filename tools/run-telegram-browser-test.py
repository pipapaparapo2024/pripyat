"""Synthetic host browser check, not a real Telegram client. Fixture-only cleanup."""
from pathlib import Path
import importlib.util,json,subprocess,os
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
external='4503599627370402'
php=r'''<?php
$c=require '/etc/pripyat/telegram-test.php';
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram_test;charset=utf8mb4',$c['db_user'],$c['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$id='EXTERNAL';$q=$db->prepare('SELECT player_id FROM telegram_identities WHERE telegram_id=?');$q->execute([$id]);
if($q->fetchColumn()!==false)throw new RuntimeException('Fixture exists');
require '/var/www/stalker-tg-test/public/server/core/models/telegramaccess.php';
(new TelegramAccess)->change(TelegramAccess::OWNER,$id,true);
$f=['auth_date'=>(string)time(),'user'=>json_encode(['id'=>(int)$id,'first_name'=>'Browser Fixture'])];ksort($f);$l=[];foreach($f as $k=>$v)$l[]=$k.'='.$v;
$f['hash']=hash_hmac('sha256',implode("\n",$l),hash_hmac('sha256',$c['bot_token'],'WebAppData',true));
echo json_encode(['init_data'=>http_build_query($f)]);
'''.replace('EXTERNAL',external)
def remote_php(source):
    code='import subprocess\np=subprocess.run(["runuser","-u","pripyat-tg-test","--","php"],input='+repr(source)+',cwd="/var/www/stalker-tg-test/public/server",capture_output=True,text=True)\nassert p.returncode==0,"Private fixture operation failed"\nprint(p.stdout)'
    client=release.connect()
    try:return release.run_remote_python(client,code)
    finally:client.close()
fixture=json.loads(remote_php(php))
fixture['screenshot']=str(ROOT/'_client/telegram-build/telegram-smoke.png')
cleanup=r'''<?php
$c=require '/etc/pripyat/telegram-test.php';$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram_test;charset=utf8mb4',$c['db_user'],$c['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
require '/var/www/stalker-tg-test/public/server/core/models/telegramaccess.php';
(new TelegramAccess)->change(TelegramAccess::OWNER,'EXTERNAL',false);
$q=$db->prepare('SELECT player_id FROM telegram_identities WHERE telegram_id=?');$q->execute(['EXTERNAL']);$uid=$q->fetchColumn();
if($uid){$db->beginTransaction();
foreach(['telegram_payment_transactions','telegram_payment_orders','telegram_sessions','telegram_roles'] as $t){$s=$db->prepare("DELETE FROM `$t` WHERE player_id=?");$s->execute([$uid]);}
$s=$db->prepare('DELETE FROM telegram_friend_invites WHERE owner_player_id=?');$s->execute([$uid]);
$s=$db->prepare('DELETE FROM users WHERE id=?');$s->execute([$uid]);
$s=$db->prepare('DELETE FROM telegram_identities WHERE player_id=? AND telegram_id=?');$s->execute([$uid,'EXTERNAL']);$db->commit();}
echo 'Synthetic browser fixture removed';
'''.replace('EXTERNAL',external)
env=os.environ.copy()
env['PLAYWRIGHT_MODULE_PATH']=str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
try:
    result=subprocess.run(['node',str(ROOT/'tools/browser-telegram-test.cjs')],input=json.dumps(fixture),text=True,env=env,cwd=ROOT)
    if result.returncode:raise SystemExit(result.returncode)
finally:print(remote_php(cleanup))
