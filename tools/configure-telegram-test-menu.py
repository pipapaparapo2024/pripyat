"""Configure the TEST bot menu only. Does not send chat messages."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
php=r'''<?php
$c=require '/etc/pripyat/telegram-test.php';
function botMenuCall($method,$body){
    global $c;
    $ch=curl_init('https://api.telegram.org/bot'.$c['bot_token'].'/'.$method);
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body),CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20]);
    $raw=curl_exec($ch);curl_close($ch);$result=json_decode($raw?:'',true);
    if(!($result['ok']??false)){echo json_encode(['method'=>$method,'code'=>$result['error_code']??null,'description'=>$result['description']??'network_error']);exit(2);}
    return $result['result'];
}
$before=botMenuCall('getChatMenuButton',new stdClass);
$path='/var/backups/telegram-test-menu-'.gmdate('YmdHis');mkdir($path,0700);
file_put_contents($path.'/before.json',json_encode($before));chmod($path.'/before.json',0600);
$button=['type'=>'web_app','text'=>'Играть · TEST','web_app'=>['url'=>'https://tg-test-pripyat-game.ru/']];
botMenuCall('setChatMenuButton',['menu_button'=>$button]);
$after=botMenuCall('getChatMenuButton',new stdClass);
if(rtrim($after['web_app']['url']??'','/')!==rtrim($button['web_app']['url'],'/')){echo json_encode(['menu_after'=>$after]);throw new RuntimeException('Menu mismatch');}
echo json_encode(['test_bot_menu'=>'configured','url'=>$after['web_app']['url'],'backup'=>$path]);
'''
code='import subprocess,re\np=subprocess.run(["php"],input='+repr(php)+',capture_output=True,text=True)\nprint(p.stdout)\nif p.returncode: print(re.sub(r"bot[0-9]+:[A-Za-z0-9_-]+","bot[redacted]",p.stderr[-1200:]))\nassert p.returncode==0,"Private bot-menu configuration failed"'
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
