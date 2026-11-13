"""Enable owner-only Stars payments in Telegram TEST; never touches PROD."""
from pathlib import Path
import subprocess

PHP = r'''<?php
$path='/etc/pripyat/telegram-test.php';
$c=require $path;
if(($c['environment']??'')!=='test'||($c['database']??'')!=='stalker_telegram_test'||($c['enabled']??false)!==true)
    throw new RuntimeException('Wrong Telegram environment');
if(($c['stars_enabled']??false)!==false)throw new RuntimeException('Stars flag is not false; refusing implicit reconfiguration');
require '/var/www/stalker-tg-test/public/server/core/models/telegramaccess.php';
require '/var/www/stalker-tg-test/public/server/core/models/telegrambotclient.php';
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram_test;charset=utf8mb4',$c['db_user'],$c['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
foreach(['telegram_payment_orders','telegram_payment_transactions'] as $table)$db->query("SELECT 1 FROM `$table` LIMIT 0");
$orders=(int)$db->query('SELECT COUNT(*) FROM telegram_payment_orders')->fetchColumn();
$transactions=(int)$db->query('SELECT COUNT(*) FROM telegram_payment_transactions')->fetchColumn();
if($orders!==0||$transactions!==0)throw new RuntimeException('Stars tables are not empty; review pending test activity first');
$allowed=(new TelegramAccess)->listing(TelegramAccess::OWNER);
$bot=new TelegramBotClient($c['bot_token'],$c['bot_api_environment']??'production',null,$c['bot_api_relay_port']??null);
$me=$bot->call('getMe',[]);$webhook=$bot->call('getWebhookInfo',[]);
$updates=$webhook['allowed_updates']??[];
if(($me['username']??'')!=='pripyat_game_test_bot'||!in_array('pre_checkout_query',$updates,true)||
   (int)($webhook['pending_update_count']??-1)!==0||!empty($webhook['last_error_date']))
    throw new RuntimeException('Telegram TEST bot/webhook is not ready');
$backup='/var/backups/telegram-stars-enable-'.gmdate('YmdHis');
if(!mkdir($backup,0700))throw new RuntimeException('Cannot create private backup');
if(!copy($path,$backup.'/config-before.php'))throw new RuntimeException('Cannot back up private config');
chmod($backup.'/config-before.php',0600);
$c['stars_enabled']=true;
$tmp=$path.'.'.bin2hex(random_bytes(8)).'.tmp';
try{
    $bytes="<?php\nreturn ".var_export($c,true).";\n";
    if(file_put_contents($tmp,$bytes,LOCK_EX)!==strlen($bytes))throw new RuntimeException('Cannot write private config');
    chgrp($tmp,'pripyat-tg-test');chmod($tmp,0640);
    if(!rename($tmp,$path))throw new RuntimeException('Cannot atomically activate Stars');
}finally{if(is_file($tmp))unlink($tmp);}
$verify=require $path;
if(($verify['stars_enabled']??false)!==true||($verify['database']??'')!=='stalker_telegram_test')throw new RuntimeException('Private config verification failed');
echo json_encode(['environment'=>'test','stars_enabled'=>true,'database'=>'stalker_telegram_test',
    'bot_username'=>$me['username'],'allowed_telegram_ids'=>array_values($allowed),
    'webhook_pending'=>0,'payment_orders_before'=>0,'payment_transactions_before'=>0,
    'private_config_backup'=>$backup],JSON_THROW_ON_ERROR);
'''

ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','-i',str(Path.home()/'.ssh/id_ed25519_stalker'),
     'root@135.106.159.212','php']
result=subprocess.run(ssh,input=PHP,capture_output=True,text=True,encoding='utf-8',timeout=60)
if result.returncode:
    print(result.stderr[-1600:])
    raise RuntimeError('Could not enable Stars in Telegram TEST')
print(result.stdout)
