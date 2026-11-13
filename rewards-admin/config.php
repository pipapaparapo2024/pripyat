<?php
ini_set('display_errors','0');
header('Cache-Control: no-store, private');
$private=getenv('PRIPYAT_REWARDS_CONFIG');
if(!$private||!is_file($private)){http_response_code(503);exit('Генератор ещё не настроен.');}
$rewardConfig=json_decode(file_get_contents($private),true,32,JSON_THROW_ON_ERROR);
if(($rewardConfig['enabled']??false)!==true||($rewardConfig['environment']??'')!=='test'
    ||!is_string($rewardConfig['admin_user']??null)||($_SERVER['REMOTE_USER']??'')!==$rewardConfig['admin_user']){http_response_code(403);exit('Нет доступа.');}
require dirname(__DIR__).'/app/rewardlinkpublisher.php';
require __DIR__.'/catalog.php';
session_name('pripyat_rewards_test');
session_start(['cookie_httponly'=>true,'cookie_secure'=>true,'cookie_samesite'=>'Strict','cookie_path'=>'/rewards-admin/','use_strict_mode'=>true]);
require_once dirname(__DIR__).'/app/rewardstotp-gate.php';
requireRewardsTotp();
if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
if(empty($_SESSION['create_nonce']))$_SESSION['create_nonce']=bin2hex(random_bytes(32));
if(($_SERVER['REQUEST_METHOD']??'')==='POST'&&(!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['csrf'],$_POST['csrf']))){http_response_code(403);exit('Обновите страницу.');}
function require_login(){} // Nginx Basic Auth + exact REMOTE_USER validation above, before SQL.
function reward_platform_names(): array{return ['vk'=>'ВКонтакте','ok'=>'Одноклассники','telegram'=>'Telegram','site'=>'Аккаунт сайта'];}
function reward_platform(): string {
    $p=$_GET['platform']??'vk';if(!is_string($p)||!isset(reward_platform_names()[$p])){http_response_code(400);exit('Неизвестная площадка.');}return $p;
}
function reward_credentials(string $database): array {
    global $rewardConfig;
    if(!in_array($database,RewardLinkTargets::DATABASES['test'],true))throw new RuntimeException('test_only');
    $c=$rewardConfig['databases'][$database]??null;
    if(!is_array($c)||($c['database']??null)!==$database)throw new RuntimeException('invalid_database_config');return $c;
}
function db(){
    static $db=null;if($db)return $db;
    $name=RewardLinkTargets::database('test',reward_platform());$c=reward_credentials($name);
    $db=new mysqli('127.0.0.1',$c['user'],$c['password'],$name,3306);$db->set_charset('utf8mb4');return $db;
}
function reward_publisher(): RewardLinkPublisher {
    return new RewardLinkPublisher('test',function($name){$c=reward_credentials($name);return new PDO('mysql:host=127.0.0.1;dbname='.$name.';charset=utf8mb4',$c['user'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);});
}
function reward_url(string $code): string {
    if(!str_starts_with($code,'r1_'))return '#';return RewardLinkTargets::url('test',reward_platform(),$code);
}
reward_platform();
