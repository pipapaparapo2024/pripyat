<?php
define('OK_PAY_CALLBACK_TEST_MODE',true);require __DIR__.'/../../server/ok_pay_callback.php';
function proof753($uid=42,$native='587256562321',$overrides=[]){
 $p=array_replace(['vk_app_id'=>'54574178','vk_client'=>'ok','vk_user_id'=>strval($uid),'vk_ok_user_id'=>$native,'vk_ts'=>'1'],$overrides);ksort($p);
 $p['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($p),'fixture-secret',true)),'+/','-_'),'=');
 return ['id'=>strval($uid),'vk_params'=>$p];
}
function check753($rows,$expected){$got=OkPayCallback::resolveGameUid('587256562321',$rows,'fixture-secret',54574178);if($got!==$expected)throw new Exception('Identity resolution mismatch');}
$valid=proof753();check753([$valid],42);$json=$valid;$json['vk_params']=json_encode($json['vk_params']);check753([$json],42);
check753([],0);check753([['error'=>true]],0);check753([['id'=>42,'vk_params'=>'broken']],0);
$tampered=$valid;$tampered['vk_params']['vk_user_id']='43';check753([$tampered],0);
$tampered=$valid;$tampered['vk_params']['sign']='invalid';check753([$tampered],0);
$tampered=$valid;$tampered['id']='43';check753([$tampered],0);
check753([proof753(42,'different')],0);check753([proof753(42,'587256562321',['vk_client'=>'vk'])],0);check753([proof753(42,'587256562321',['vk_app_id'=>'1'])],0);
check753([$valid,proof753(43)],0);check753([$valid,$valid],42);
echo "Signed OK identity mapping: native/game IDs differ, valid JSON proof, old session, missing/tampered/wrong app/client/subject and ambiguous links passed\n";
