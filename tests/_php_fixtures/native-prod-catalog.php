<?php
// Executes the real callback with an in-memory identity lookup; no SQL connection or writes.
$root=dirname(__DIR__,2);$scenario=$argv[1]??'ok';$secret='fixture-only';
$config=['environment'=>'prod','enabled'=>true,'api_secret'=>$secret,'app_ids'=>['vk'=>'54574178','ok'=>'512005669202'],'launch_app_ids'=>['vk'=>'54574178','ok'=>'54574178'],'payments'=>['vk_enabled'=>true,'ok_enabled'=>true],'access'=>['vk'=>['ids'=>['382448269']],'ok'=>['ids'=>[],'native_ids'=>['587256562321']]],'databases'=>['stalker_ok'=>['host'=>'127.0.0.1','port'=>3306,'database'=>'stalker_ok','user'=>'unused','password'=>'unused']]];
$launch=['vk_app_id'=>'54574178','vk_ok_app_id'=>'512005669202','vk_client'=>'ok','vk_user_id'=>'73','vk_ok_user_id'=>$scenario==='other-native'?'587256562322':'587256562321','vk_ts'=>'100000'];
if($scenario==='other-ok-app')$launch['vk_ok_app_id']='512005669203';
ksort($launch);$launch['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($launch),$secret,true)),'+/','-_'),'=');
if($scenario==='tampered-native')$launch['vk_ok_user_id']='587256562322';
class CatalogLookup {function execute($args){global $scenario;if(count($args)!==2||$args[0]!==$args[1])throw new RuntimeException('Wrong identity lookup');}function fetchAll($mode){global $launch,$scenario;return $scenario==='missing'?[]:[['id'=>'73','vk_params'=>json_encode($launch)]];}}
class CatalogPDO {function __construct(...$args){}function prepare($sql){if(!str_starts_with($sql,'SELECT id,vk_params FROM secure WHERE id=? OR '))throw new RuntimeException('Unexpected SQL');return new CatalogLookup;}}
$path=tempnam(sys_get_temp_dir(),'prod-catalog-');file_put_contents($path,json_encode($config));putenv('PRIPYAT_NATIVE_PROD_CONFIG='.$path);register_shutdown_function(fn()=>unlink($path));
$_SERVER['REQUEST_METHOD']='POST';$_POST=['app_id'=>$scenario==='wrong-app'?'54679940':'54574178','user_id'=>$scenario==='vk'?'382448269':'73','notification_type'=>'get_item','item'=>$scenario==='vk'?'item0':'ok_item0'];
if(str_starts_with($scenario,'site-')){$_POST['site']='OK';$_POST['item']='item'.($argv[2]??'0');}
if(in_array($scenario,['site-native','site-ok-app'],true))$_POST['user_id']='587256562321';
if(in_array($scenario,['site-ok-app','site-ok-app-wrong-site'],true))$_POST['app_id']='512005669202';
if($scenario==='site-ok-app-wrong-site'){$_POST['site']='VK';$_POST['item']='item0';}
if($scenario==='site-other-app')$_POST['app_id']='512005669203';
if($scenario==='site-wrong-native')$_POST['user_id']='587256562322';
if($scenario==='site-vk-conflict'){$_POST['site']='VK';$_POST['item']='ok_item0';}
if($scenario==='site-unknown')$_POST['site']='OTHER';
if(isset($argv[3]))$_POST['item']=$argv[3];
ksort($_POST);$text='';foreach($_POST as $k=>$v)$text.=$k.'='.$v;$_POST['sig']=md5($text.$secret);
if($scenario==='forged')$_POST['sig']='invalid';
if($scenario==='site-tampered')$_POST['site']='VK';
$source=file_get_contents($root.'/server/native-prod-vk-pay.php');
$source=str_replace(["ini_set('error_log',__DIR__.'/php_errors.log');",'new PDO(', '__DIR__'],['','new CatalogPDO(',var_export($root.'/server',true)],$source);
eval(substr($source,5));
