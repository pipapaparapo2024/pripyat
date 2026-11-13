<?php
declare(strict_types=1);

ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');

$telegramModels=is_file(__DIR__.'/telegramauth.php')?__DIR__:__DIR__.'/../../server/core/models';
require_once $telegramModels.'/telegramauth.php';
require_once $telegramModels.'/telegramloginstore.php';
require_once $telegramModels.'/telegramplayerlock.php';
require_once $telegramModels.'/telegramoidc.php';
require_once $telegramModels.'/gameaccesspolicy.php';
require_once $telegramModels.'/rewardlinktargets.php';
require_once __DIR__.'/telegramwebsitepayments.php';
require_once __DIR__.'/sitereceipthistory.php';

function telegramProdResult(array $data,int $status=200): never {
    http_response_code($status);
    echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    exit;
}

function telegramProdDiagnostic(string $event,string $stage,?Throwable $error=null): string {
    $known=['invalid_oidc_config','invalid_oidc_state','invalid_jwk','invalid_id_token','invalid_jwt_header',
        'invalid_jwt_signature','invalid_jwt_claims','invalid_jwt_nonce','missing_jwt_telegram_id',
        'invalid_jwt_telegram_id','provider_unavailable','invalid_provider_response','missing_id_token',
        'invalid_provider_endpoint','login_required','payment_world_mismatch','payment_mismatch'];
    $reason=$error!==null&&in_array($error->getMessage(),$known,true)?' reason='.$error->getMessage():'';
    $reference=bin2hex(random_bytes(8));
    $line=gmdate('c').' reference='.$reference.' event='.$event.' stage='.$stage.
        ($error!==null?' type='.get_class($error):'').$reason.PHP_EOL;
    error_log('[telegram-prod-auth] '.$line);
    return $reference;
}

function telegramProdHttp(string $url,?array $body=null,?string $basic=null): array {
    $allowed=['https://oauth.telegram.org/token','https://oauth.telegram.org/.well-known/jwks.json'];
    if(!in_array($url,$allowed,true))throw new InvalidArgumentException('invalid_provider_endpoint');
    $ch=curl_init($url);$bytes='';
    curl_setopt_array($ch,[CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>12,CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,
        CURLOPT_CONNECT_TO=>['oauth.telegram.org:443:127.0.0.1:10444'],CURLOPT_PROXY=>'',CURLOPT_ACCEPT_ENCODING=>'',
        CURLOPT_WRITEFUNCTION=>function($ch,$chunk)use(&$bytes){if(strlen($bytes)+strlen($chunk)>1048576)return 0;$bytes.=$chunk;return strlen($chunk);}]);
    if($body!==null)curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($body),
        CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded']]);
    if($basic!==null)curl_setopt($ch,CURLOPT_HTTPHEADER,['Content-Type: application/x-www-form-urlencoded','Authorization: Basic '.$basic]);
    $ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    if($ok===false||$status!==200)throw new RuntimeException('provider_unavailable');
    $result=json_decode($bytes,true,32,JSON_THROW_ON_ERROR);
    if(!is_array($result)||($body===null&&(!is_array($result['keys']??null)||$result['keys']===[])))throw new RuntimeException('invalid_provider_response');
    return $result;
}

