<?php
/** Server-only REST v3 adapter. Credentials and full provider payloads never logged. */
final class SiteYooKassa {
 public function __construct(private array $config,private ?Closure $transport=null) {}
 public function ready(): bool {
  $test=$this->config['require_test_payment']??null;
  return ($this->config['enabled']??false)===true&&is_bool($test)&&preg_match('/^[1-9][0-9]+$/D',(string)($this->config['shop_id']??''))&&str_starts_with($this->config['secret_key']??'',$test?'test_':'live_');
 }
 public function isTest(): bool {return ($this->config['require_test_payment']??null)===true;}
 /** Reading existing payments remains possible while new live checkouts are closed. */
 public function checkoutReady(): bool {
  $receipts=($this->config['receipt_automation_ready']??false)===true||(($this->config['receipt_mode']??'')==='manual'&&($this->config['manual_receipts_acknowledged']??false)===true);
  return $this->ready()&&($this->isTest()||(($this->config['live_checkout_enabled']??false)===true&&$receipts));
 }
 public function assertEnvironment(array $payment): void {
  if(!is_bool($payment['test']??null)||$payment['test']!==$this->isTest()||(string)($payment['recipient']['account_id']??'')!==$this->shopId())throw new DomainException('payment_mismatch');
 }
 /** Prefix only new live intents; old test order IDs and their status URLs remain valid. */
 public function orderId(string $intent): string {return $this->isTest()?$intent:hash('sha256','pripyat.yookassa.live.'.$this->shopId().':'.$intent);}
 /** Only server-configured shops; the webhook's test/recipient fields never select credentials. */
 public static function lookup(array $runtime,string $id,?Closure $factory=null): array {
  foreach(array_merge([$runtime['payments']??[]],$runtime['payments_previous']??[]) as $config){
   $provider=$factory!==null?$factory($config):new self($config);if(!$provider->ready())continue;
   try{$payment=$provider->request('payments/'.$id);$provider->assertEnvironment($payment);return [$provider,$payment];}
   catch(DomainException $e){if($e->getMessage()!=='payment_not_found')throw $e;}
  }
  throw new DomainException('payment_not_found');
 }
 public function shopId(): string {return (string)$this->config['shop_id'];}
 public function request(string $path,?array $body=null,?string $key=null): array {
  if(!$this->ready())throw new RuntimeException('site_payments_disabled');
  if(!preg_match('~^payments(?:/[a-zA-Z0-9-]{1,64})?$~D',$path))throw new InvalidArgumentException('invalid_payment_path');
  if($this->transport!==null)return ($this->transport)($path,$body,$key);
  $ch=curl_init('https://api.yookassa.ru/v3/'.$path);$bytes='';$headers=['Content-Type: application/json'];
  if($body!==null){if(!is_string($key)||!preg_match('/^[a-f0-9]{64}$/D',$key))throw new InvalidArgumentException('invalid_idempotence');$headers[]='Idempotence-Key: '.$key;curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body,JSON_THROW_ON_ERROR)]);}
  curl_setopt_array($ch,[CURLOPT_USERPWD=>$this->config['shop_id'].':'.$this->config['secret_key'],CURLOPT_HTTPAUTH=>CURLAUTH_BASIC,CURLOPT_HTTPHEADER=>$headers,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,CURLOPT_WRITEFUNCTION=>function($ch,$chunk)use(&$bytes){if(strlen($bytes)+strlen($chunk)>262144)return 0;$bytes.=$chunk;return strlen($chunk);}]);
  try{$ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);}finally{curl_close($ch);}
  if($ok!==false&&$status===404)throw new DomainException('payment_not_found');
  if($ok===false||$status<200||$status>=300)throw new RuntimeException('payment_provider_unavailable');
  $result=json_decode($bytes,true,32,JSON_THROW_ON_ERROR);if(!is_array($result))throw new RuntimeException('invalid_payment_response');return $result;
 }
 public static function validatePaid(array $payment,array $order,string $shopId,bool $test=true): void {
  if(($payment['status']??'')!=='succeeded'||($payment['paid']??false)!==true)throw new DomainException('payment_mismatch');
  self::validateOrder($payment,$order,$shopId,$test);
 }
 public static function validateOrder(array $payment,array $order,string $shopId,bool $test): void {
  if(($payment['test']??null)!==$test||($payment['amount']['currency']??'')!=='RUB'||($payment['amount']['value']??'')!==sprintf('%d.%02d',intdiv((int)$order['amount_minor'],100),(int)$order['amount_minor']%100)||(string)($payment['recipient']['account_id']??'')!==$shopId||($payment['metadata']['site_order_id']??'')!==$order['id']||(string)($payment['id']??'')!==(string)$order['provider_payment_id'])throw new DomainException('payment_mismatch');
 }
}
