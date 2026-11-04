<?php
ini_set('display_errors','0');ini_set('log_errors','1');ini_set('error_log',__DIR__.'/php_errors.log');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
require __DIR__.'/core/models/vktestpayments.php';
try{
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST')throw new InvalidArgumentException('post_required');
    $path=getenv('PRIPYAT_NATIVE_TEST_CONFIG');if(!$path||!is_file($path))throw new RuntimeException('disabled');
    $c=json_decode(file_get_contents($path),true,32,JSON_THROW_ON_ERROR);
    if(($c['environment']??'')!=='test'||($c['vk_test_callbacks_enabled']??false)!==true)throw new RuntimeException('disabled');
    $input=VkTestPayments::verify($_POST,$c['api_secret'],(string)$c['api_id'],$c['access']['vk']['ids']);
    $catalogRequest=in_array($input['notification_type'],['get_item','get_item_test'],true);
    $id=VkTestPayments::productId($catalogRequest?($input['item']??null):($input['item_id']??null));
    $catalog=VkTestPayments::catalog(json_decode(file_get_contents(__DIR__.'/json/donuts.json'),true,32,JSON_THROW_ON_ERROR));
    if(!isset($catalog[$id]))throw new InvalidArgumentException('unknown_product');$product=$catalog[$id];
    if($catalogRequest){
        $icons=['stew'=>'donate_stew_icon.png','coins'=>'donate_coins_icon.png','cigarettes'=>'donate_sukhari_icon.png','energy'=>'donate_energy_icon.png'];
        error_log('[native-test-pay] platform=vk stage=catalog notification='.$input['notification_type'].' product='.$id);
        echo json_encode(['response'=>['item_id'=>$id,'title'=>'[TEST] '.$product['title'],'price'=>$product['price'],'photo_url'=>'https://test-pripyat-game.ru/server/images/'.$icons[$product['field']]]],JSON_UNESCAPED_UNICODE);exit;
    }
    $db=$c['databases']['stalker_test'];if($db['database']!=='stalker_test')throw new RuntimeException('database_mismatch');
    $pdo=new PDO('mysql:host=127.0.0.1;dbname=stalker_test;charset=utf8mb4',$db['user'],$db['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
    $stage=VkTestPayments::credit($pdo,$input,$product,time());
    error_log('[native-test-pay] platform=vk stage='.$stage.' order_hash='.hash('sha256',(string)$input['order_id']).' product='.$id.' player='.(int)$input['user_id']);
    echo json_encode(['response'=>['order_id'=>(int)$input['order_id']]]);
}catch(Throwable $e){
    $known=['invalid_signature','wrong_app','test_notifications_only','tester_required','invalid_product','unknown_product','invalid_order','receiver_mismatch','price_mismatch','transaction_conflict','unknown_player','post_required'];
    $reason=in_array($e->getMessage(),$known,true)?$e->getMessage():'temporarily_unavailable';
    $notification=$_POST['notification_type']??null;
    $notification=is_string($notification)&&in_array($notification,['get_item','get_item_test','order_status_change','order_status_change_test'],true)?$notification:'unknown';
    $testMode=$_POST['test_mode']??null;
    $testMode=is_scalar($testMode)&&in_array((string)$testMode,['0','1','true','false'],true)?(string)$testMode:'absent';
    error_log('[native-test-pay] platform=vk stage=rejected reason='.$reason.' notification='.$notification.' test_mode='.$testMode);
    echo json_encode(['error'=>['error_code'=>100,'error_msg'=>'TEST payment rejected: '.$reason,'critical'=>$reason!=='temporarily_unavailable']]);
}
