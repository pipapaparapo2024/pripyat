<?php
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
$app=is_dir(__DIR__.'/../website/app')?__DIR__.'/../website/app':__DIR__.'/../app';
require_once $app.'/sitepayments.php';
require_once $app.'/paymentwebhook.php';
$audit=getenv('PRIPYAT_WEBHOOK_AUDIT_DIR')?:'/var/lib/pripyat-payment-webhooks';
$report=static fn(array $row)=>PaymentWebhook::record($audit,$row);
require_once __DIR__.'/core/models/nativeprodboundary.php';
$dispatched=false;
try{
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||(int)($_SERVER['CONTENT_LENGTH']??0)>65536){$report(['time'=>time(),'source'=>'webhook','attempt_id'=>bin2hex(random_bytes(16)),'payment_id'=>null,'world'=>null,'outcome'=>'rejected_request','http_status'=>400]);http_response_code(400);exit;}
 $c=json_decode(file_get_contents(__DIR__.'/../private/site-runtime.json'),true,32,JSON_THROW_ON_ERROR);
 $raw=file_get_contents('php://input',false,null,0,65537);if(strlen($raw)>65536)throw new InvalidArgumentException('too_large');$data=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
 if(!is_array($data))throw new InvalidArgumentException('invalid_payload');
 $dispatched=true;
 PaymentWebhook::handle($data,static fn($id)=>SiteYooKassa::lookup($c,$id),static function($id,$provider,$verified,$world)use($c){
 if($world==='telegram'){
  if($provider->isTest())throw new DomainException('invalid_payment_environment');
  $path=getenv('PRIPYAT_TELEGRAM_WEBSITE_PAYMENT_CONFIG');
  if(!is_string($path)||$path===''||!is_file($path))throw new RuntimeException('telegram_payment_config_missing');
  $telegram=json_decode((string)file_get_contents($path),true,16,JSON_THROW_ON_ERROR);
  if(($telegram['environment']??'')!=='prod'||($telegram['database']??'')!=='stalker_telegram'
   ||($telegram['host']??'')!=='127.0.0.1'||(int)($telegram['port']??0)!==3306
   ||!is_string($telegram['user']??null)||!is_string($telegram['password']??null))throw new RuntimeException('telegram_payment_config_invalid');
  $pdo=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram;charset=utf8mb4',$telegram['user'],$telegram['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
  return (new SitePayments($pdo,$provider,'telegram'))->settle($id,time());
 }
 if(!in_array($world,['site','vk','ok'],true))throw new DomainException('invalid_world');
 $d=$world==='site'?$c['database']:NativeProdBoundary::database($c['native'],$world);$expected=['site'=>'stalker_site_test','vk'=>'stalker','ok'=>'stalker_ok'][$world];if($d['database']!==$expected||$d['host']!=='127.0.0.1')throw new RuntimeException('invalid_database');
 $pdo=new PDO('mysql:host=127.0.0.1;dbname='.$expected.';charset=utf8mb4',$d['user'],$d['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
 return (new SitePayments($pdo,$provider,$world))->settle($id,time());
 },$report);echo '{}';
}catch(Throwable $e){if(!$dispatched){try{$report(['time'=>time(),'source'=>'webhook','attempt_id'=>bin2hex(random_bytes(16)),'payment_id'=>null,'world'=>null,'outcome'=>'error:'.get_class($e),'http_status'=>503]);}catch(Throwable $auditError){error_log('[site-payment-webhook] audit unavailable');}}error_log('[site-payment-webhook] failed type='.get_class($e));http_response_code(503);echo '{"error":"retry_later"}';}
