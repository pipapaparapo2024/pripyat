<?php
require __DIR__.'/../../server/core/controllers/security.php';
class Launch742Tools {public $code=null,$result=null;function error($code){$this->code=$code;}function output($data){$this->result=$data;}}
class Launch742DB {function saveData($table,$data){}}
function attempt742($client,$timestamp,$bad=false){
    $p=['vk_user_id'=>'999000715','vk_ts'=>(string)$timestamp];if($client!==null)$p['vk_client']=$client;
    ksort($p);$p['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($p),'test-only-key',true)),'+/','-_'),'=');
    if($bad)$p['sign']='invalid';$tools=new Launch742Tools();
    $controller=new Security(['user_params'=>$p,'api_secret'=>'test-only-key','uid'=>999000715,'tools'=>$tools,'udb'=>new Launch742DB()]);
    $controller->getToken();return $tools;
}
$now=time();
foreach([[null,$now,null],['ok',$now*1000,null],['ok',$now,null],['ok',($now-90000)*1000,8],['ok',($now+1000)*1000,8],[null,$now*1000,8],['ok','invalid',8]] as [$client,$ts,$expected]){
    $r=attempt742($client,$ts);if($r->code!==$expected)throw new Exception('Unexpected launch result');
    if($expected===null && empty($r->result['token']))throw new Exception('Token missing');
}
if(attempt742('ok',$now*1000,true)->code!==0)throw new Exception('Signature bypass');
echo "PASS: OK milliseconds, seconds, expired/future/invalid; VK unchanged; invalid signature denied\n";
