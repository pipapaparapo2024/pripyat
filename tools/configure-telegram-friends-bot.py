"""Enable command/webhook handling for TEST bot only. Does not change profile artwork/text."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
php=r'''<?php
$path='/etc/pripyat/telegram-test.php';$c=require $path;
if($c['database']!=='stalker_telegram_test'||$c['enabled']!==true)throw new RuntimeException('Wrong environment');
function configureBotCall($method,$body=[]){
    global $c;
    $ch=curl_init('https://api.telegram.org/bot'.$c['bot_token'].'/'.$method);
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body?:new stdClass),CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20]);
    $raw=curl_exec($ch);curl_close($ch);$r=json_decode($raw?:'',true);
    if(!($r['ok']??false))throw new RuntimeException('Bot configuration failed: '.$method);
    return $r['result'];
}
$before=configureBotCall('getWebhookInfo');$url='https://tg-test-pripyat-game.ru/server/telegram-bot.php';
if(($before['url']??'')!==''&&$before['url']!==$url)throw new RuntimeException('Existing unrelated webhook: refusing overwrite');
$backup='/var/backups/telegram-friends-bot-'.gmdate('YmdHis');mkdir($backup,0700);
copy($path,$backup.'/config-before.php');chmod($backup.'/config-before.php',0600);
file_put_contents($backup.'/webhook-before.json',json_encode($before));chmod($backup.'/webhook-before.json',0600);
file_put_contents($backup.'/commands-before.json',json_encode(configureBotCall('getMyCommands')));chmod($backup.'/commands-before.json',0600);
if(empty($c['webhook_secret'])){
    $c['webhook_secret']=bin2hex(random_bytes(32));
    $tmp=$backup.'/config-new.php';file_put_contents($tmp,"<?php\nreturn ".var_export($c,true).";\n");chmod($tmp,0600);
    // Preserve existing bot token and DB credentials; only add the webhook secret.
    file_put_contents($path,file_get_contents($tmp));chgrp($path,'pripyat-tg-test');chmod($path,0640);
}
$commands=[['command'=>'start','description'=>'Добро пожаловать в Припять'],['command'=>'play','description'=>'Играть'],['command'=>'friends','description'=>'Друзья и удаление дружбы'],['command'=>'others','description'=>'Не друзья'],['command'=>'invite','description'=>'Пригласить друга'],['command'=>'paysupport','description'=>'Помощь с оплатой Stars']];
configureBotCall('setMyCommands',['commands'=>$commands]);
configureBotCall('setMyCommands',['scope'=>['type'=>'chat','chat_id'=>1355806786],'commands'=>array_merge($commands,[['command'=>'allow','description'=>'Разрешить доступ: /allow Telegram_ID'],['command'=>'deny','description'=>'Отозвать доступ: /deny Telegram_ID'],['command'=>'access_list','description'=>'Список допущенных игроков']])]);
configureBotCall('setWebhook',['url'=>$url,'secret_token'=>$c['webhook_secret'],'allowed_updates'=>['message','callback_query','pre_checkout_query'],'max_connections'=>4,'drop_pending_updates'=>false]);
$after=configureBotCall('getWebhookInfo');
if($after['url']!==$url)throw new RuntimeException('Webhook mismatch');
echo json_encode(['webhook'=>'configured','commands'=>array_column($commands,'command'),'backup'=>$backup,'profile_artwork_changed'=>false]);
'''
code='import subprocess,re\np=subprocess.run(["php"],input='+repr(php)+',capture_output=True,text=True)\nif p.returncode:\n m=re.search(r"Uncaught RuntimeException: ([^\\n]+) in Standard input",p.stderr)\n print(m.group(1) if m else "Private test-bot setup failed")\n raise RuntimeError("Bot configuration incomplete")\nprint(p.stdout)'
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
