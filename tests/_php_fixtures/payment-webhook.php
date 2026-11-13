<?php
require __DIR__.'/../../website/app/paymentwebhook.php';
$payload=['type'=>'notification','event'=>'payment.succeeded','object'=>['id'=>'payment-1','metadata'=>['game_world'=>'evil'],'secret'=>'never-log-this']];
foreach(['credited','already_credited','pending','canceled','lookup_error','settle_error','invalid_world','ignored','invalid_id'] as $case){
 $events=[];$calls=0;$p=$payload;
 if($case==='ignored')$p['event']='ignored';if($case==='invalid_id')$p['object']['id']='../secret';
 try{PaymentWebhook::handle($p,function($id)use($case){if($case==='lookup_error')throw new RuntimeException('never-log-this');return [null,['metadata'=>['game_world'=>$case==='invalid_world'?'evil':'vk']]];},function($id,$provider,$verified,$world)use($case,&$calls){$calls++;if($world!=='vk')throw new LogicException('unverified world');if($case==='settle_error')throw new DomainException('never-log-this');return $case;},function($row)use(&$events){$events[]=$row;});}catch(Throwable $e){if(!in_array($case,['lookup_error','settle_error','invalid_world','invalid_id'],true))throw $e;}
 if(count(array_unique(array_column($events,'attempt_id')))!==1||$events[0]['outcome']!=='received'||str_contains(json_encode($events),'never-log-this'))throw new RuntimeException('Audit invariant');
 $last=end($events);$error=in_array($case,['lookup_error','settle_error','invalid_world','invalid_id'],true);
 if($last['http_status']!==($error?503:200))throw new RuntimeException('HTTP audit mismatch');
 if($calls!==(in_array($case,['ignored','invalid_id','invalid_world','lookup_error'],true)?0:1))throw new RuntimeException('Unsafe settlement');
}
$dir=sys_get_temp_dir().'/webhook-audit-'.bin2hex(random_bytes(8));mkdir($dir);
try{PaymentWebhook::record($dir,['payment_id'=>'x','outcome'=>'credited']);if(json_decode(file_get_contents($dir.'/deliveries.jsonl'),true)['outcome']!=='credited')throw new RuntimeException('Journal write failed');}finally{unlink($dir.'/deliveries.jsonl');rmdir($dir);}
echo "Webhook: API routing, duplicate/result/error/ignored audits, correlation IDs, no payload secrets passed\n";