$stage='configuration';
try {
    $configPath=getenv('PRIPYAT_WEBSITE_TELEGRAM_PROD_CONFIG');
    if(!is_string($configPath)||!is_file($configPath))telegramProdResult(['error'=>'telegram_website_not_configured'],503);
    $game=json_decode((string)file_get_contents($configPath),true,32,JSON_THROW_ON_ERROR);
    $oidc=$game['oidc']??[];
    TelegramAuth::validateConfig($game);
    $origin='https://pripyat-game-site.ru';
    $redirect=$origin.'/auth/telegram-prod/callback';
    if(($game['environment']??'')!=='prod'||($game['database']??'')!=='stalker_telegram'
        ||($oidc['client_id']??null)!==explode(':',(string)($game['bot_token']??''))[0]
        ||($oidc['redirect_uri']??null)!==$redirect||!is_string($oidc['client_secret']??null)
        ||strlen($oidc['client_secret'])<16)throw new RuntimeException('invalid_oidc_config');

    $action=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
    $method=$_SERVER['REQUEST_METHOD']??'';
    $postLimit=$action==='/auth/telegram-prod/payment-notification'?65536:8192;
    if($method==='POST'&&(int)($_SERVER['CONTENT_LENGTH']??0)>$postLimit)telegramProdResult(['error'=>'request_too_large'],413);

    if($action==='/auth/telegram-prod/payment-notification'){
        if($method!=='POST')telegramProdResult(['error'=>'post_required'],405);
        $raw=file_get_contents('php://input',false,null,0,65537);
        if(!is_string($raw)||strlen($raw)>65536)telegramProdResult(['error'=>'invalid_notification'],400);
        $paymentId=TelegramWebsitePayments::notificationId(json_decode($raw,true,32,JSON_THROW_ON_ERROR));
        if($paymentId!==null){
            $db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram;charset=utf8mb4',
                $game['db_user'],$game['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
            $payments=new TelegramWebsitePayments($db,$game['website_rub_payments']??[],'prod');
            if(!$payments->enabled())telegramProdResult(['error'=>'payments_unavailable'],503);
            $payments->notification($paymentId,time());
        }
        telegramProdResult(['received'=>true]);
    }
    $stage='session';
    session_name('pripyat_website_telegram_prod');
    session_start(['cookie_secure'=>true,'cookie_httponly'=>true,'cookie_samesite'=>'Lax','cookie_path'=>'/','use_strict_mode'=>true]);
    if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
    $authenticated=is_array($_SESSION['website_tg_prod']??null)&&($_SESSION['website_tg_prod']['expires_at']??0)>time();

    if($action==='/auth/telegram-prod/status'&&$method==='GET')telegramProdResult([
        'authenticated'=>$authenticated,'platform'=>'telegram','providers'=>['telegram'=>true],'csrf'=>$_SESSION['csrf']]);

    if($action==='/auth/telegram-prod/receipts'&&$method==='GET'){
        if(($_SERVER['HTTP_SEC_FETCH_SITE']??'same-origin')!=='same-origin')telegramProdResult(['error'=>'forbidden'],403);
        $auth=$_SESSION['website_tg_prod']??null;
        if(!is_array($auth)||($auth['expires_at']??0)<=time())telegramProdResult(['error'=>'login_required'],401);
        $identity=$auth['identity']??null;
        if(!is_array($identity)||!is_string($identity['telegram_id']??null))telegramProdResult(['error'=>'login_required'],401);
        $db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram;charset=utf8mb4',
            $game['db_user'],$game['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
        $playerQuery=$db->prepare('SELECT player_id FROM telegram_identities WHERE telegram_id=?');
        $playerQuery->execute([$identity['telegram_id']]);$player=(int)$playerQuery->fetchColumn();
        if($player<1)telegramProdResult(['receipts'=>[]]);
        $receiptDirectory='/var/lib/pripyat-telegram-website/receipts';
        telegramProdResult(['receipts'=>SiteReceiptHistory::orders($db,$player,$receiptDirectory)]);
    }

    $postActions=['/auth/telegram-prod/logout','/auth/telegram-prod/bootstrap','/auth/telegram-prod/payment-create','/auth/telegram-prod/payment-status'];
    if(in_array($action,$postActions,true)){
        if($method!=='POST')telegramProdResult(['error'=>'post_required'],405);
        if(($_SERVER['HTTP_ORIGIN']??'')!==$origin||!is_string($_POST['csrf']??null)
            ||!hash_equals($_SESSION['csrf'],$_POST['csrf']))telegramProdResult(['error'=>'csrf_rejected'],403);
    }

    if($action==='/auth/telegram-prod/logout'){
        $db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram;charset=utf8mb4',
            $game['db_user'],$game['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
        $token=$_SESSION['game_token']??null;
        if(is_string($token)&&preg_match('/^[a-f0-9]{64}$/D',$token)){
            $lock=TelegramPlayerLock::forSession($db,$token);
            try{$q=$db->prepare('DELETE FROM telegram_sessions WHERE token_hash=?');$q->execute([hash('sha256',$token)]);}
            finally{if($lock)$lock->release();}
        }
        $_SESSION=[];session_regenerate_id(true);telegramProdResult(['logged_out'=>true]);
    }

    if($action==='/auth/telegram-prod/start'&&$method==='GET'){
        $stage='authorization_start';$reward=$_GET['reward']??'';
        if(!is_string($reward)||($reward!==''&&(!str_starts_with($reward,'r1_')
            ||!RewardLinkTargets::matches($reward,'stalker_telegram'))))telegramProdResult(['error'=>'reward_target_mismatch'],400);
        $begin=TelegramOidc::begin($oidc['client_id'],$redirect,time());
        $_SESSION['telegram_prod_oidc']=$begin['pending'];$_SESSION['telegram_prod_reward']=$reward;
        header('Location: '.$begin['url'],true,302);exit;
    }

    if($action==='/auth/telegram-prod/callback'&&$method==='GET'){
        $stage='callback_state';$state=$_GET['state']??null;$code=$_GET['code']??null;
        if(!is_string($state)||!is_string($code)||$code===''||strlen($code)>4096)telegramProdResult(['error'=>'authentication_rejected'],401);
        $pendingSession=['telegram_oidc'=>$_SESSION['telegram_prod_oidc']??null];
        unset($_SESSION['telegram_prod_oidc']);
        $pending=TelegramOidc::consume($pendingSession,$state,time());
        $stage='token_exchange';
        $tokens=telegramProdHttp('https://oauth.telegram.org/token',['grant_type'=>'authorization_code','code'=>$code,
            'redirect_uri'=>$redirect,'client_id'=>$oidc['client_id'],'code_verifier'=>$pending['verifier']],
            base64_encode($oidc['client_id'].':'.$oidc['client_secret']));
        if(!is_string($tokens['id_token']??null))throw new RuntimeException('missing_id_token');
        $stage='jwks_fetch';$jwks=telegramProdHttp('https://oauth.telegram.org/.well-known/jwks.json');
        $stage='id_token_validation';$identity=TelegramOidc::verify($tokens['id_token'],$jwks,$oidc['client_id'],null,time());
        session_regenerate_id(true);
        $_SESSION['website_tg_prod']=['identity'=>$identity,'expires_at'=>time()+3600];
        telegramProdDiagnostic('accepted','callback');
        header('Location: /game/telegram.html?auth=telegram-prod',true,302);exit;
    }

    if($action==='/auth/telegram-prod/bootstrap'||str_starts_with((string)$action,'/auth/telegram-prod/payment-')){
        $db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram;charset=utf8mb4',
            $game['db_user'],$game['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
        $auth=$_SESSION['website_tg_prod']??null;
        if(!is_array($auth)||($auth['expires_at']??0)<=time()){
            $reference=telegramProdDiagnostic('rejected','website_session_expired');
            telegramProdResult(['error'=>'login_required','reference'=>$reference],401);
        }
        $identity=$auth['identity']??null;
        if(!is_array($identity))telegramProdResult(['error'=>'login_required'],401);
        $stage='game_session';
        $payments=new TelegramWebsitePayments($db,$game['website_rub_payments']??[],'prod',[$game['website_rub_payments']??[]]);
        if($action!=='/auth/telegram-prod/bootstrap'){
            if(!$payments->enabled())telegramProdResult(['error'=>'payments_unavailable'],503);
            $token=$_SESSION['game_token']??null;
            if(!is_string($token)||($player=$payments->player($identity['telegram_id'],$token,time()))===null){
                $reference=telegramProdDiagnostic('rejected','website_game_session_missing');
                telegramProdResult(['error'=>'login_required','reference'=>$reference],401);
            }
            session_write_close();
            if($action==='/auth/telegram-prod/payment-create'){
                $product=$_POST['product_id']??null;$intent=$_POST['intent']??null;
                if(!is_string($product)||!preg_match('/^[0-9]{1,3}$/D',$product)||!is_string($intent))telegramProdResult(['error'=>'invalid_payment_request'],400);
                telegramProdResult($payments->create($player,(int)$product,$intent,time()));
            }
            $order=$_POST['order_id']??null;
            if(!is_string($order))telegramProdResult(['error'=>'invalid_payment_request'],400);
            telegramProdResult(['status'=>$payments->status($player,$order,time())]);
        }
        $session=TelegramAuth::loginVerifiedWebsiteSession($identity,$game,new TelegramLoginStore($db),time());
        $session['payments_enabled']=$payments->enabled();$session['payment_mode']='live';
        $reward=$_SESSION['telegram_prod_reward']??'';
        if(is_string($reward)&&$reward!==''&&RewardLinkTargets::matches($reward,'stalker_telegram'))$session['reward_code']=$reward;
        $_SESSION['game_token']=$session['token'];
        telegramProdDiagnostic('accepted','game_session');
        telegramProdResult($session);
    }
    telegramProdResult(['error'=>'route_not_found'],404);
}catch(InvalidArgumentException|JsonException $error){
    $reference=telegramProdDiagnostic('rejected',$stage,$error);
    telegramProdResult(['error'=>'authentication_rejected','reference'=>$reference],401);
}catch(Throwable $error){
    $reference=telegramProdDiagnostic('failed',$stage,$error);
    telegramProdResult(['error'=>'authentication_unavailable','reference'=>$reference],503);
}
