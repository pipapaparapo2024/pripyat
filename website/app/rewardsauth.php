<?php
final class RewardsAuth {
 const COOKIE='pripyat_rewards_auth';
 public static function config():array{
  $path=getenv('PRIPYAT_REWARDS_AUTH_CONFIG');
  if(!$path||!is_file($path))throw new RuntimeException('admin_auth_unconfigured');
  $c=json_decode(file_get_contents($path),true,16,JSON_THROW_ON_ERROR);
  if(!is_string($c['user']??null)||!is_string($c['password_hash']??null)||strlen($c['signing_key']??'')<64)throw new RuntimeException('invalid_admin_auth');
  return $c;
 }
 private static function encode(string $s):string{return rtrim(strtr(base64_encode($s),'+/','-_'),'=');}
 public static function sign(array $ticket,array $config):string{
  $payload=self::encode(json_encode($ticket,JSON_THROW_ON_ERROR));
  return $payload.'.'.hash_hmac('sha256',$payload,$config['signing_key']);
 }
 public static function verify(string $cookie,array $c,int $now):?array{
  $parts=explode('.',$cookie);if(count($parts)!==2||strlen($cookie)>2048)return null;
  if(!hash_equals(hash_hmac('sha256',$parts[0],$c['signing_key']),$parts[1]))return null;
  $raw=base64_decode(strtr($parts[0],'-_','+/'),true);if($raw===false)return null;
  $t=json_decode($raw,true);
  if(!is_array($t)||($t['user']??null)!==$c['user']||!is_int($t['issued']??null)||$t['issued']>$now||$now >= $t['issued']+3600||!hash_equals(hash('sha256',$c['password_hash']),(string)($t['credential']??'')))return null;
  return $t;
 }
 public static function issue(array $ticket,array $config):void{
  setcookie(self::COOKIE,self::sign($ticket,$config),['expires'=>$ticket['issued']+3600,'path'=>'/rewards-admin/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);
 }
 public static function clear():void{setcookie(self::COOKIE,'',['expires'=>1,'path'=>'/rewards-admin/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);}
 public static function authenticate(string $user,string $password,array $c,int $now):?array{
  if(!password_verify($password,$c['password_hash'])||!hash_equals($c['user'],$user))return null;
  return ['user'=>$user,'issued'=>$now,'credential'=>hash('sha256',$c['password_hash']),'nonce'=>bin2hex(random_bytes(16))];
 }
}
function requireRewardsLogin():array{
 try{$c=RewardsAuth::config();$ticket=RewardsAuth::verify((string)($_COOKIE[RewardsAuth::COOKIE]??''),$c,time());}
 catch(Throwable $error){http_response_code(503);exit('Вход временно недоступен.');}
 if(!$ticket){header('Location: /rewards-admin/login.php',true,303);exit;}
 $_SERVER['REMOTE_USER']=$ticket['user'];return $ticket;
}
function handleRewardsLogin():void{
 header('Cache-Control: no-store, private');header('X-Frame-Options: DENY');header('Referrer-Policy: no-referrer');
 try{$config=RewardsAuth::config();}catch(Throwable $e){http_response_code(503);exit('Вход временно недоступен.');}
 session_name('pripyat_rewards_test');session_start(['cookie_httponly'=>true,'cookie_secure'=>true,'cookie_samesite'=>'Strict','cookie_path'=>'/rewards-admin/','use_strict_mode'=>true]);
 $_SESSION['login_csrf']??=bin2hex(random_bytes(32));
 if(($_SERVER['REQUEST_METHOD']??'')==='POST'){
  if(!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['login_csrf'],$_POST['csrf'])){http_response_code(403);exit('Обновите страницу входа.');}
  $lock=fopen($config['throttle_path'],'c+');if(!$lock||!flock($lock,LOCK_EX)){http_response_code(503);exit;}
  try{
   $raw=stream_get_contents($lock);$state=$raw===''?[]:json_decode($raw,true,8,JSON_THROW_ON_ERROR);$now=time();
   if(($state['retry_at']??0)>$now){http_response_code(429);exit('Слишком много попыток. Повторите позже.');}
   $user=is_string($_POST['user']??null)?$_POST['user']:'';$password=is_string($_POST['password']??null)?$_POST['password']:'';
   $ticket=RewardsAuth::authenticate($user,$password,$config,$now);
   $failures=$ticket?0:min(9,(int)($state['failures']??0)+1);
   $json=json_encode(['failures'=>$failures,'retry_at'=>$ticket?0:$now+min(300,2**$failures)],JSON_THROW_ON_ERROR);
   rewind($lock);if(fwrite($lock,$json)!==strlen($json)||!ftruncate($lock,strlen($json))||!fflush($lock))throw new RuntimeException('login_state_write');
  }catch(Throwable $e){http_response_code(503);exit('Вход временно недоступен.');}finally{fclose($lock);}
  if($ticket){session_regenerate_id(true);$_SESSION['login_csrf']=bin2hex(random_bytes(32));RewardsAuth::issue($ticket,$config);header('Location: /rewards-admin/index.php',true,303);exit;}
  $invalid=true;http_response_code(403);
 }
 header('Content-Type: text/html; charset=utf-8');
 echo '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход — наградные ссылки</title><link rel="stylesheet" href="style.css"><main class="wrap"><h1>Вход в админку наградных ссылок</h1><p>После входа потребуется код Google Authenticator. Логин и пароль запрашиваются каждый час.</p>';
 if(!empty($invalid))echo '<p>Логин или пароль не принят.</p>';
 echo '<form method="post"><label>Логин <input name="user" autocomplete="username" required></label><label>Пароль <input name="password" type="password" autocomplete="current-password" required></label><input type="hidden" name="csrf" value="'.$_SESSION['login_csrf'].'"><button>Продолжить</button></form></main></html>';
}
