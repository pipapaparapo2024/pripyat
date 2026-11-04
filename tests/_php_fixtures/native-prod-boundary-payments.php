<?php
require __DIR__.'/../../server/core/models/nativeprodboundary.php';require __DIR__.'/../../server/core/models/vkprodpayments.php';
function prodCheck($condition,$text){if(!$condition)throw new RuntimeException($text);}
function prodReject($fn){try{$fn();}catch(Throwable $e){return;}throw new RuntimeException('Expected denial');}
function prodSign($p){ksort($p);$p['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($p),'fixture-secret',true)),'+/','-_'),'=');return $p;}
$c=['enabled'=>true,'environment'=>'prod','api_secret'=>'fixture-secret','app_ids'=>['vk'=>'54574178','ok'=>'512005669202'],'access'=>['vk'=>['ids'=>['382448269']],'ok'=>['ids'=>['1113977365']]],'databases'=>[]];
foreach(['stalker','stalker_ok'] as $name)$c['databases'][$name]=['host'=>'127.0.0.1','port'=>3306,'database'=>$name];
foreach(['vk'=>'382448269','ok'=>'1113977365'] as $p=>$uid){
 $launch=prodSign(['vk_user_id'=>$uid,'vk_ts'=>'100000','vk_app_id'=>$c['app_ids'][$p],'vk_client'=>$p==='ok'?'ok':'desktop_web']);
 $result=NativeProdBoundary::resolve($launch,$p,$uid,$c,100000);prodCheck($result['database']===($p==='ok'?'stalker_ok':'stalker'),'Wrong world');
 prodCheck(NativeProdBoundary::database($c,$p)['database']===$result['database'],'Wrong DB');
 prodReject(fn()=>NativeProdBoundary::resolve($launch,$p,'42',$c,100000));
 prodReject(fn()=>NativeProdBoundary::resolve($launch,$p==='ok'?'vk':'ok',$uid,$c,100000));
 $ordinary=prodSign(['vk_user_id'=>'42','vk_ts'=>'100000','vk_app_id'=>$c['app_ids'][$p],'vk_client'=>$p==='ok'?'ok':'desktop_web']);
 prodReject(fn()=>NativeProdBoundary::resolve($ordinary,$p,'42',$c,100000));
 $forged=$launch;$forged['sign']='forged';prodReject(fn()=>NativeProdBoundary::resolve($forged,$p,$uid,$c,100000));
 prodReject(fn()=>NativeProdBoundary::resolve($launch,$p,$uid,$c,200000));
 NativeProdBoundary::resolve($launch,$p,$uid,$c,200000,false);
}
$bad=$c;$bad['environment']='test';prodReject(fn()=>NativeProdBoundary::resolve([], 'vk','382448269',$bad,100000));
$okConfig=$c;$okConfig['launch_app_ids']['ok']='54574178';$okConfig['access']['ok']=['ids'=>[],'native_ids'=>['587256562321']];
$okLaunch=prodSign(['vk_app_id'=>'54574178','vk_ok_app_id'=>'512005669202','vk_client'=>'ok','vk_user_id'=>'73','vk_ok_user_id'=>'587256562321','vk_ts'=>'100000']);
prodCheck(NativeProdBoundary::resolve($okLaunch,'ok','73',$okConfig,100000)['database']==='stalker_ok','Native OK owner denied or wrong DB');
prodCheck(NativeProdBoundary::launchAppId($okConfig,'ok')==='54574178','OK bridge app ID confused with OK app ID');
foreach(['vk_ok_user_id'=>'587256562322','vk_ok_app_id'=>'512005669203','vk_app_id'=>'54679940','vk_client'=>'desktop_web'] as $key=>$value){
 $changed=$okLaunch;unset($changed['sign']);$changed[$key]=$value;$changed=prodSign($changed);
 prodReject(fn()=>NativeProdBoundary::resolve($changed,'ok','73',$okConfig,100000));
}
$forged=$okLaunch;$forged['vk_ok_user_id']='587256562322';prodReject(fn()=>NativeProdBoundary::resolve($forged,'ok','73',$okConfig,100000));
prodReject(fn()=>NativeProdBoundary::resolve($okLaunch,'vk','73',$okConfig,100000));
$bad=$c;$bad['databases']['stalker']['database']='stalker_test';prodReject(fn()=>NativeProdBoundary::database($bad,'vk'));
foreach(['users.resetAllPlayers','users.resetSession','users.devUnknown','shmot.devGrantShmot',null,[]] as $method)prodCheck(!NativeProdBoundary::allowsMethod($method),'Dangerous method');
foreach(['users.get','users.save','shmot.equip','users.devGrantShmot','users.devGetLogs'] as $method)prodCheck(NativeProdBoundary::allowsMethod($method),'Legitimate method');
prodCheck(NativeProdBoundary::allowsAccountMethod('users.devGetLogs','382448269','vk'),'Owner logs unavailable');
prodCheck(!NativeProdBoundary::allowsAccountMethod('users.devGetLogs','382448269','ok'),'VK owner ID reused as OK identity');
foreach(['438953352','184138040','1113977365','42'] as $uid)prodCheck(!NativeProdBoundary::allowsAccountMethod('users.devGetLogs',$uid,'vk'),'Owner logs exposed to other accounts');
function prodPaySign($p){ksort($p);$text='';foreach($p as $k=>$v)$text.=$k.'='.$v;$p['sig']=md5($text.'fixture-secret');return $p;}
$pay=['app_id'=>'54574178','user_id'=>'382448269','notification_type'=>'get_item','item'=>'item0'];
VkProdPayments::verify(prodPaySign($pay),'fixture-secret','54574178',['382448269']);
$test=array_replace($pay,['notification_type'=>'order_status_change_test']);prodReject(fn()=>VkProdPayments::verify(prodPaySign($test),'fixture-secret','54574178',['382448269']));
$wrong=array_replace($pay,['app_id'=>'54679940']);prodReject(fn()=>VkProdPayments::verify(prodPaySign($wrong),'fixture-secret','54574178',['382448269']));
prodReject(fn()=>VkProdPayments::verify(prodPaySign($pay),'fixture-secret','54574178',['42']));
$catalog=VkProdPayments::catalog(json_decode(file_get_contents(__DIR__.'/../../server/json/donuts.json'),true));prodCheck(count($catalog)===32&&$catalog[0]['price']===1,'Catalog');
foreach($catalog as $product)prodCheck(!str_contains($product['title'],'TEST'),'TEST title in PROD');
echo "Закрытый PROD: подпись, app_id обеих площадок, developer-only, изоляция БД, методы и каталог оплаты проверены\n";

// Explicit closed developer sandbox; defaults remain strict.
VkProdPayments::verify(prodPaySign($test),'fixture-secret','54574178',['382448269'],true);
prodReject(fn()=>VkProdPayments::verify(prodPaySign($test),'fixture-secret','54574178',['42'],true));
class SandboxLedgerProbe extends PDO {
 public $active=false; public $params=null;
 function __construct(){}
 function beginTransaction():bool{$this->active=true;return true;}
 function inTransaction():bool{return $this->active;}
 function rollBack():bool{$this->active=false;return true;}
 function prepare(string $query,array $options=[]):PDOStatement|false{return new SandboxStatementProbe($this);}
}
class SandboxStatementProbe extends PDOStatement {
 function __construct(private SandboxLedgerProbe $db){}
 function execute(?array $params=null):bool{$this->db->params=$params;throw new RuntimeException('probe_stop_before_any_write');}
}
foreach(['order_status_change'=>'123','order_status_change_test'=>'-123'] as $type=>$expected){
 $probe=new SandboxLedgerProbe();$receipt=['notification_type'=>$type,'user_id'=>'382448269','order_id'=>'123','status'=>'chargeable'];
 prodReject(fn()=>VkProdPayments::credit($probe,$receipt,$catalog[0],100000,true));
 prodCheck($probe->params[0]===$expected,'Sandbox and real order IDs collide');prodCheck(!$probe->active,'Failed sandbox operation not rolled back');
}

prodCheck(NativeProdBoundary::allowsAccountMethod('users.devGetLogs','382448269','ok',['vk_ok_user_id'=>'587256562321']),'OK owner panel logs denied');
prodCheck(!NativeProdBoundary::allowsAccountMethod('users.devGetLogs','382448269','ok',['vk_ok_user_id'=>'587256562322']),'Other OK native identity got owner logs');
