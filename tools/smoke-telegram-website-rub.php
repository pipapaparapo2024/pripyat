<?php
// Execute over SSH with PHP stdin as root. All game SQL writes use temporary tables.
require '/var/www/pripyat-site/app/telegramwebsitepayments.php';
$config=json_decode(file_get_contents('/etc/pripyat/website-auth-test.json'),true)['telegram']['website_rub_payments'];
$db=new PDO('mysql:unix_socket=/run/mysqld/mysqld.sock;dbname=stalker_telegram_test;charset=utf8mb4','root','',[
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false,
]);
foreach(['site_payment_orders','site_payment_receipts'] as $table){
    $definition=$db->query('SHOW CREATE TABLE '.$table)->fetch(PDO::FETCH_NUM)[1];
    $definition=preg_replace('/^CREATE TABLE /','CREATE TEMPORARY TABLE ',$definition);
    $definition=preg_replace('/,\n  CONSTRAINT [^\n]+/','',$definition);
    $db->exec($definition);
}
$db->exec('CREATE TEMPORARY TABLE users (id INT PRIMARY KEY, stew BIGINT NOT NULL DEFAULT 0,
    coins BIGINT NOT NULL DEFAULT 0,cigarettes BIGINT NOT NULL DEFAULT 0,energy INT NOT NULL DEFAULT 50,
    energy_time BIGINT NOT NULL DEFAULT 0,max_energy INT NOT NULL DEFAULT 50)');
$db->exec('INSERT INTO users(id) VALUES(999999123)');
$provider=new SiteYooKassa($config);
$service=new TelegramWebsitePayments($db,$config);
if(!$service->enabled())throw new Exception('checkout_not_ready');
$intent=bin2hex(random_bytes(32));
$order=$service->create(999999123,0,$intent,time());
if(parse_url($order['confirmation_url'],PHP_URL_SCHEME)!=='https')throw new Exception('checkout_missing');
$id=$db->query('SELECT provider_payment_id FROM site_payment_orders')->fetchColumn();
$payment=$provider->request('payments/'.$id);
if($payment['test']!==true||$payment['metadata']['game_world']!=='telegram_test')throw new Exception('wrong_mode');
if($service->status(999999123,$intent,time())!=='pending')throw new Exception('unexpected_status');
try{
    $service->status(999999124,$intent,time());
    throw new LogicException('foreign_order_allowed');
}catch(DomainException $error){}
$payment['status']='succeeded';
$payment['paid']=true;
$mock=new SiteYooKassa($config,static fn($path,$body,$key)=>$payment);
$payments=new SitePayments($db,$mock,'telegram_test');
if($payments->settle($id,time())!=='credited')throw new Exception('credit_failed');
if($payments->settle($id,time())!=='already_credited')throw new Exception('repeat_credit');
if((string)$db->query('SELECT stew FROM users')->fetchColumn()!=='4')throw new Exception('wrong_balance');
if((int)$db->query('SELECT COUNT(*) FROM site_payment_receipts')->fetchColumn()!==1)throw new Exception('duplicate_receipt');
echo json_encode(['test_provider_checkout'=>'created','checkout_host'=>parse_url($order['confirmation_url'],PHP_URL_HOST),
    'pending_status'=>'verified','foreign_owner'=>'denied','simulated_paid_credit'=>'4 stew once',
    'real_player_writes'=>false,'tables'=>'TEMPORARY']).PHP_EOL;
