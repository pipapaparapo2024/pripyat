<?php
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
require_once __DIR__.'/../app/sitepayments.php';
require_once __DIR__.'/core/models/nativeprodboundary.php';
try{
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||(int)($_SERVER['CONTENT_LENGTH']??0)>65536){http_response_code(400);exit;}
 $c=json_decode(file_get_contents(__DIR__.'/../private/site-runtime.json'),true,32,JSON_THROW_ON_ERROR);
 $raw=file_get_contents('php://input',false,null,0,65537);if(strlen($raw)>65536)throw new InvalidArgumentException('too_large');$data=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
 if(($data['type']??'')!=='notification'||!in_array($data['event']??'',['payment.succeeded','payment.canceled'],true)){http_response_code(200);echo '{}';exit;}
 $id=(string)($data['object']['id']??'');if(!preg_match('/^[a-zA-Z0-9-]{1,64}$/D',$id))throw new InvalidArgumentException('invalid_payment');
 [$provider,$verified]=SiteYooKassa::lookup($c,$id);$world=$verified['metadata']['game_world']??'site';if(!in_array($world,['site','vk','ok'],true))throw new DomainException('invalid_world');
 $d=$world==='site'?$c['database']:NativeProdBoundary::database($c['native'],$world);$expected=['site'=>'stalker_site_test','vk'=>'stalker','ok'=>'stalker_ok'][$world];if($d['database']!==$expected||$d['host']!=='127.0.0.1')throw new RuntimeException('invalid_database');
 $pdo=new PDO('mysql:host=127.0.0.1;dbname='.$expected.';charset=utf8mb4',$d['user'],$d['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
 (new SitePayments($pdo,$provider,$world))->settle($id,time());echo '{}';
}catch(Throwable $e){error_log('[site-payment-webhook] failed type='.get_class($e));http_response_code(503);echo '{"error":"retry_later"}';}
