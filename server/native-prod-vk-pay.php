<?php
ini_set('display_errors','0');ini_set('log_errors','1');ini_set('error_log',__DIR__.'/php_errors.log');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
require_once __DIR__.'/core/models/nativeprodconfig.php';require_once __DIR__.'/core/models/nativeprodboundary.php';require_once __DIR__.'/core/models/vkprodpayments.php';
try{
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST')throw new InvalidArgumentException('post_required');
    $c=NativeProdConfig::load();if(($c['enabled']??false)!==true)throw new RuntimeException('disabled');
    // An OK catalog notification carries the native OK app ID; its launch proof uses the paired VK ID.
    // Select only between the two explicitly configured apps, never an arbitrary submitted app_id.
    $postedSite=is_string($_POST['site']??null)?strtoupper($_POST['site']):'';
    $postedApp=is_scalar($_POST['app_id']??null)?(string)$_POST['app_id']:'';
    $expectedApp=$postedSite==='OK'&&$postedApp===(string)$c['app_ids']['ok']
        ?(string)$c['app_ids']['ok']:NativeProdBoundary::launchAppId($c,'vk');
    $input=VkProdPayments::verifySignature($_POST,$c['api_secret'],$expectedApp);
    $raw=$input['item']??'';$site=strtoupper((string)($input['site']??''));
    if(!in_array($site,['','VK','OK'],true))throw new InvalidArgumentException('invalid_platform');
    $okPrefix=is_string($raw)&&str_starts_with($raw,'ok_item');
    if($site==='VK'&&$okPrefix)throw new InvalidArgumentException('invalid_platform');
    $okCatalog=$site==='OK'||$okPrefix;$platform=$okCatalog?'ok':'vk';
    if(($c['payments'][$platform.'_enabled']??false)!==true)throw new RuntimeException('disabled');
    $sandbox=$platform==='vk'&&($c['payments']['vk_developer_sandbox']??false)===true;
    if($okCatalog){
        if(!in_array($input['notification_type']??'', ['get_item','get_item_test'],true))throw new InvalidArgumentException('invalid_notification');
        $candidate=(string)($input['user_id']??'');
        if(!preg_match('/^[1-9][0-9]{0,17}$/D',$candidate))throw new InvalidArgumentException('developer_required');
        $db=NativeProdBoundary::database($c,'ok');
        $lookup=new PDO('mysql:host=127.0.0.1;dbname=stalker_ok;charset=utf8mb4',$db['user'],$db['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $q=$lookup->prepare("SELECT id,vk_params FROM secure WHERE id=? OR JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(vk_params),vk_params,'{}'),'$.vk_ok_user_id'))=?");$q->execute([$candidate,$candidate]);
        $matches=[];
        foreach($q->fetchAll(PDO::FETCH_ASSOC) as $row){
            $launch=json_decode($row['vk_params'],true,32,JSON_THROW_ON_ERROR);$game=(string)$row['id'];
            if($candidate!==$game&&$candidate!==(string)($launch['vk_ok_user_id']??''))continue;
            NativeProdBoundary::resolve($launch,'ok',$game,$c,time(),false);$matches[$game]=true;
        }
        if(count($matches)!==1)throw new InvalidArgumentException('developer_required');
    }else{
        $input=VkProdPayments::verify($_POST,$c['api_secret'],NativeProdBoundary::launchAppId($c,'vk'),$c['access']['vk']['ids'],$sandbox);
    }
    $catalogRequest=in_array($input['notification_type'],['get_item','get_item_test'],true);
    if($okCatalog&&!$catalogRequest)throw new InvalidArgumentException('invalid_notification');
    $id=VkProdPayments::productId($catalogRequest?($okPrefix?substr($raw,3):($input['item']??null)):($input['item_id']??null));
    $prices=json_decode(file_get_contents(__DIR__.'/json/donuts.json'),true,32,JSON_THROW_ON_ERROR);$catalog=VkProdPayments::catalog($prices);
    if(!isset($catalog[$id]))throw new InvalidArgumentException('unknown_product');$product=$catalog[$id];
    if($catalogRequest){
        $icons=['stew'=>'donate_stew_icon.png','coins'=>'donate_coins_icon.png','cigarettes'=>'donate_sukhari_icon.png','energy'=>'donate_energy_icon.png'];
        $response=['item_id'=>$id,'title'=>$product['title'],'price'=>$product['price'],'photo_url'=>'https://pripyat-game.ru/server/images/'.$icons[$product['field']]];
        if($okCatalog){require_once __DIR__.'/core/models/okpaymentitem.php';$response=OkPaymentItem::response('ok_item'.$id,[$id=>$response],$prices);if($response)$response['item_id']=$raw;if(!$response)throw new InvalidArgumentException('unknown_product');}
        error_log('[native-prod-pay] platform='.$platform.' stage=catalog product='.$id.' price='.(int)$response['price']);
        echo json_encode(['response'=>$response],JSON_UNESCAPED_UNICODE);exit;
    }
    $db=NativeProdBoundary::database($c,'vk');
    $pdo=new PDO('mysql:host=127.0.0.1;dbname=stalker;charset=utf8mb4',$db['user'],$db['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
    $stage=VkProdPayments::credit($pdo,$input,$product,time(),$sandbox);
    error_log('[native-prod-pay] platform=vk stage='.$stage.' mode='.(($input['notification_type']??'')==='order_status_change_test'?'sandbox':'real').' order_hash='.hash('sha256',(string)$input['order_id']));
    echo json_encode(['response'=>['order_id'=>(int)$input['order_id']]]);
}catch(Throwable $e){
    $known=['invalid_signature','wrong_app','production_notifications_only','developer_required','invalid_product','unknown_product','invalid_order','receiver_mismatch','price_mismatch','transaction_conflict','unknown_player','post_required','invalid_notification','invalid_platform'];
    $reason=in_array($e->getMessage(),$known,true)?$e->getMessage():'temporarily_unavailable';
    $notification=$_POST['notification_type']??'';
    $notification=is_string($notification)&&in_array($notification,['get_item','get_item_test','order_status_change','order_status_change_test'],true)?$notification:'unknown';
    $logPlatform=in_array($platform??'', ['vk','ok'],true)?$platform:'unknown';
    $logSite=is_string($_POST['site']??null)&&in_array(strtoupper($_POST['site']),['VK','OK'],true)?strtoupper($_POST['site']):'absent';
    $buyer=$_POST['user_id']??'';$buyerDigits=is_scalar($buyer)&&ctype_digit((string)$buyer)?strlen((string)$buyer):0;
    error_log('[native-prod-pay] platform='.$logPlatform.' stage=rejected reason='.$reason.' notification='.$notification.' site='.$logSite.' buyer_digits='.$buyerDigits.' app_id='.(is_scalar($_POST['app_id']??null)&&preg_match('/^[0-9]{1,18}$/D',(string)$_POST['app_id'])?(string)$_POST['app_id']:'invalid'));
    echo json_encode(['error'=>['error_code'=>100,'error_msg'=>'Payment unavailable: '.$reason,'critical'=>$reason!=='temporarily_unavailable']]);
}
