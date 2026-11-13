<?php
require __DIR__.'/../../website/app/sitepayments.php';
[$script,$mode,$socket,$world,$test,$barrier,$worker]=$argv;
if(!str_starts_with($socket,'/var/tmp/pripyat-concurrency-')||!str_ends_with($socket,'/mysql.sock'))exit(2);
$db=new PDO('mysql:unix_socket='.$socket.';dbname=fixture','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
if($mode==='setup'){
 $db->exec('CREATE TABLE users (id INT PRIMARY KEY,stew BIGINT,coins BIGINT,cigarettes BIGINT,energy INT,energy_time BIGINT,max_energy INT) ENGINE=InnoDB');
 $db->exec('CREATE TABLE site_payment_orders (id CHAR(64) PRIMARY KEY,player_id INT,product_id INT,amount_minor INT,reward_field VARCHAR(20),reward_count INT,provider_payment_id VARCHAR(64),status VARCHAR(20),created_at BIGINT,credited_at BIGINT NULL) ENGINE=InnoDB');
 $db->exec('CREATE TABLE site_payment_receipts (provider_payment_id VARCHAR(64) PRIMARY KEY,order_id CHAR(64) UNIQUE,amount_minor INT,credited_at BIGINT) ENGINE=InnoDB');exit;
}
if($mode==='reset'){
 $db->exec('DELETE FROM site_payment_receipts');$db->exec('DELETE FROM site_payment_orders');$db->exec('DELETE FROM users');$db->exec('INSERT INTO users VALUES(2000000001,100,0,0,50,0,50)');
 foreach(['a','b'] as $id){$q=$db->prepare("INSERT INTO site_payment_orders VALUES(?,2000000001,0,700,'stew',4,?,'pending',1,NULL)");$q->execute([str_repeat($id,64),'payment-'.$id]);}exit;
}
if($mode==='check'){
 $expected=(int)$worker;
 if((int)$db->query('SELECT stew FROM users')->fetchColumn()!==100+4*$expected||(int)$db->query('SELECT COUNT(*) FROM site_payment_receipts')->fetchColumn()!==$expected||(int)$db->query('SELECT COUNT(*) FROM site_payment_orders WHERE credited_at IS NOT NULL')->fetchColumn()!==$expected)throw new RuntimeException('Concurrent credit invariant failed');echo 'invariants OK';exit;
}
$id=$mode==='different'&&$worker==='2'?'b':'a';$isTest=$test==='1';
$provider=new SiteYooKassa(['enabled'=>true,'require_test_payment'=>$isTest,'shop_id'=>'123','secret_key'=>$isTest?'test_fixture':'live_fixture'],function()use($id,$world,$isTest,$barrier,$worker){
 file_put_contents($barrier.'/ready-'.$worker,'ready');$deadline=microtime(true)+15;
 while(!is_file($barrier.'/release')){if(microtime(true)>$deadline)throw new RuntimeException('barrier timeout');usleep(10000);}
 return ['id'=>'payment-'.$id,'status'=>'succeeded','paid'=>true,'test'=>$isTest,'amount'=>['value'=>'7.00','currency'=>'RUB'],'recipient'=>['account_id'=>'123'],'metadata'=>['site_order_id'=>str_repeat($id,64),'game_world'=>$world]];
});
echo (new SitePayments($db,$provider,$world))->settle('payment-'.$id,200);
