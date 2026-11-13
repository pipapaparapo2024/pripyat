<?php
final class PaymentWebhook {
 public static function record(string $directory, array $row): void {
  $path=$directory.'/deliveries.jsonl';
  $file=fopen($path,'ab');if(!$file)throw new RuntimeException('webhook_audit_unavailable');
  try {
   if(!chmod($path,0640))throw new RuntimeException('webhook_audit_permissions');
   if(!flock($file,LOCK_EX))throw new RuntimeException('webhook_audit_lock');
   $line=json_encode($row,JSON_THROW_ON_ERROR)."\n";
   if(fwrite($file,$line)!==strlen($line)||!fflush($file))throw new RuntimeException('webhook_audit_write');
  } finally {fclose($file);}
 }
 public static function handle(array $payload, callable $lookup, callable $settle, callable $report): void {
  $attempt=bin2hex(random_bytes(16));$id=$payload['object']['id']??null;
  if(!is_string($id)||!preg_match('/\A[a-zA-Z0-9-]{1,64}\z/',$id))$id=null;
  $world=null;
  $emit=static function(string $outcome,int $status)use(&$world,$id,$attempt,$report):void{
   $report(['time'=>time(),'source'=>'webhook','attempt_id'=>$attempt,'payment_id'=>$id,'world'=>$world,'outcome'=>$outcome,'http_status'=>$status]);
  };
  $emit('received',0);
  try {
   if(($payload['type']??'')!=='notification'||!in_array($payload['event']??'',['payment.succeeded','payment.canceled'],true)){$emit('ignored',200);return;}
   if($id===null)throw new InvalidArgumentException('invalid_payment');
   [$provider,$verified]=$lookup($id);
   $world=$verified['metadata']['game_world']??'site';
   if(!in_array($world,['site','vk','ok','telegram'],true)){$world=null;throw new DomainException('invalid_world');}
   $emit('verified',0);
   $result=$settle($id,$provider,$verified,$world);
   $emit($result,200);
  } catch(Throwable $error){$emit('error:'.get_class($error),503);throw $error;}
 }
}
