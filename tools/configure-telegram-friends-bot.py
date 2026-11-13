"""Enable command/webhook handling for TEST bot only. Does not change profile artwork/text."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('provision',ROOT/'tools/provision-new-server.py')
provision=importlib.util.module_from_spec(spec);spec.loader.exec_module(provision)
php=r'''<?php
$path='/etc/pripyat/telegram-test.php';$c=require $path;
if(($c['database']??'')!=='stalker_telegram_test'||($c['environment']??'')!=='test'||($c['enabled']??false)!==true)throw new RuntimeException('Wrong environment');
function configureBotCall($method,$body=[]){
    global $c;
    $env=$c['bot_api_environment']??'production';$port=(int)($c['bot_api_relay_port']??0);
    if($port!==10443||!in_array($env,['test','production'],true))throw new RuntimeException('TEST Telegram relay is not configured');
    $ch=curl_init('https://api.telegram.org/bot'.$c['bot_token'].'/'.($env==='test'?'test/':'').$method);
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body?:new stdClass),CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_CONNECT_TO=>['api.telegram.org:443:127.0.0.1:'.$port],CURLOPT_PROXY=>'']);
    $raw=curl_exec($ch);curl_close($ch);$r=json_decode($raw?:'',true);
    if(!($r['ok']??false))throw new RuntimeException('Bot configuration failed: '.$method);
    return $r['result'];
}
$before=configureBotCall('getWebhookInfo');$url=$before['url']??'';
if(!in_array($url,['https://tg-test-pripyat-game.ru/server/telegram-bot.php','https://tg-test-pripyat-game.ru:8443/server/telegram-bot.php'],true))throw new RuntimeException('Unexpected TEST webhook: refusing to modify it');
$backup='/var/backups/telegram-friends-bot-'.gmdate('YmdHis');mkdir($backup,0700);
copy($path,$backup.'/config-before.php');chmod($backup.'/config-before.php',0600);
file_put_contents($backup.'/webhook-before.json',json_encode($before));chmod($backup.'/webhook-before.json',0600);
file_put_contents($backup.'/commands-before.json',json_encode(configureBotCall('getMyCommands')));chmod($backup.'/commands-before.json',0600);
$commands=[['command'=>'start','description'=>'Добро пожаловать в Припять'],['command'=>'play','description'=>'Играть'],['command'=>'friends','description'=>'Друзья и удаление дружбы'],['command'=>'others','description'=>'Не друзья'],['command'=>'invite','description'=>'Пригласить друга'],['command'=>'support','description'=>'Связаться с поддержкой'],['command'=>'terms','description'=>'Условия покупок в Telegram'],['command'=>'paysupport','description'=>'Поддержка и вопросы по оплате']];
$ownerCommands=array_merge($commands,[['command'=>'supportlist','description'=>'Обращения поддержки'],['command'=>'allow','description'=>'Разрешить доступ: /allow Telegram_ID'],['command'=>'deny','description'=>'Отозвать доступ игроку'],['command'=>'access_list','description'=>'Список допущенных игроков'],['command'=>'supportplayers','description'=>'Управление помощниками поддержки'],['command'=>'paymentlist','description'=>'Последние Stars-платежи']]);
configureBotCall('setMyCommands',['commands'=>$commands]);
configureBotCall('setMyCommands',['scope'=>['type'=>'chat','chat_id'=>1355806786],'commands'=>$ownerCommands]);
$after=configureBotCall('getWebhookInfo');
if(($after['url']??'')!==$url)throw new RuntimeException('Webhook changed unexpectedly');
echo json_encode(['webhook'=>'unchanged','commands'=>array_column($commands,'command'),'owner_commands'=>array_column($ownerCommands,'command'),'backup'=>$backup,'profile_artwork_changed'=>false]);
'''
code='import subprocess,re\np=subprocess.run(["php"],input='+repr(php)+',capture_output=True,text=True)\nif p.returncode:\n m=re.search(r"Uncaught RuntimeException: ([^\\n]+) in Standard input",p.stderr)\n print(m.group(1) if m else "Private test-bot setup failed")\n raise RuntimeError("Bot configuration incomplete")\nprint(p.stdout)'
provision.remote('root',code)
