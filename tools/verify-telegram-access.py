"""Read-only final check of private access permissions, command scopes and fixture cleanup."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py');release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
php=r'''<?php
require '/var/www/stalker-tg-test/public/server/core/models/telegramaccess.php';
require '/var/www/stalker-tg-test/public/server/core/models/telegrambotclient.php';
$c=require '/etc/pripyat/telegram-test.php';$access=new TelegramAccess;$allowed=$access->listing(TelegramAccess::OWNER);
foreach($allowed as $id)if((int)$id>=4503599627370400)throw new RuntimeException('Synthetic access not removed');
$bot=new TelegramBotClient($c['bot_token']);$owner=array_column($bot->call('getMyCommands',['scope'=>['type'=>'chat','chat_id'=>(int)TelegramAccess::OWNER]]),'command');
$public=array_column($bot->call('getMyCommands',[]),'command');
foreach(['allow','deny','access_list'] as $command)if(!in_array($command,$owner,true)||in_array($command,$public,true))throw new RuntimeException('Command scope mismatch');
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram_test;charset=utf8mb4',$c['db_user'],$c['db_password']);
if((int)$db->query('SELECT COUNT(*) FROM telegram_identities WHERE telegram_id BETWEEN 4503599627370400 AND 4503599627370495')->fetchColumn()!==0)throw new RuntimeException('Synthetic identity not removed');
if((int)$db->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='stalker_telegram_test'")->fetchColumn()!==17)throw new RuntimeException('Unexpected table count');
echo json_encode(['allowed_telegram_ids'=>$allowed,'owner_commands'=>'verified','public_menu_has_no_access_commands'=>true,'synthetic_identities_remaining'=>0,'telegram_tables'=>17]);
'''
code='''import subprocess,pathlib,stat,pwd
p=pathlib.Path('/var/lib/pripyat-tg-test/access.json')
assert stat.S_IMODE(p.stat().st_mode)==0o600 and p.stat().st_uid==pwd.getpwnam('pripyat-tg-test').pw_uid,'Private allowlist permissions'
r=subprocess.run(['runuser','-u','pripyat-tg-test','--','php'],input=PHP,cwd='/var/www/stalker-tg-test/public/server',capture_output=True,text=True)
assert r.returncode==0,'Private final access verification failed'
print(r.stdout)
'''.replace('PHP',repr(php))
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
