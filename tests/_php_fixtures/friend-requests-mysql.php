<?php
// Manual VPS fixture: all writes go to connection-local temporary tables.
require '/var/www/stalker-tg-test/public/server/core/models/gamefriendrequests.php';
function mustFriend($v){if(!$v)throw new RuntimeException('Friend request contract failed');}
foreach([false,true] as $telegram){
$db=new PDO('mysql:unix_socket=/var/run/mysqld/mysqld.sock;dbname=stalker_site_test','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec("CREATE TEMPORARY TABLE users(id INT PRIMARY KEY,nick VARCHAR(50),friends TEXT,friends_since TEXT)");$db->exec("INSERT INTO users VALUES(1,'One','1','{}'),(2,'Two','2','{}'),(3,'Three','3','{}')");
$db->exec("CREATE TEMPORARY TABLE game_friend_requests(sender_id INT,recipient_id INT,status VARCHAR(20),created_at BIGINT,updated_at BIGINT,PRIMARY KEY(sender_id,recipient_id))");
$db->exec('CREATE TEMPORARY TABLE telegram_friendships(player_low INT,player_high INT,friends_since_ms BIGINT,PRIMARY KEY(player_low,player_high))');
$f=new GameFriendRequests($db,$telegram);$f->act(1,2,'send');$f->act(1,2,'send');mustFriend(count($f->incoming(2)['requests'])===1);mustFriend($db->query('SELECT friends FROM users WHERE id=2')->fetchColumn()==='2');
try{$f->act(1,2,'accept');throw new LogicException('Sender accepted own request');}catch(DomainException $e){}
$f->act(2,1,'accept');mustFriend($db->query('SELECT friends FROM users WHERE id=1')->fetchColumn()==='1,2');mustFriend($db->query('SELECT friends FROM users WHERE id=2')->fetchColumn()==='1,2');mustFriend(count($f->incoming(2)['requests'])===0);
if($telegram)mustFriend((int)$db->query('SELECT COUNT(*) FROM telegram_friendships')->fetchColumn()===1);
$f->act(1,3,'send');$f->act(3,1,'decline');mustFriend($db->query('SELECT friends FROM users WHERE id=3')->fetchColumn()==='3');
foreach([[1,1,'send'],[1,99,'send'],[2,1,'accept']] as $args){try{$f->act(...$args);throw new LogicException('Invalid action accepted');}catch(DomainException $e){}}
}
echo "Site/TG: pending not friendship, duplicate send, recipient-only acceptance, mutual projection, canonical TG, decline, self/missing/replay rejected; temporary tables only\n";
