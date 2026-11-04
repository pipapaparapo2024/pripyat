"""Read-only HTTPS checks of current closed PROD access and VK catalog. No login/write calls."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
php=r'''<?php
$c=json_decode(file_get_contents('/etc/pripyat/vk-ok-native-prod.json'),true);
function checkLive($v,$message){if(!$v)throw new RuntimeException($message);}
function httpLive($path,$data=null){
 $ch=curl_init('https://pripyat-game.ru'.$path);
 curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15,CURLOPT_RESOLVE=>['pripyat-game.ru:443:127.0.0.1']]);
 if($data!==null)curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($data)]);
 $body=curl_exec($ch);checkLive($body!==false,'HTTPS request failed');$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);return [$status,$body];
}
function signLive($a,$payment=false){global $c;ksort($a);if($payment){$text='';foreach($a as $k=>$v)$text.=$k.'='.$v;$a['sig']=md5($text.$c['api_secret']);}else{$a['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($a),$c['api_secret'],true)),'+/','-_'),'=');}return $a;}
$vk=['vk_app_id'=>'54574178','vk_client'=>'desktop_web','vk_user_id'=>'382448269','vk_ts'=>(string)time()];
$ok=['vk_app_id'=>'54574178','vk_ok_app_id'=>'512005669202','vk_client'=>'ok','vk_user_id'=>'73','vk_ok_user_id'=>'587256562321','vk_ts'=>(string)time()];
foreach([$vk,$ok] as $launch){[$status,$body]=httpLive('/client/ver0_41/?'.http_build_query(signLive($launch)));checkLive($status===200&&str_contains($body,'window.__closedNativeProd=true'),'Owner entry failed');checkLive(str_contains($body,'"vk":true'),'VK payment flag not enabled');}
foreach([$vk+[],array_replace($ok,['vk_ok_user_id'=>'587256562322']),array_replace($ok,['vk_ok_app_id'=>'512005669203'])] as $i=>$launch){
 if($i===0)$launch['vk_user_id']='42';
 [$status,$body]=httpLive('/client/ver0_41/?'.http_build_query(signLive($launch)));checkLive(str_contains($body,'Идут технические работы')&&!str_contains($body,'index.js?v='),'Unauthorized shell exposed');
}
$request=['app_id'=>'54574178','user_id'=>'382448269','notification_type'=>'get_item','item'=>'item0'];
[$status,$raw]=httpLive('/server/universal_pay.php',signLive($request,true));$reply=json_decode($raw,true);
checkLive($status===200&&isset($reply['response']['title'])&&$reply['response']['price']===1&&!str_contains($reply['response']['title'],'TEST'),'VK production catalog failed');
if(($c['payments']['ok_enabled']??false)===true){
 $db=$c['databases']['stalker_ok'];$pdo=new PDO('mysql:host=127.0.0.1;dbname=stalker_ok;charset=utf8mb4',$db['user'],$db['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $q=$pdo->prepare("SELECT id FROM secure WHERE JSON_UNQUOTE(JSON_EXTRACT(vk_params,'$.vk_ok_user_id'))=?");$q->execute(['587256562321']);$uid=$q->fetchColumn();
 if($uid!==false){
  [$status,$raw]=httpLive('/server/universal_pay.php',signLive(['app_id'=>'54574178','user_id'=>(string)$uid,'notification_type'=>'get_item','item'=>'ok_item0'],true));$okReply=json_decode($raw,true);
  checkLive(($okReply['response']['item_id']??'')==='ok_item0'&&($okReply['response']['price']??0)===7,'OK production catalog failed');
  foreach(['ok_item0','item0'] as $sku){
   [$status,$raw]=httpLive('/server/universal_pay.php',signLive(['app_id'=>'54574178','user_id'=>'587256562321','site'=>'OK','notification_type'=>'get_item','item'=>$sku],true));$nativeReply=json_decode($raw,true);
   checkLive(($nativeReply['response']['item_id']??'')===$sku&&($nativeReply['response']['price']??0)===7,'Signed site/native OK catalog failed');
  }
  [$status,$raw]=httpLive('/server/universal_pay.php',signLive(['app_id'=>'512005669202','user_id'=>'587256562321','site'=>'OK','notification_type'=>'get_item','item'=>'ok_item2'],true));$pairedReply=json_decode($raw,true);
  checkLive(($pairedReply['response']['item_id']??'')==='ok_item2'&&($pairedReply['response']['price']??0)===42,'Paired native OK app ID catalog failed');
  echo "OK catalog through saved signed owner identity: correct namespace and price, no credit performed.\n";
 }
}
[$status,$icon]=httpLive('/server/images/donate_stew_icon.png');checkLive($status===200&&strlen($icon)>100,'Payment icon missing');
$bad=signLive($request,true);$bad['sig']='forged';[$status,$raw]=httpLive('/server/universal_pay.php',$bad);checkLive(isset(json_decode($raw,true)['error']),'Forged catalog accepted');
$test=['app_id'=>'54574178','user_id'=>'42','notification_type'=>'order_status_change_test','order_id'=>'999000718','status'=>'chargeable','item_id'=>'0','item_price'=>'1'];
[$status,$raw]=httpLive('/server/universal_pay.php',signLive($test,true));checkLive(str_contains($raw,'production_notifications_only')||str_contains($raw,'developer_required'),'Non-developer sandbox receipt accepted');
foreach(['/server/client-shell.html','/server/php_errors.log','/server/core/models/registry.php'] as $path){[$status,$body]=httpLive($path);checkLive($status===404,'Private file exposed');}
echo "HTTPS: signed VK/OK owners admitted, other identities/apps blocked; VK catalog 1 vote without TEST, icon OK; forged/non-developer sandbox receipts denied; private files blocked. No player login or purchase performed.\n";
'''
p.remote('root',r'''
import subprocess
def counts():
 q=';'.join('SELECT COUNT(*) FROM '+db+'.trans' for db in ['stalker','stalker_ok'])+';SELECT COUNT(*) FROM stalker_ok.ok_payment_transactions;'
 return subprocess.run(['mysql','-NBe',q],check=True,capture_output=True,text=True).stdout
before=counts();r=subprocess.run(['php'],input=PHP,text=True,capture_output=True,timeout=100)
print(r.stdout)
if r.returncode:raise RuntimeError(r.stderr[-1000:])
assert counts()==before,'Payment ledger changed during check'
print('PROD payment counts unchanged')
'''.replace('PHP',repr(php)))
