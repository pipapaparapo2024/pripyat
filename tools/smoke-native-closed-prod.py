"""Read-only HTTP gate/callback audit on loopback PROD. Never creates players/orders."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
php=r'''<?php
$c=json_decode(file_get_contents('/etc/pripyat/vk-ok-native-prod.json'),true);
function checkClosed($v,$message){if(!$v)throw new RuntimeException($message);}
function callClosed($path,$post=null){$ch=curl_init('http://127.0.0.1:8081'.$path);curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15]);if($post!==null)curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($post)]);$body=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);return [$status,$body];}
function launchClosed($platform,$uid){global $c;$a=['vk_user_id'=>$uid,'vk_ts'=>(string)time(),'vk_client'=>$platform==='ok'?'ok':'desktop_web','vk_app_id'=>$c['launch_app_ids'][$platform]??$c['app_ids'][$platform]];if($platform==='ok'){$a['vk_ok_app_id']=$c['app_ids']['ok'];$a['vk_ok_user_id']=$uid==='1113977365'?($c['access']['ok']['native_ids'][0]??'587256562321'):'587256562322';}ksort($a);$a['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($a),$c['api_secret'],true)),'+/','-_'),'=');return $a;}
foreach(['vk'=>'382448269','ok'=>'1113977365'] as $world=>$uid){
 foreach(['/client/ver0_41/','/client/ver0_41/index.html','/client/ver0_41/index.php'] as $path){
  [$status,$html]=callClosed($path.'?'.http_build_query(launchClosed($world,$uid)));checkClosed($status===200&&str_contains($html,'window.__closedNativeProd=true')&&str_contains($html,'index.js?v='),'Developer gate failed');
  [$status,$html]=callClosed($path.'?'.http_build_query(launchClosed($world,'42')));checkClosed($status===200&&str_contains($html,'Идут технические работы')&&!str_contains($html,'index.js?v='),'Ordinary player saw game');
 }
}
[$status,$html]=callClosed('/client/ver0_41/?vk_user_id=382448269&sign=forged');checkClosed(str_contains($html,'Идут технические работы'),'Forged developer entered');
$source=file_get_contents('/var/www/stalker-native-prod/server/universal-internal.php');preg_match('/\$b = json_decode\(\x27([^\x27]+)\x27/',$source,$match);$map=array_flip(json_decode($match[1],true));
foreach(['vk','ok'] as $world){
 $params=strtr(base64_encode(base64_encode(json_encode(launchClosed($world,'42')))),$map);
 [$status,$raw]=callClosed('/server/universal.php',['method'=>'security.getToken','uid'=>'42','platform'=>$world,'params'=>$params]);$reply=json_decode($raw,true);checkClosed($status===403&&($reply['maintenance']??false)===true,'Ordinary API not blocked');
 $bad=launchClosed($world,'382448269');$bad['sign']='forged';$params=strtr(base64_encode(base64_encode(json_encode($bad))),$map);
 [$status,$raw]=callClosed('/server/universal.php',['method'=>'security.getToken','uid'=>'382448269','platform'=>$world,'params'=>$params]);$reply=json_decode($raw,true);checkClosed($status===403&&($reply['maintenance']??false)===true&&($reply['reason']??'')==='invalid_launch','Forged API not blocked by signature validation');
}
foreach(['/server/client-shell.html','/server/core/models/registry.php','/server/universal-internal.php'] as $path){[$status,$body]=callClosed($path);checkClosed($status===404,'Internal source accessible');}
foreach([['vk','42'],['vk','438953352'],['vk','1113977365'],['ok','382448269']] as [$world,$uid]){
 [$status,$raw]=callClosed('/server/universal.php',['method'=>'users.devGetLogs','uid'=>$uid,'platform'=>$world,'params'=>'invalid','token'=>'forged']);$reply=json_decode($raw,true);
 checkClosed(in_array($status,[200,403],true)&&(($reply['status']??'')==='error'||($reply['maintenance']??false)===true)&&!isset($reply['logs'])&&!isset($reply['entries']),'Server logs exposed without a valid owner session');
}
[$status,$raw]=callClosed('/server/php_errors.log');checkClosed($status===404,'Raw log file accessible');
[$status,$raw]=callClosed('/server/universal_pay.php',['notification_type'=>'get_item']);checkClosed(isset(json_decode($raw,true)['error']),'Unsigned VK callback accepted');
[$status,$raw]=callClosed('/server/ok_pay_callback.php');checkClosed(isset(json_decode($raw,true)['error_code']),'Unsigned OK callback accepted');
echo "Closed PROD HTTP: both app IDs, three entry paths, developer-only shell, maintenance for others, API/forgery denial, internal files blocked, unsigned payment requests denied\n";
'''
p.remote('root',r'''
import subprocess,json
def counts():
 q=';'.join('SELECT COUNT(*) FROM '+db+'.'+table for db in ['stalker','stalker_ok'] for table in ['users','secure','trans'])+';SELECT COUNT(*) FROM stalker_ok.ok_payment_transactions;'
 r=subprocess.run(['mysql','--batch','--skip-column-names','-e',q],capture_output=True,text=True);assert r.returncode==0;return r.stdout.splitlines()
before=counts();r=subprocess.run(['php'],input=PHP,text=True,capture_output=True,timeout=100);print(r.stdout)
if r.returncode:print(r.stderr[-1000:]);raise RuntimeError('Closed PROD HTTP audit failed')
after=counts();assert before==after,'PROD data changed'
print(json.dumps({'prod_records_unchanged':True,'prod_players_sessions_orders':after}))
'''.replace('PHP',repr(php)))
