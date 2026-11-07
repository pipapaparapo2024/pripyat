<?php
// VPS integration test: connection-local TEMPORARY tables shadow both real tables.
require '/var/www/pripyat-site/app/socialsessions.php';
foreach(['vk','ok'] as $world){
 $db=new PDO('mysql:unix_socket=/var/run/mysqld/mysqld.sock;dbname='.NativeProdBoundary::WORLDS[$world],'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $db->exec('CREATE TEMPORARY TABLE users(id INT PRIMARY KEY,coins INT)');
 $db->exec('CREATE TEMPORARY TABLE secure(id INT PRIMARY KEY,vk_params TEXT,token VARCHAR(64),req_key VARCHAR(64),time BIGINT,lifetime INT)');
 $config=['enabled'=>true,'environment'=>'prod','public_access'=>true,'api_secret'=>'fixture-only','app_ids'=>['vk'=>54574178,'ok'=>512005669202]];
 $launch=['vk_app_id'=>(string)$config['app_ids'][$world],'vk_user_id'=>'123','vk_ts'=>(string)time()];if($world==='ok'){$launch['vk_client']='ok';$launch['vk_ok_user_id']='987654321012';}
 ksort($launch);$launch['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($launch),$config['api_secret'],true)),'+/','-_'),'=');
 $q=$db->prepare('INSERT INTO secure VALUES(?,?,NULL,NULL,0,0)');$q->execute([123,json_encode($launch)]);
 $access=['enabled'=>true,$world=>['mode'=>'open']];$s=new SocialSessions($db,$world,$config,$access);$external=$world==='ok'?'987654321012':'123';
 try{$s->issue(123,$external,time());throw new LogicException('Created website character');}catch(DomainException $e){if($e->getMessage()!=='native_character_missing')throw $e;}
 if((int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn()!==0)throw new RuntimeException('Created duplicate');
 $db->exec('INSERT INTO users VALUES(123,777)');$one=$s->issue(123,$external,time());$two=$s->issue(123,$external,time());
 if((int)$db->query('SELECT coins FROM users WHERE id=123')->fetchColumn()!==777)throw new RuntimeException('Changed progress');
 try{$s->authenticate(123,$external,$one['token'],$one['req_key'],time());throw new LogicException('Old session survived');}catch(DomainException $e){}
 $a=$s->authenticate(123,$external,$two['token'],$two['req_key'],time());NativePlayerSessionLock::release($db,$a['lock']);
 try{$s->issue(123,'999',time());throw new LogicException('Wrong native identity');}catch(DomainException $e){}
 if((int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn()!==1)throw new RuntimeException('Duplicate character');
}
echo "VK/OK real MySQL TEMP tables: no website creation, same character and balance, old session revoked, mismatched identity denied\n";
