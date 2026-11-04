<?php
require __DIR__.'/../../server/core/models/nativetestboundary.php';
function launchNative($platform,$uid,$now){$a=['vk_user_id'=>$uid,'vk_ts'=>(string)$now,'vk_client'=>$platform==='ok'?'ok':'desktop_web'];ksort($a);$a['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($a),'fixture-key',true)),'+/','-_'),'=');return $a;}
function nativeReject($f){try{$f();}catch(InvalidArgumentException $e){return;}throw new RuntimeException('Ожидался отказ');}
$policy=['vk'=>['ids'=>['42']]];$now=time();
foreach(['vk','ok'] as $p){$r=NativeTestBoundary::resolve(launchNative($p,'42',$now),$p,'42','fixture-key',$policy,$now);if($r['database']!==($p==='vk'?'stalker_test':'stalker_ok_test'))throw new RuntimeException('Wrong database');}
nativeReject(fn()=>NativeTestBoundary::resolve(launchNative('vk','42',$now),'ok','42','fixture-key',$policy,$now));
nativeReject(fn()=>NativeTestBoundary::resolve(launchNative('ok','42',$now),'vk','42','fixture-key',$policy,$now));
nativeReject(fn()=>NativeTestBoundary::resolve(launchNative('vk','43',$now),'vk','43','fixture-key',$policy,$now));
nativeReject(fn()=>NativeTestBoundary::resolve(launchNative('vk','42',$now),'vk','43','fixture-key',$policy,$now));
nativeReject(fn()=>NativeTestBoundary::resolve(launchNative('vk','42',$now),'vk','42','wrong-key',$policy,$now));
nativeReject(fn()=>NativeTestBoundary::resolve(launchNative('vk','42',$now-86401),'vk','42','fixture-key',$policy,$now));
if(NativeTestBoundary::resolve(launchNative('ok','99',$now*1000),'ok','99','fixture-key',$policy,$now)['uid']!==99)throw new RuntimeException('OK open/ms failed');
echo "Native TEST: подпись, время, uid, закрытый ВК, открытый ОК и изоляция БД проверены\n";
$testLaunch=['vk_app_id'=>'54679940','vk_user_id'=>'42','vk_ts'=>(string)$now,'vk_platform'=>'desktop_web'];
ksort($testLaunch);$testLaunch['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($testLaunch),'test-app-secret',true)),'+/','-_'),'=');
nativeReject(fn()=>NativeTestBoundary::resolve($testLaunch,'vk','42','production-app-secret',$policy,$now,'54574178'));
nativeReject(fn()=>NativeTestBoundary::resolve($testLaunch,'vk','42','production-app-secret',$policy,$now,'54679940'));
$r=NativeTestBoundary::resolve($testLaunch,'vk','42','test-app-secret',$policy,$now,'54679940');
if($r['database']!=='stalker_test'||$r['uid']!==42)throw new RuntimeException('TEST app signature mismatch regression');
echo "Разные TEST/PROD app_id и ключи: чужая конфигурация отвергается, правильный TEST проходит\n";
