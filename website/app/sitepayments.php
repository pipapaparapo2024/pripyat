<?php
require_once __DIR__.'/siteyookassa.php';require_once __DIR__.'/sitesessions.php';
final class SitePayments {
 public function __construct(private PDO $db,private SiteYooKassa $provider,private string $world='site') {
  if(!in_array($world,['site','vk','ok','telegram','telegram_test','telegram_test_live'],true)||($world==='telegram_test'&&!$provider->isTest())||($world==='telegram_test_live'&&$provider->isTest())||($world==='telegram'&&$provider->isTest()))throw new InvalidArgumentException('invalid_payment_world');
 }
 private function q(string $sql,array $args=[]): PDOStatement {$q=$this->db->prepare($sql);$q->execute($args);return $q;}
 public static function product(int $id): array {
  $counts=['stew'=>[4,12,24,80,200,400,2000,4000],'coins'=>[16,36,56,100,600,2000,10000,20000],'cigarettes'=>[1600,3600,6000,8000,11000,22000,125000,300000],'energy'=>[50,110,180,400,850,1300,2000,3500]];
  $path=__DIR__.'/../server/json/site_prices.json';if(!is_file($path))$path=__DIR__.'/../../server/json/site_prices.json';
  $prices=json_decode(file_get_contents($path),true,16,JSON_THROW_ON_ERROR);
  $group=$id>=100&&$id<=107?'energy':(['stew','coins','cigarettes'][intdiv($id,8)]??null);$index=$group==='energy'?$id-100:$id%8;
  if($id<0||!$group||!isset($counts[$group][$index],$prices[$group][$index]))throw new InvalidArgumentException('invalid_product');
  return ['product_id'=>$id,'reward_field'=>$group,'reward_count'=>$counts[$group][$index],'amount_minor'=>$prices[$group][$index]*100];
 }
 public function create(int $uid,int $product,string $intent,int $now): array {
  if(!$this->provider->checkoutReady())throw new RuntimeException('site_payments_disabled');
  if(!preg_match('/^[a-f0-9]{64}$/D',$intent))throw new InvalidArgumentException('invalid_payment_intent');
  $intent=$this->provider->orderId($intent);
  $p=self::product($product);
  $this->q('INSERT IGNORE INTO site_payment_orders(id,player_id,product_id,amount_minor,reward_field,reward_count,created_at) VALUES(?,?,?,?,?,?,?)',[$intent,$uid,$product,$p['amount_minor'],$p['reward_field'],$p['reward_count'],$now]);
  $o=$this->q('SELECT * FROM site_payment_orders WHERE id=?',[$intent])->fetch(PDO::FETCH_ASSOC);
  if(!$o||(int)$o['player_id']!==$uid||(int)$o['product_id']!==$product||$now-(int)$o['created_at']>82800)throw new DomainException('invalid_payment_intent');
  $confirmation=['type'=>'redirect','return_url'=>'https://pripyat-game-site.ru/payment/'];
  if(in_array($this->world,['telegram','telegram_test','telegram_test_live'],true))$confirmation['return_url']='https://pripyat-game-site.ru/telegram-payment-return.html';
  $payment=$o['provider_payment_id']?$this->provider->request('payments/'.$o['provider_payment_id']):$this->provider->request('payments',['amount'=>['value'=>sprintf('%d.00',intdiv((int)$o['amount_minor'],100)),'currency'=>'RUB'],'capture'=>true,'confirmation'=>$confirmation,'description'=>'Припять: '.$p['reward_count'].' '.$p['reward_field'],'metadata'=>['site_order_id'=>$intent,'game_world'=>$this->world]],$intent);
  $id=$payment['id']??'';
  $this->provider->assertEnvironment($payment);
  if(!is_string($id)||!preg_match('/^[a-zA-Z0-9-]{1,64}$/D',$id)||($payment['metadata']['site_order_id']??'')!==$intent||($payment['metadata']['game_world']??'site')!==$this->world||($payment['amount']['currency']??'')!=='RUB'||($payment['amount']['value']??'')!==sprintf('%d.00',intdiv((int)$o['amount_minor'],100)))throw new DomainException('payment_mismatch');
  $this->q("UPDATE site_payment_orders SET provider_payment_id=?,status='pending' WHERE id=? AND credited_at IS NULL",[$id,$intent]);
  $url=$payment['confirmation']['confirmation_url']??null;
  if($url!==null&&(!is_string($url)||parse_url($url,PHP_URL_SCHEME)!=='https'||!in_array(parse_url($url,PHP_URL_HOST),['yoomoney.ru','yookassa.ru','checkout.yookassa.ru'],true)))throw new DomainException('invalid_confirmation_url');
  return ['order_id'=>$intent,'confirmation_url'=>$url,'status'=>$payment['status']??'pending'];
 }
 /** Notification payload is not proof: always query the authenticated provider API. */
 public function settle(string $paymentId,int $now): string {
  if(!preg_match('/^[a-zA-Z0-9-]{1,64}$/D',$paymentId))throw new InvalidArgumentException('invalid_payment');
  $p=$this->provider->request('payments/'.$paymentId);
  if(($p['metadata']['game_world']??'site')!==$this->world)throw new DomainException('payment_world_mismatch');
  $o=$this->q('SELECT * FROM site_payment_orders WHERE provider_payment_id=?',[$paymentId])->fetch(PDO::FETCH_ASSOC);if(!$o)throw new DomainException('unknown_payment');
  SiteYooKassa::validateOrder($p,$o,$this->provider->shopId(),$this->provider->isTest());
  if(($p['status']??'')==='canceled'){$this->q("UPDATE site_payment_orders SET status='canceled' WHERE id=? AND credited_at IS NULL",[$o['id']]);return 'canceled';}
  if(($p['status']??'')!=='succeeded')return 'pending';
  SiteYooKassa::validatePaid($p,$o,$this->provider->shopId(),$this->provider->isTest());$uid=(int)$o['player_id'];
  $lock=match($this->world){
   'site'=>'pripyat.site.test.player.',
   'telegram'=>'pripyat.telegram.prod.player.',
   'telegram_test'=>'pripyat.telegram.test.player.',
    'telegram_test_live'=>'pripyat.telegram.test.player.',
   'vk'=>'pripyat.native.prod.stalker.player.',
   'ok'=>'pripyat.native.prod.stalker_ok.player.',
  }.$uid;
  if((int)$this->q('SELECT GET_LOCK(?,10)',[$lock])->fetchColumn()!==1)throw new RuntimeException('player_busy');
  try{
   $this->db->beginTransaction();$o=$this->q('SELECT * FROM site_payment_orders WHERE id=? FOR UPDATE',[$o['id']])->fetch(PDO::FETCH_ASSOC);
   if($o['credited_at']!==null){$this->db->commit();return 'already_credited';}
   $field=$o['reward_field'];if(!in_array($field,['stew','coins','cigarettes','energy'],true))throw new DomainException('invalid_reward');
   $user=$this->q('SELECT energy,energy_time,max_energy FROM users WHERE id=? FOR UPDATE',[$uid])->fetch(PDO::FETCH_ASSOC);if(!$user)throw new DomainException('player_missing');
   $count=(int)$o['reward_count'];
   if($field==='energy'){
    $anchor=(int)$user['energy_time']?:$now;$max=(int)$user['max_energy']?:50;$elapsed=max(0,$now-$anchor);$energy=max((int)$user['energy'],min($max,(int)$user['energy']+intdiv($elapsed,300)));$anchor=$energy>=$max?$now:$now-$elapsed%300;
    $this->q('UPDATE users SET energy=?,energy_time=? WHERE id=?',[$energy+$count,$anchor,$uid]);
   }else $this->q('UPDATE users SET `'.$field.'`=CAST(`'.$field.'` AS DECIMAL(65,0))+? WHERE id=?',[$count,$uid]);
   $this->q('INSERT INTO site_payment_receipts(provider_payment_id,order_id,amount_minor,credited_at) VALUES(?,?,?,?)',[$paymentId,$o['id'],$o['amount_minor'],$now]);
   $this->q("UPDATE site_payment_orders SET status='succeeded',credited_at=? WHERE id=?",[$now,$o['id']]);$this->db->commit();return 'credited';
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}finally{$this->q('SELECT RELEASE_LOCK(?)',[$lock]);}
 }
}
