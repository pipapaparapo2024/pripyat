"""Transactional Telegram-only schema checks. All fixture rows roll back."""
from pathlib import Path
import importlib.util,json
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'tools/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
php=r'''<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$c=require '/etc/pripyat/telegram-test.php';
if($c['enabled']!==false || $c['database']!=='stalker_telegram_test')throw new RuntimeException('config');
$db=new mysqli('127.0.0.1',$c['db_user'],$c['db_password'],$c['database'],3306);
$db->set_charset('utf8mb4');
function ok($v){if(!$v)throw new RuntimeException('verification_failed');}
function denied($db,$sql,$expected){
    try{$db->query($sql);}catch(mysqli_sql_exception $e){ok(in_array($e->getCode(),$expected,true));return;}
    throw new RuntimeException('expected_rejection');
}
$tables=['users','telegram_identities','telegram_sessions','telegram_roles','telegram_friendships','telegram_friend_invites'];
foreach($tables as $t)ok((int)$db->query("SELECT COUNT(*) n FROM `$t`")->fetch_assoc()['n']===0);
foreach(['stalker','stalker_test','stalker_ok'] as $other)denied($db,"SELECT id FROM `$other`.`users` WHERE 1=0",[1142,1044]);
$db->begin_transaction();
try{
    $db->query('INSERT INTO telegram_identities (telegram_id,created_at) VALUES (4503599627370494,UNIX_TIMESTAMP())');$a=$db->insert_id;
    $db->query('INSERT INTO telegram_identities (telegram_id,created_at) VALUES (4503599627370493,UNIX_TIMESTAMP())');$b=$db->insert_id;
    ok($a>0 && $b>$a && $b<2147483647);
    $db->query("INSERT INTO users (id,exp,coins,cigarettes,create_time,visit,shmot) VALUES ($a,0,10,1000,UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),'[]')");
    $user=$db->query("SELECT level,coins,cigarettes,energy,max_energy FROM users WHERE id=$a")->fetch_assoc();
    ok((int)$user['level']===1 && (int)$user['coins']===10 && (int)$user['cigarettes']===1000 && (int)$user['energy']===50 && (int)$user['max_energy']===50);
    denied($db,'INSERT INTO telegram_identities (telegram_id,created_at) VALUES (4503599627370494,0)',[1062]);
    $hash=hash('sha256',random_bytes(32));
    $db->query("INSERT INTO telegram_sessions (token_hash,player_id,expires_at) VALUES ('$hash',$a,UNIX_TIMESTAMP()+3600)");
    $db->query("INSERT INTO telegram_roles (player_id,role,created_at) VALUES ($a,'developer',UNIX_TIMESTAMP())");
    $db->query("INSERT INTO telegram_friendships (player_low,player_high,friends_since_ms) VALUES ($a,$b,1793530000000)");
    denied($db,"INSERT INTO telegram_friendships (player_low,player_high,friends_since_ms) VALUES ($a,$b,1)",[1062]);
    denied($db,"INSERT INTO telegram_friendships (player_low,player_high,friends_since_ms) VALUES ($a,$a,1)",[3819]);
    denied($db,"INSERT INTO telegram_friendships (player_low,player_high,friends_since_ms) VALUES ($b,$a,1)",[3819]);
    denied($db,"INSERT INTO telegram_roles (player_id,role,created_at) VALUES (2147483647,'developer',0)",[1452]);
    $db->query("INSERT INTO telegram_friend_invites (code,owner_player_id,created_at) VALUES ('fixture_only',$a,UNIX_TIMESTAMP())");
}finally{$db->rollback();}
foreach($tables as $t)ok((int)$db->query("SELECT COUNT(*) n FROM `$t`")->fetch_assoc()['n']===0);
ok((int)$db->query('SELECT COUNT(*) n FROM roulette_state WHERE id=1')->fetch_assoc()['n']===1);
ok((int)$db->query('SELECT COUNT(*) n FROM zone_respect_leader')->fetch_assoc()['n']===5);
echo json_encode(['connection'=>'dedicated_test_user','cross_database_access'=>'denied','unique_keys'=>'verified','foreign_keys'=>'verified','friend_pair_check'=>'verified','initial_player_defaults'=>'verified','fixture_rows'=>'rolled_back','login_enabled'=>false]);
'''
code='''import subprocess,json
p=subprocess.run(['php'],input=PHP,capture_output=True,text=True)
if p.returncode:raise RuntimeError('Telegram DB verification failed; private diagnostics suppressed')
print(p.stdout)
'''.replace('PHP',repr(php))
client=release.connect()
try:print(release.run_remote_python(client,code))
finally:client.close()
