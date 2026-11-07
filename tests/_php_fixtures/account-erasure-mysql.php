<?php
// Only TEMPORARY tables on the current connection. No production rows are touched.
require getenv('PRIPYAT_ERASURE_MODEL')?:'/var/www/pripyat-site/server/core/models/accounterasure.php';
function mustErase(bool $value):void{if(!$value)throw new RuntimeException('Erasure contract failed');}
$schema=[
 'users'=>'id INT PRIMARY KEY,coins INT,friends TEXT,friends_since TEXT,roulette_winner TEXT',
 'secure'=>'id INT PRIMARY KEY',
 'site_payment_orders'=>'id INT PRIMARY KEY,player_id INT,status VARCHAR(20)',
 'site_sessions'=>'player_id INT','site_email_tokens'=>'player_id INT',
 'site_phone_identities'=>'player_id INT','site_phone_checks'=>'player_id INT,email VARCHAR(254)',
 'site_accounts'=>'player_id INT PRIMARY KEY,email VARCHAR(254),password_hash VARCHAR(255),email_verified_at BIGINT,disabled_at BIGINT,auth_version INT',
 'site_test_invitations'=>'consumed_by INT,email VARCHAR(254)',
 'boss_damage_log'=>'uid INT','boss_instance_claims'=>'uid INT','boss_last_kill'=>'user_id INT','zone_respect_leader'=>'user_id INT','reward_link_claims'=>'user_id INT',
 'boss_instances'=>'id INT,owner_uid INT','roulette_state'=>'keyring_owner_id INT',
 'game_friend_requests'=>'sender_id INT,recipient_id INT','trans'=>'uid INT','ok_payment_transactions'=>'game_uid INT'
];
foreach(AccountErasure::WORLDS as $world=>$database){
 $db=new PDO('mysql:unix_socket=/var/run/mysqld/mysqld.sock;dbname='.$database,'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
 foreach($schema as $table=>$columns)$db->exec("CREATE TEMPORARY TABLE `$table`($columns)");
 $db->exec("INSERT INTO users VALUES(900001,777,'900001,900002','{}',''),(900002,888,'900001,900002','{\"900001\":123}','{\"id\":900001,\"name\":\"erase\"}')");
 $db->exec("INSERT INTO site_payment_orders VALUES(1,900001,'pending')");
 $eraser=new AccountErasure($db,$world);
 try{$eraser->erase(900001);throw new LogicException('Unsettled payment ignored');}catch(DomainException $e){mustErase($e->getMessage()==='unsettled_payments');}
 mustErase((int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn()===2);
 $db->exec('DELETE FROM site_payment_orders');
 if($world==='site'){
  $db->exec("INSERT INTO site_accounts VALUES(900001,'erase@example.com','hash',123,NULL,1),(900002,'keep@example.com','keep',123,NULL,1)");
  foreach(['site_sessions','site_email_tokens','site_phone_identities'] as $t)$db->exec("INSERT INTO `$t` VALUES(900001),(900002)");
  $db->exec("INSERT INTO site_phone_checks VALUES(900001,'erase@example.com'),(NULL,'erase@example.com'),(900002,'keep@example.com')");
  $db->exec("INSERT INTO site_test_invitations VALUES(900001,'erase@example.com'),(900002,'keep@example.com')");
 }
 foreach(['boss_damage_log','boss_instance_claims','boss_last_kill','zone_respect_leader','reward_link_claims'] as $t)$db->exec("INSERT INTO `$t` VALUES(900001),(900002)");
 $db->exec('INSERT INTO boss_instances VALUES(1,900001),(2,900002)');
 $db->exec('INSERT INTO roulette_state VALUES(900001)');
 $db->exec('INSERT INTO game_friend_requests VALUES(900001,900002)');
 $result=$eraser->erase(900001);mustErase($result['erased']);
 mustErase((int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn()===1);
 $row=$db->query('SELECT * FROM users WHERE id=900002')->fetch(PDO::FETCH_ASSOC);mustErase((int)$row['coins']===888&&$row['friends']==='900002'&&$row['roulette_winner']==='');
 mustErase((int)$db->query('SELECT COUNT(*) FROM boss_instances')->fetchColumn()===2);
 mustErase((int)$db->query('SELECT owner_uid FROM boss_instances WHERE id=1')->fetchColumn()===0);
 if($world==='site'){
  mustErase((int)$db->query('SELECT COUNT(*) FROM site_accounts')->fetchColumn()===1);
  mustErase((int)$db->query('SELECT COUNT(*) FROM site_phone_checks')->fetchColumn()===1);
  // Repeat after a simulated restore with a financial reference.
  $db->exec("INSERT INTO users VALUES(900001,123,'','{}','')");
  $db->exec("INSERT INTO site_accounts VALUES(900001,'erase@example.com','hash',123,NULL,1)");
  $db->exec("INSERT INTO site_payment_orders VALUES(2,900001,'succeeded')");
  $eraser->erase(900001);$row=$db->query('SELECT * FROM site_accounts WHERE player_id=900001')->fetch(PDO::FETCH_ASSOC);
  mustErase($row['email']==='erased-900001@deleted.invalid'&&$row['password_hash']==='!erased!'&&$row['disabled_at']!==null);
  mustErase((int)$db->query('SELECT COUNT(*) FROM site_payment_orders')->fetchColumn()===1);
 }
}
echo "Erasure MySQL TEMP fixtures: three worlds, transaction rollback, ownership isolation, friends/ratings/phone cleanup, financial exception and reapply passed\n";
