<?php
ini_set('display_errors','0');ini_set('log_errors','1');ini_set('error_log',__DIR__.'/php_errors.log');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
define('OK_PAY_CALLBACK_TEST_MODE',true);
require __DIR__.'/ok-pay-legacy-core.php';require __DIR__.'/core/models/okpaymentcredit.php';
try{
    if(($_SERVER['REQUEST_METHOD']??'')!=='GET')throw new InvalidArgumentException('get_required');
    $path=getenv('PRIPYAT_NATIVE_TEST_CONFIG');if(!$path||!is_file($path))throw new RuntimeException('disabled');
    $c=json_decode(file_get_contents($path),true,32,JSON_THROW_ON_ERROR);
    if(($c['environment']??'')!=='test'||($c['ok_test_callbacks_enabled']??false)!==true)throw new RuntimeException('disabled');
    foreach($_GET as $v)if(!is_scalar($v))throw new InvalidArgumentException('invalid_payload');
    if(!OkPayCallback::checkSig($_GET,$c['api_secret']))throw new InvalidArgumentException('invalid_signature');
    $uid=(string)($_GET['uid']??'');$tid=(string)($_GET['transaction_id']??'');
    if(!preg_match('/^[1-9][0-9]{0,19}$/D',$uid)||!preg_match('/^[A-Za-z0-9_-]{1,128}$/D',$tid))throw new InvalidArgumentException('invalid_receipt');
    if(isset($_GET['currency'])&&!in_array(strtolower((string)$_GET['currency']),['ok',''],true))throw new InvalidArgumentException('invalid_currency');
    $prices=json_decode(file_get_contents(__DIR__.'/json/donuts.json'),true,32,JSON_THROW_ON_ERROR);
    $id=OkPayCallback::parseProductCode($_GET['product_code']??null);$catalog=OkPayCallback::itemCatalog($prices);$price=OkPayCallback::priceCatalog($prices)[$id]??null;
    if(!isset($catalog[$id])||$price===null||!OkPayCallback::amountMatches($price,$_GET['amount']??null))throw new InvalidArgumentException('product_or_price_mismatch');
    $db=$c['databases']['stalker_ok_test'];if($db['database']!=='stalker_ok_test')throw new RuntimeException('database_mismatch');
    $link=new mysqli('127.0.0.1',$db['user'],$db['password'],'stalker_ok_test',3306);$link->set_charset('utf8mb4');
    [$field,$count]=$catalog[$id];
    $result=OkPaymentCredit::credit($link,$uid,$tid,$id,(int)$_GET['amount'],$field,$count,function()use($link,$uid,$c){
        $q=$link->prepare("SELECT id,vk_params FROM secure WHERE JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(vk_params),vk_params,'{}'),'$.vk_ok_user_id'))=?");$q->bind_param('s',$uid);$q->execute();$rows=$q->get_result()->fetch_all(MYSQLI_ASSOC);$q->close();
        return OkPayCallback::resolveGameUid($uid,$rows,$c['api_secret'],$c['api_id']);
    });
    $link->close();error_log('[native-test-pay] platform=ok stage='.($result['duplicate']?'duplicate':'credited').' order_hash='.hash('sha256',$tid).' product='.$id);echo 'true';
}catch(Throwable $e){
    $known=['get_required','invalid_payload','invalid_signature','invalid_receipt','invalid_currency','product_or_price_mismatch','transaction_conflict','account_mapping_missing'];
    $reason=in_array($e->getMessage(),$known,true)?$e->getMessage():'temporarily_unavailable';
    error_log('[native-test-pay] platform=ok stage=rejected reason='.$reason);header('Invocation-error: 1001');echo json_encode(['error_code'=>1001,'error_msg'=>'TEST payment rejected: '.$reason,'error_data'=>null]);
}
