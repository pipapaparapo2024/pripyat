<?php
// Explicit manual fixture: connection-local temporary tables only; no provider requests.
require ($argv[1]??'/var/www/pripyat-site/app/sitepayments.php');
$db=new PDO('mysql:unix_socket=/var/run/mysqld/mysqld.sock;dbname=stalker_site_test','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TEMPORARY TABLE users (id INT PRIMARY KEY,stew BIGINT,coins BIGINT,cigarettes BIGINT,energy INT,energy_time BIGINT,max_energy INT) ENGINE=InnoDB');
$db->exec('CREATE TEMPORARY TABLE site_payment_orders (id CHAR(64) PRIMARY KEY,player_id INT,product_id INT,amount_minor INT,reward_field VARCHAR(20),reward_count INT,provider_payment_id VARCHAR(64),status VARCHAR(20),created_at BIGINT,credited_at BIGINT NULL) ENGINE=InnoDB');
$db->exec('CREATE TEMPORARY TABLE site_payment_receipts (provider_payment_id VARCHAR(64) PRIMARY KEY,order_id CHAR(64) UNIQUE,amount_minor INT,credited_at BIGINT) ENGINE=InnoDB');
$db->exec('INSERT INTO users VALUES(2000000001,100,0,0,50,0,50)');
foreach(['site','vk','ok'] as $world)foreach([true,false] as $test){
$db->exec('DELETE FROM site_payment_receipts');$db->exec('DELETE FROM site_payment_orders');$db->exec('UPDATE users SET stew=100');
$id=str_repeat('b',64);$q=$db->prepare("INSERT INTO site_payment_orders VALUES(?,2000000001,0,700,'stew',4,'fixture-payment','pending',1,NULL)");$q->execute([$id]);
$response=['id'=>'fixture-payment','status'=>'succeeded','paid'=>true,'test'=>$test,'amount'=>['value'=>'7.00','currency'=>'RUB'],'recipient'=>['account_id'=>'123'],'metadata'=>['site_order_id'=>$id,'game_world'=>$world]];
$provider=new SiteYooKassa(['enabled'=>true,'require_test_payment'=>$test,'shop_id'=>'123','secret_key'=>$test?'test_fixture':'live_fixture'],function()use(&$response){return $response;});$service=new SitePayments($db,$provider,$world);
if($service->settle('fixture-payment',100)!=='credited')throw new RuntimeException('First credit failed');
if($service->settle('fixture-payment',101)!=='already_credited')throw new RuntimeException('Duplicate not rejected');
if((int)$db->query('SELECT stew FROM users')->fetchColumn()!==104||(int)$db->query('SELECT COUNT(*) FROM site_payment_receipts')->fetchColumn()!==1)throw new RuntimeException('Wrong balance or receipt count');
$response['amount']['value']='7.01';try{$service->settle('fixture-payment',102);throw new LogicException('Wrong amount accepted');}catch(DomainException $e){}
}
echo "Three worlds in both test/live modes, isolated payment MySQL: one credit, duplicate protection, exact amount, transaction ledger passed; no network calls\n";

$checked=0;
foreach(['site','vk','ok'] as $world)foreach([true,false] as $test){
 $db->exec('DELETE FROM site_payment_receipts');$db->exec('DELETE FROM site_payment_orders');$responses=[];$created=0;
 $provider=new SiteYooKassa(['enabled'=>true,'require_test_payment'=>$test,'shop_id'=>'123','secret_key'=>$test?'test_fixture':'live_fixture','live_checkout_enabled'=>true,'receipt_automation_ready'=>true],function($path,$body,$key)use(&$responses,&$created,$test){
  if($body===null)return $responses[substr($path,9)];
  $id='new-fixture-'.(++$created);
  return $responses[$id]=['id'=>$id,'status'=>'pending','paid'=>false,'test'=>$test,'amount'=>$body['amount'],'recipient'=>['account_id'=>'123'],'metadata'=>$body['metadata'],'confirmation'=>['confirmation_url'=>'https://yoomoney.ru/checkout/fixture']];
 });
 $service=new SitePayments($db,$provider,$world);
 foreach(array_merge(range(0,23),range(100,107)) as $product){
  $db->exec('UPDATE users SET stew=100,coins=0,cigarettes=0,energy=50,energy_time=100');
  $intent=hash('sha256',(string)$product);$before=$created;
  $order=$service->create(2000000001,$product,$intent,100);
  $again=$service->create(2000000001,$product,$intent,101);
  if($created!==$before+1||$order['order_id']!==$again['order_id'])throw new RuntimeException('Duplicate create');
  $q=$db->prepare('SELECT * FROM site_payment_orders WHERE id=?');$q->execute([$order['order_id']]);$row=$q->fetch(PDO::FETCH_ASSOC);$id=$row['provider_payment_id'];
  $catalog=SitePayments::product($product);
  if($responses[$id]['amount']['value']!==sprintf('%d.00',intdiv($catalog['amount_minor'],100)))throw new RuntimeException('Wrong selected product amount');
  $responses[$id]['status']='succeeded';$responses[$id]['paid']=true;
  $responses[$id]['test']=!$test;
  try{$service->settle($id,102);throw new LogicException('Cross-environment credit');}catch(DomainException $e){}
  $responses[$id]['test']=$test;
  if($service->settle($id,102)!=='credited'||$service->settle($id,103)!=='already_credited')throw new RuntimeException('Credit/idempotence failed');
  $field=$catalog['reward_field'];$base=match($field){'stew'=>100,'energy'=>50,default=>0};
  if((int)$db->query('SELECT `'.$field.'` FROM users')->fetchColumn()!==$base+$catalog['reward_count'])throw new RuntimeException('Wrong reward');
  $checked++;
 }
}
echo "MySQL TEMP: $checked selected-product creates and settlements across both modes and all worlds; duplicate creates/credits rejected; no real data or API calls\n";
