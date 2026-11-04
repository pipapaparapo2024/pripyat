<?php
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store, private');
require __DIR__.'/telegramoidc.php';require __DIR__.'/telegramauth.php';require __DIR__.'/telegramloginstore.php';
require __DIR__.'/gameaccesspolicy.php';require __DIR__.'/rewardlinktargets.php';
function webResult(array $value,int $status=200): never {http_response_code($status);echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
function webHttp(string $url,?array $body=null,?string $basic=null): array {
    $allowed=['https://oauth.telegram.org/token','https://oauth.telegram.org/.well-known/jwks.json'];
    if(!in_array($url,$allowed,true))throw new RuntimeException('invalid_provider_endpoint');
    $ch=curl_init($url);$bytes='';
    curl_setopt_array($ch,[CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>12,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_WRITEFUNCTION=>function($ch,$chunk)use(&$bytes){if(strlen($bytes)+strlen($chunk)>1048576)return 0;$bytes.=$chunk;return strlen($chunk);}]);
    if($body!==null)curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($body),CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded']]);
    if($basic!==null)curl_setopt($ch,CURLOPT_HTTPHEADER,['Content-Type: application/x-www-form-urlencoded','Authorization: Basic '.$basic]);
    $ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    if($ok===false||$status!==200)throw new RuntimeException('provider_unavailable');
    $value=json_decode($bytes,true,32,JSON_THROW_ON_ERROR);if(!is_array($value))throw new RuntimeException('invalid_provider_response');return $value;
}
try{
    $file=getenv('PRIPYAT_WEBSITE_AUTH_CONFIG');$gamefile=getenv('PRIPYAT_WEBSITE_GAME_CONFIG');
    if(!$file||!$gamefile||!is_file($file)||!is_file($gamefile))webResult(['error'=>'website_not_configured'],503);
    $c=json_decode(file_get_contents($file),true,32,JSON_THROW_ON_ERROR);$g=require $gamefile;
    $origin='https://pripyat-game-site.ru';$redirect=$origin.'/auth/telegram/callback';
    if(($c['origin']??'')!==$origin)throw new RuntimeException('invalid_origin');
    session_name('pripyat_website_test');session_start(['cookie_secure'=>true,'cookie_httponly'=>true,'cookie_samesite'=>'Lax','cookie_path'=>'/','use_strict_mode'=>true]);
    if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
    $action=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);$method=$_SERVER['REQUEST_METHOD']??'';
    $tg=$c['telegram']??[];
    $ready=($c['enabled']??false)===true&&($tg['enabled']??false)===true&&preg_match('/^[1-9][0-9]+$/D',(string)($tg['client_id']??''))&&($tg['client_id']??null)===explode(':',$g['bot_token']??'')[0]&&is_string($tg['client_secret']??null)&&strlen($tg['client_secret'])>=16&&($tg['redirect_uri']??'')===$redirect;
    if($action==='/auth/status'&&$method==='GET')webResult(['authenticated'=>isset($_SESSION['website_tg'])&&($_SESSION['website_tg']['expires_at']??0)>time(),'providers'=>['telegram'=>(bool)$ready,'vk'=>false,'ok'=>false,'site'=>false],'csrf'=>$_SESSION['csrf']]);
    if(in_array($action,['/auth/logout','/auth/bootstrap'],true)){
        if($method!=='POST')webResult(['error'=>'post_required'],405);
        if(($_SERVER['HTTP_ORIGIN']??'')!==$origin||!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['csrf'],$_POST['csrf']))webResult(['error'=>'csrf_rejected'],403);
    }
    if($action==='/auth/logout'){
        $token=$_SESSION['game_token']??null;
        if(is_string($token)&&preg_match('/^[a-f0-9]{64}$/D',$token)){
            TelegramAuth::validateConfig($g);$db=new PDO('mysql:host=127.0.0.1;dbname=stalker_telegram_test;charset=utf8mb4',$g['db_user'],$g['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
            $lock=TelegramPlayerLock::forSession($db,$token);
            $q=$db->prepare('DELETE FROM telegram_sessions WHERE token_hash=?');$q->execute([hash('sha256',$token)]);
            if($lock)$lock->release();
        }
        $_SESSION=[];session_regenerate_id(true);webResult(['logged_out'=>true]);
    }
    if(!$ready)webResult(['error'=>'telegram_website_not_configured','text'=>'Вход через Telegram ещё подключается.'],503);
    $policy=new GameAccessPolicy($c['access']);
    if($action==='/auth/telegram/start'&&$method==='GET'){
        $reward=$_GET['reward']??'';
        if(!is_string($reward)||($reward!==''&&(!str_starts_with($reward,'r1_')||!RewardLinkTargets::matches($reward,'stalker_telegram_test'))))webResult(['error'=>'reward_target_mismatch'],400);
        $begin=TelegramOidc::begin($tg['client_id'],$redirect,time());
        $_SESSION['telegram_oidc']=$begin['pending'];$_SESSION['pending_reward']=$reward;
        header('Location: '.$begin['url'],true,302);exit;
    }
    if($action==='/auth/telegram/callback'&&$method==='GET'){
        $state=$_GET['state']??null;$code=$_GET['code']??null;
        if(!is_string($state)||!is_string($code)||$code===''||strlen($code)>4096)webResult(['error'=>'invalid_callback'],401);
        $pending=TelegramOidc::consume($_SESSION,$state,time());
        $tokens=webHttp('https://oauth.telegram.org/token',['grant_type'=>'authorization_code','code'=>$code,'redirect_uri'=>$redirect,'client_id'=>$tg['client_id'],'code_verifier'=>$pending['verifier']],base64_encode($tg['client_id'].':'.$tg['client_secret']));
        if(!is_string($tokens['id_token']??null))throw new RuntimeException('missing_id_token');
        $jwks=webHttp('https://oauth.telegram.org/.well-known/jwks.json');
        $identity=TelegramOidc::verify($tokens['id_token'],$jwks,$tg['client_id'],$pending['nonce'],time());
        if(!$policy->allowed('telegram',$identity['telegram_id']))webResult(['error'=>'closed_test_access_denied'],403);
        session_regenerate_id(true);
        $_SESSION['website_tg']=['id_token'=>$tokens['id_token'],'jwks'=>$jwks,'nonce'=>$pending['nonce'],'expires_at'=>min(time()+3600,$identity['expires_at'])];
        header('Location: /game/',true,302);exit;
    }
    if($action==='/auth/bootstrap'){
        $auth=$_SESSION['website_tg']??null;
        if(!is_array($auth)||($auth['expires_at']??0)<=time())webResult(['error'=>'login_required'],401);
        $identity=TelegramOidc::verify($auth['id_token'],$auth['jwks'],$tg['client_id'],$auth['nonce'],time());
        if(!$policy->allowed('telegram',$identity['telegram_id']))webResult(['error'=>'closed_test_access_denied'],403);
        $db=new PDO('mysql:host=127.0.0.1;dbname=stalker_telegram_test;charset=utf8mb4',$g['db_user'],$g['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
        $session=TelegramAuth::loginWebsite($auth['id_token'],$auth['jwks'],$tg['client_id'],$auth['nonce'],$g,new TelegramLoginStore($db),time());
        $reward=$_SESSION['pending_reward']??'';
        if(is_string($reward)&&str_starts_with($reward,'r1_')&&RewardLinkTargets::matches($reward,'stalker_telegram_test'))$session['reward_code']=$reward;
        $_SESSION['game_token']=$session['token'];webResult($session);
    }
    webResult(['error'=>'route_not_found'],404);
}catch(InvalidArgumentException|JsonException $e){webResult(['error'=>'authentication_rejected'],401);}
catch(Throwable $e){error_log('[website-auth] failed type='.get_class($e));webResult(['error'=>'authentication_unavailable','text'=>'Не удалось выполнить вход. Повторите позже.'],503);}
