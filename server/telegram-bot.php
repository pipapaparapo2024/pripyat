<?php
ini_set('display_errors','0');header('Content-Type: application/json; charset=utf-8');
require_once __DIR__.'/core/models/telegramauth.php';
require_once __DIR__.'/core/models/telegramfriends.php';
require_once __DIR__.'/core/models/telegrambotclient.php';
require_once __DIR__.'/core/models/telegrambothandler.php';
require_once __DIR__.'/core/models/telegramstars.php';
require_once __DIR__.'/core/models/telegramaccess.php';
try{
    $stage='config';
    $path=getenv('PRIPYAT_TELEGRAM_CONFIG');if(!$path||!is_file($path))throw new RuntimeException('disabled');
    $c=require $path;TelegramAuth::validateConfig($c);
    $stage='request_auth';
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||!TelegramBotHandler::authorized((string)($c['webhook_secret']??''),(string)($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN']??''))){http_response_code(403);echo '{}';exit;}
    $raw=file_get_contents('php://input',false,null,0,65537);if(strlen($raw)>65536)throw new InvalidArgumentException('large_update');
    $update=json_decode($raw,true,64,JSON_THROW_ON_ERROR);
    if(!is_array($update)||!is_int($update['update_id']??null)||$update['update_id']<0)throw new InvalidArgumentException('invalid_update');
    $stage='update_lock';
    $file=TelegramEnvironment::stateDirectory().'/bot-updates/'.$update['update_id'];
    $lock=fopen($file,'c+');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('lock_failed');
    if(trim(stream_get_contents($lock))==='done'){echo '{}';exit;}
    $stage='database_connect';
    $db=new PDO('mysql:host=127.0.0.1;port=3306;dbname='.TelegramEnvironment::database().';charset=utf8mb4',$c['db_user'],$c['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
    $texts=json_decode(file_get_contents(__DIR__.'/json/telegram_bot.json'),true,16,JSON_THROW_ON_ERROR);
    $bot=new TelegramBotClient($c['bot_token'],$c['bot_api_environment']??'production',null,$c['bot_api_relay_port']??null);$payments=null;
    if(($c['stars_enabled']??false)===true){$catalog=json_decode(file_get_contents(__DIR__.'/json/telegram_stars.json'),true,32,JSON_THROW_ON_ERROR);$payments=new TelegramStars($db,$catalog,$bot);}
    $stage='handler';
    (new TelegramBotHandler(new TelegramFriends($db),$bot,$texts['welcome'],$payments,new TelegramAccess))->handle($update);
    $stage='mark_done';
    rewind($lock);ftruncate($lock,0);fwrite($lock,'done');flock($lock,LOCK_UN);fclose($lock);
    echo '{}';
}catch(InvalidArgumentException|JsonException $e){http_response_code(400);echo '{}';}
catch(Throwable $e){
    $reason='unclassified';
    if($e instanceof PDOException){$code=(string)$e->getCode();$reason='pdo_'.(preg_match('/^[A-Za-z0-9_-]{1,16}$/D',$code)?$code:'error');}
    elseif($e instanceof RuntimeException){$message=$e->getMessage();if(preg_match('/^[A-Za-z0-9_-]{1,80}$/D',$message))$reason=$message;}
    error_log('[telegram-bot] update_failed stage='.$stage.' type='.get_class($e).' reason='.$reason);
    http_response_code(503);echo '{}';
}
