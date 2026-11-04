<?php
ini_set('error_log', PHP_OS_FAMILY === 'Windows' ? 'NUL' : '/dev/null');
define('OK_PAY_CALLBACK_TEST_MODE',true);
require __DIR__.'/../../server/ok_pay_callback.php';
require __DIR__.'/../../server/core/models/okpaymentitem.php';
$source=file_get_contents(__DIR__.'/../../server/universal_pay.php');
eval(substr($source,strpos($source,'function start(){')));
class PaymentFakeDB { function getData(...$args){return ['id'=>1];} function saveData(...$args){throw new Exception('Metadata must not write DB');} }
$registry=['api_secret'=>'fixture-secret','prices'=>json_decode(file_get_contents(__DIR__.'/../../server/json/donuts.json'),true),'links'=>array_fill_keys(['stew','coins','cigarettes','energy'],'https://example.org/icon.png'),'uid'=>1,'udb'=>new PaymentFakeDB(),'utb'=>'users'];
loadResponses(); $original=$registry['resps'];
foreach(OkPayCallback::priceCatalog($registry['prices']) as $id=>$price){
    $_POST=['item'=>'ok_item'.$id,'notification_type'=>'get_item','user_id'=>1]; ksort($_POST); $input=''; foreach($_POST as $k=>$v)$input.=$k.'='.$v;
    $_POST['sig']=md5($input.$registry['api_secret']);
    ob_start(); start(); $response=json_decode(ob_get_clean(),true)['response']??null;
    if(!$response || $response['price']!==intval($price) || $response['item_id']!=='ok_item'.$id || OkPayCallback::parseProductCode($response['item_id'])!==intval($id))throw new Exception('OK metadata mismatch');
}
if($registry['resps']!==$original)throw new Exception('VK response changed');
foreach(['get_item','get_item_test'] as $type){
 $_POST=['item'=>'item2','notification_type'=>$type,'user_id'=>1,'site'=>'VK'];ksort($_POST);$input='';foreach($_POST as $k=>$v)$input.=$k.'='.$v;$_POST['sig']=md5($input.$registry['api_secret']);
 ob_start();start();$vk=json_decode(ob_get_clean(),true)['response']??null;
 if($vk!==$original[2])throw new Exception('VK signed metadata changed');
}
$_POST=['item'=>'ok_item8','notification_type'=>'get_item','sig'=>'invalid']; ob_start();start();$denied=json_decode(ob_get_clean(),true);
if(!isset($denied['error']))throw new Exception('Invalid signature allowed');
foreach(['garbage','item-2','ok_item-1','2oops',null,[],9999] as $bad)if(OkPayCallback::parseProductCode($bad)!==-1)throw new Exception('Malformed product accepted');
foreach([0,2,23,100,107] as $id)if(OkPayCallback::parseProductCode(strval($id))!==$id)throw new Exception('Legacy FAPI code broken');
if(OkPayCallback::parseProductCode('item2')!==2)throw new Exception('Site OK item code broken');
echo "OK metadata: all products and energy prices match webhook; VK catalog unchanged; signature enforced; no DB writes\n";
