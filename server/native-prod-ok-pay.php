<?php
ini_set('display_errors','0');ini_set('log_errors','1');ini_set('error_log',__DIR__.'/php_errors.log');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
// Library-only switch; this does not enable sandbox payments.
define('OK_PAY_CALLBACK_TEST_MODE',true);require __DIR__.'/ok-pay-legacy-core.php';
require_once __DIR__.'/core/models/nativeprodconfig.php';require_once __DIR__.'/core/models/nativeprodboundary.php';require_once __DIR__.'/core/models/okprodpaymentcredit.php';
try{
    if(($_SERVER['REQUEST_METHOD']??'')!=='GET')throw new InvalidArgumentException('get_required');
    $c=NativeProdConfig::load();if(($c['enabled']??false)!==true||($c['payments']['ok_enabled']??false)!==true)throw new RuntimeException('disabled');
    foreach($_GET as $v)if(!is_scalar($v))throw new InvalidArgumentException('invalid_payload');
    if(!OkPayCallback::checkSig($_GET,$c['api_secret']))throw new InvalidArgumentException('invalid_signature');
    $native=(string)($_GET['uid']??'');$tid=(string)($_GET['transaction_id']??'');
    if(isset($_GET['currency'])&&!in_array(strtolower((string)$_GET['currency']),['ok',''],true))throw new InvalidArgumentException('invalid_currency');
    $prices=json_decode(file_get_contents(__DIR__.'/json/donuts.json'),true,32,JSON_THROW_ON_ERROR);
    $id=OkPayCallback::parseProductCode($_GET['product_code']??null);$catalog=OkPayCallback::itemCatalog($prices);$price=OkPayCallback::priceCatalog($prices)[$id]??null;
    if(!isset($catalog[$id])||$price===null||!OkPayCallback::amountMatches($price,$_GET['amount']??null))throw new InvalidArgumentException('product_or_price_mismatch');
    $db=NativeProdBoundary::database($c,'ok');$pdo=new PDO('mysql:host=127.0.0.1;dbname=stalker_ok;charset=utf8mb4',$db['user'],$db['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
    [$field,$count]=$catalog[$id];
    $stage=OkProdPaymentCredit::credit($pdo,$native,$tid,$id,(int)$price,$field,$count,function()use($pdo,$native,$c){
        $q=$pdo->prepare("SELECT id,vk_params FROM secure WHERE JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(vk_params),vk_params,'{}'),'$.vk_ok_user_id'))=?");$q->execute([$native]);$rows=$q->fetchAll(PDO::FETCH_ASSOC);
        $uid=OkPayCallback::resolveGameUid($native,$rows,$c['api_secret'],NativeProdBoundary::launchAppId($c,'ok'));
        if($uid<=0)throw new RuntimeException('account_mapping_missing');
        foreach($rows as $row)if((string)$row['id']===(string)$uid){
            $launch=json_decode($row['vk_params'],true,32,JSON_THROW_ON_ERROR);
            NativeProdBoundary::resolve($launch,'ok',(string)$uid,$c,time(),false);
            return $uid;
        }
        throw new RuntimeException('account_mapping_missing');
    },time());
    error_log('[native-prod-pay] platform=ok stage='.$stage.' order_hash='.hash('sha256',$tid));echo 'true';
}catch(Throwable $e){
    $known=['get_required','invalid_payload','invalid_signature','invalid_receipt','invalid_currency','product_or_price_mismatch','transaction_conflict','account_mapping_missing','unknown_player'];
    $reason=in_array($e->getMessage(),$known,true)?$e->getMessage():'temporarily_unavailable';
    error_log('[native-prod-pay] platform=ok stage=rejected reason='.$reason);header('Invocation-error: 1001');echo json_encode(['error_code'=>1001,'error_msg'=>'Payment unavailable: '.$reason,'error_data'=>null]);
}
