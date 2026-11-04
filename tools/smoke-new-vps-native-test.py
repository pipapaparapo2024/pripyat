"""Synthetic VK/OK launch, isolation and save smoke. TEST fixtures only; no DDL."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
php=r'''<?php
$c=json_decode(file_get_contents('/etc/pripyat/vk-ok-native-test.json'),true);$uid='999000715';
function checkNative($v,$label){if(!$v)throw new RuntimeException($label);}
function dbNative($name){global $c;$v=$c['databases'][$name];return new PDO('mysql:host=127.0.0.1;dbname='.$name.';charset=utf8mb4',$v['user'],$v['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);}
foreach($c['databases'] as $name=>$v){$db=dbNative($name);foreach(['users','secure'] as $t){$q=$db->prepare('SELECT COUNT(*) FROM '.$t.' WHERE id=?');$q->execute([$uid]);checkNative($q->fetchColumn()==0,'Fixture collision');}}
$source=file_get_contents('/var/www/stalker-native-test/server/universal-internal.php');preg_match('/\$b = json_decode\(\x27([^\x27]+)\x27/',$source,$match);$map=array_flip(json_decode($match[1],true));
function postNative($method,$params,$platform,$token='',$key='',$postedUid=null){
 global $map,$uid;
 $payload=strtr(base64_encode(base64_encode(json_encode($params,JSON_UNESCAPED_UNICODE))),$map);
 $ch=curl_init('https://test-pripyat-game.ru/server/universal.php');
 curl_setopt_array($ch,[CURLOPT_RESOLVE=>['test-pripyat-game.ru:443:127.0.0.1'],CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query(['method'=>$method,'params'=>$payload,'uid'=>$postedUid??$uid,'platform'=>$platform,'token'=>$token,'req_key'=>$key]),CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15]);
 $raw=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);$result=json_decode($raw?:'',true);
 if(!is_array($result))throw new RuntimeException('Invalid API JSON HTTP '.$status);return $result;
}
function signedNative($p){global $c,$uid;$a=['vk_user_id'=>$uid,'vk_ts'=>(string)time(),'vk_client'=>$p==='ok'?'ok':'desktop_web','vk_app_id'=>(string)$c['api_id']];ksort($a);$a['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($a),$c['api_secret'],true)),'+/','-_'),'=');return $a;}
try{
 foreach(['ok'] as $platform){
  $launch=signedNative($platform);$bad=$launch;$bad['sign']='forged';checkNative((postNative('security.getToken',$bad,$platform)['code']??0)===47,'Forged launch accepted');
  checkNative((postNative('security.getToken',$launch,'vk')['code']??0)===47,'Cross-platform launch accepted');
  $session=postNative('security.getToken',$launch,$platform);checkNative(isset($session['token'],$session['req_key']),'Signed login failed');
  $get=postNative('users.get',[],$platform,$session['token'],$session['req_key']);checkNative(isset($get['udata']),'users.get failed');
  $save=postNative('users.save',['udata_json'=>json_encode(['nick'=>'Native TEST fixture','snd_vol'=>'0.27'])],$platform,$session['token'],$get['req_key']);checkNative(($save['status']??'')!=='error','save failed');
  $again=postNative('security.getToken',$launch,$platform);$get=postNative('users.get',[],$platform,$again['token'],$again['req_key']);checkNative(($get['udata']['nick']??'')==='Native TEST fixture','Persistence failed');
  $db=dbNative('stalker_test');$q=$db->prepare('SELECT COUNT(*) FROM users WHERE id=?');$q->execute([$uid]);checkNative($q->fetchColumn()==0,'OK wrote VK DB');
 }
 $vk=postNative('security.getToken',signedNative('vk'),'vk');checkNative(($vk['code']??0)===47,'Unlisted VK accepted');
 echo "Native TEST HTTPS: OK signed launch/load/save/relogin, VK gate, forged signature and cross-world rejection verified\n";
}finally{
 foreach($c['databases'] as $name=>$v){$db=dbNative($name);foreach(['secure','users'] as $t){$q=$db->prepare('DELETE FROM '.$t.' WHERE id=?');$q->execute([$uid]);}}
 echo "Native TEST fixtures removed; no real players changed\n";
}
'''
p.remote('root',"import subprocess\nr=subprocess.run(['php'],input="+repr(php)+",text=True,capture_output=True,timeout=100)\nprint(r.stdout)\nif r.returncode:print(r.stderr[-1600:]);raise RuntimeError('Native TEST smoke failed')")
