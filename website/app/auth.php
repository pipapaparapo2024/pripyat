<?php
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store, private');
require __DIR__.'/telegramoidc.php';require __DIR__.'/telegramauth.php';require __DIR__.'/telegramloginstore.php';require __DIR__.'/telegramwebsitetestaccess.php';
require __DIR__.'/gameaccesspolicy.php';require __DIR__.'/rewardlinktargets.php';
function webResult(array $value,int $status=200): never {http_response_code($status);echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
$stage='configuration';
final class WebsiteProviderException extends RuntimeException {
    public function __construct(string $reason, public readonly array $diagnostics) {
        parent::__construct($reason);
    }
}
function websiteAuthDiagnostic(string $event,string $stage,?Throwable $error=null): string {
    $known=['invalid_encoding','invalid_oidc_config','invalid_oidc_state','invalid_jwk','invalid_id_token','invalid_jwt_header','invalid_jwt_signature','invalid_jwt_claims','invalid_jwt_nonce','missing_jwt_telegram_id','invalid_jwt_telegram_id','provider_unavailable','invalid_provider_response','missing_id_token','invalid_provider_endpoint'];
    $message=$error?->getMessage();
    $reason=in_array($message,$known,true)?' reason='.$message:'';
    $type=$error===null?'':' type='.get_class($error);
    $reference=bin2hex(random_bytes(8));
    $line='reference='.$reference.' event='.$event.' stage='.$stage.$type.$reason;
    if($error instanceof WebsiteProviderException){
        foreach($error->diagnostics as $key=>$value)$line.=' '.$key.'='.$value;
    }
    if(!error_log(gmdate('c').' '.$line.PHP_EOL,3,'/var/lib/pripyat-site-test/website-auth-diagnostics.log'))error_log('[website-auth] '.$line);
    return $reference;
}
function webHttp(string $url,?array $body=null,?string $basic=null,?int $relayPort=null): array {
    $allowed=['https://oauth.telegram.org/token','https://oauth.telegram.org/.well-known/jwks.json'];
    if(!in_array($url,$allowed,true)||$relayPort!==10444)throw new RuntimeException('invalid_provider_endpoint');
    $ch=curl_init($url);$bytes='';
    curl_setopt_array($ch,[CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>12,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_CONNECT_TO=>['oauth.telegram.org:443:127.0.0.1:'.$relayPort],CURLOPT_PROXY=>'',CURLOPT_ACCEPT_ENCODING=>'',CURLOPT_WRITEFUNCTION=>function($ch,$chunk)use(&$bytes){if(strlen($bytes)+strlen($chunk)>1048576)return 0;$bytes.=$chunk;return strlen($chunk);}]);
    if($body!==null)curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($body),CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded']]);
    if($basic!==null)curl_setopt($ch,CURLOPT_HTTPHEADER,['Content-Type: application/x-www-form-urlencoded','Authorization: Basic '.$basic]);
    $ok=curl_exec($ch);
    $info=['http_status'=>curl_getinfo($ch,CURLINFO_HTTP_CODE),'curl_errno'=>curl_errno($ch),'body_bytes'=>strlen($bytes)];
    curl_close($ch);
    if($ok===false||$info['http_status']!==200)throw new WebsiteProviderException('provider_unavailable',$info);
    try{
        $value=json_decode($bytes,true,32,JSON_THROW_ON_ERROR);
    }catch(JsonException $error){
        throw new WebsiteProviderException('invalid_provider_response',$info+['json_error'=>$error->getCode()]);
    }
    if(!is_array($value)||($body===null&&(!is_array($value['keys']??null)||$value['keys']===[]))){
        throw new WebsiteProviderException('invalid_provider_response',$info);
    }
    return $value;
}
try{
    $file=getenv('PRIPYAT_WEBSITE_AUTH_CONFIG');$gamefile=getenv('PRIPYAT_WEBSITE_GAME_CONFIG');
    if(!$file||!$gamefile||!is_file($file)||!is_file($gamefile))webResult(['error'=>'website_not_configured'],503);
    $c=json_decode(file_get_contents($file),true,32,JSON_THROW_ON_ERROR);$g=require $gamefile;
    $origin='https://pripyat-game-site.ru';$redirect=$origin.'/auth/telegram/callback';
    if(($c['origin']??'')!==$origin)throw new RuntimeException('invalid_origin');
    $action=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
    $method=$_SERVER['REQUEST_METHOD']??'';
    $tg=$c['telegram']??[];
    if($action==='/auth/telegram/payment-notification'){
        $stage='website_payment_notification';
        if($method!=='POST')webResult(['error'=>'post_required'],405);
        require_once __DIR__.'/telegramwebsitepayments.php';
        $raw=file_get_contents('php://input',false,null,0,65537);
        if($raw===false||strlen($raw)>65536)webResult(['error'=>'invalid_notification'],400);
        $paymentId=TelegramWebsitePayments::notificationId(json_decode($raw,true,32,JSON_THROW_ON_ERROR));
        if($paymentId!==null){
            $db=new PDO('mysql:host=127.0.0.1;dbname=stalker_telegram_test;charset=utf8mb4',$g['db_user'],$g['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
            $payments=new TelegramWebsitePayments($db,$tg['website_rub_payments']??[],'test',[$tg['website_rub_payments_live_test_owner']??[]]);
            if(!$payments->enabled())webResult(['error'=>'test_payments_unavailable'],503);
            $payments->notification($paymentId,time());
        }
        webResult(['received'=>true]);
    }
    $stage='session';
    session_name('pripyat_website_test');session_start(['cookie_secure'=>true,'cookie_httponly'=>true,'cookie_samesite'=>'Lax','cookie_path'=>'/','use_strict_mode'=>true]);
    if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
    $relayPort=$tg['oauth_relay_port']??null;
    $ready=($c['enabled']??false)===true&&($tg['enabled']??false)===true&&preg_match('/^[1-9][0-9]+$/D',(string)($tg['client_id']??''))&&($tg['client_id']??null)===explode(':',$g['bot_token']??'')[0]&&is_string($tg['client_secret']??null)&&strlen($tg['client_secret'])>=16&&($tg['redirect_uri']??'')===$redirect&&$relayPort===10444;
    $preview=TelegramWebsiteTestAccess::active($_SESSION,time());
    if($action==='/auth/telegram/status'&&$method==='GET')webResult(['authenticated'=>$preview&&isset($_SESSION['website_tg'])&&($_SESSION['website_tg']['expires_at']??0)>time(),'platform'=>'telegram','providers'=>['telegram'=>(bool)($ready&&$preview)],'csrf'=>$_SESSION['csrf']]);
    if($action==='/auth/telegram/test-access'){
        $stage='test_access';
        if($method!=='POST')webResult(['error'=>'post_required'],405);
        if(($_SERVER['HTTP_ORIGIN']??'')!==$origin||!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['csrf'],$_POST['csrf']))webResult(['error'=>'csrf_rejected'],403);
        if(!$ready||!TelegramWebsiteTestAccess::redeem($_SESSION,(string)($_POST['ticket']??''),(string)($tg['test_access_hash']??''),(int)($tg['test_access_expires_at']??0),time()))webResult(['error'=>'test_access_rejected'],403);
        session_regenerate_id(true);webResult(['authorized'=>true]);
    }
    $paymentActions=['/auth/telegram/payment-create','/auth/telegram/payment-status'];
    if(in_array($action,array_merge(['/auth/telegram/logout','/auth/telegram/bootstrap'],$paymentActions),true)){
        if($method!=='POST')webResult(['error'=>'post_required'],405);
        if(($_SERVER['HTTP_ORIGIN']??'')!==$origin||!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['csrf'],$_POST['csrf']))webResult(['error'=>'csrf_rejected'],403);
    }
    if($action==='/auth/telegram/logout'){
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
    if(in_array($action,array_merge(['/auth/telegram/start','/auth/telegram/callback','/auth/telegram/bootstrap'],$paymentActions),true)&&!$preview)webResult(['error'=>'telegram_test_access_required'],403);
    $stage='access_policy';
    $policy=new GameAccessPolicy($c['access']);
    if($action==='/auth/telegram/start'&&$method==='GET'){
        $stage='authorization_start';
        $reward=$_GET['reward']??'';
        if(!is_string($reward)||($reward!==''&&(!str_starts_with($reward,'r1_')||!RewardLinkTargets::matches($reward,'stalker_telegram_test'))))webResult(['error'=>'reward_target_mismatch'],400);
        $begin=TelegramOidc::begin($tg['client_id'],$redirect,time());
        $_SESSION['telegram_oidc']=$begin['pending'];$_SESSION['pending_reward']=$reward;
        header('Location: '.$begin['url'],true,302);exit;
    }
    if($action==='/auth/telegram/callback'&&$method==='GET'){
        $stage='callback_state';
        $state=$_GET['state']??null;$code=$_GET['code']??null;
        if(!is_string($state)||!is_string($code)||$code===''||strlen($code)>4096)webResult(['error'=>'invalid_callback'],401);
        $pending=TelegramOidc::consume($_SESSION,$state,time());
        $stage='token_exchange';
        $tokens=webHttp('https://oauth.telegram.org/token',['grant_type'=>'authorization_code','code'=>$code,'redirect_uri'=>$redirect,'client_id'=>$tg['client_id'],'code_verifier'=>$pending['verifier']],base64_encode($tg['client_id'].':'.$tg['client_secret']),$relayPort);
        $stage='token_response';
        if(!is_string($tokens['id_token']??null))throw new RuntimeException('missing_id_token');
        $stage='jwks_fetch';
        $jwks=webHttp('https://oauth.telegram.org/.well-known/jwks.json',null,null,$relayPort);
        $stage='id_token_validation';
        $nonce=$pending['nonce']??null;
        $identity=TelegramOidc::verify($tokens['id_token'],$jwks,$tg['client_id'],$nonce,time());
        $stage='identity_allowlist';
        if(!$policy->allowed('telegram',$identity['telegram_id'])){
            $reference=websiteAuthDiagnostic('rejected','identity_allowlist');
            webResult(['error'=>'closed_test_access_denied','reference'=>$reference],403);
        }
        session_regenerate_id(true);
        $_SESSION['website_tg']=['identity'=>$identity,'expires_at'=>time()+3600];
        websiteAuthDiagnostic('accepted','callback');
        header('Location: /game/telegram-test.html?auth=telegram',true,302);exit;
    }
    if($action==='/auth/telegram/bootstrap'||in_array($action,$paymentActions,true)){
        $auth=$_SESSION['website_tg']??null;
        if(!is_array($auth)||($auth['expires_at']??0)<=time()){
            $reference=websiteAuthDiagnostic('rejected','website_session_expired');
            webResult(['error'=>'login_required','reference'=>$reference],401);
        }
        $stage='website_identity';
        $identity=$auth['identity']??null;
        if(!is_array($identity)){
            $reference=websiteAuthDiagnostic('rejected','website_session_relogin_required');
            webResult(['error'=>'login_required','reference'=>$reference],401);
        }
        if(!$policy->allowed('telegram',$identity['telegram_id'])){
            $reference=websiteAuthDiagnostic('rejected','identity_allowlist');
            webResult(['error'=>'closed_test_access_denied','reference'=>$reference],403);
        }
        $stage='game_session';
        $db=new PDO('mysql:host=127.0.0.1;dbname=stalker_telegram_test;charset=utf8mb4',$g['db_user'],$g['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
        require_once __DIR__.'/telegramwebsitepayments.php';
        $paymentMode=TelegramWebsitePayments::websiteTestMode(
            (string)$identity['telegram_id'],
            $preview,
            ($tg['live_payments_owner_test_enabled']??false)===true
        );
        $paymentConfig=$paymentMode==='live_test_owner'
            ?($tg['website_rub_payments_live_test_owner']??[])
            :($tg['website_rub_payments']??[]);
        $payments=new TelegramWebsitePayments($db,$paymentConfig,$paymentMode,[$tg['website_rub_payments']??[],$tg['website_rub_payments_live_test_owner']??[]]);
        if(in_array($action,$paymentActions,true)){
            $stage='website_payment';
            if(!$payments->enabled())webResult(['error'=>'test_payments_unavailable'],503);
            $token=$_SESSION['game_token']??null;
            if(!is_string($token)){
                $reference=websiteAuthDiagnostic('rejected','website_game_token_missing');
                webResult(['error'=>'login_required','reference'=>$reference],401);
            }
            $uid=$payments->player($identity['telegram_id'],$token,time());
            if($uid===null){
                $reference=websiteAuthDiagnostic('rejected','website_game_session_revoked');
                webResult(['error'=>'login_required','reference'=>$reference],401);
            }
            session_write_close();
            if($action==='/auth/telegram/payment-create'){
                $product=$_POST['product_id']??null;
                $intent=$_POST['intent']??null;
                if(!is_string($product)||!preg_match('/^[0-9]{1,3}$/D',$product)||!is_string($intent))webResult(['error'=>'invalid_payment_request'],400);
                webResult($payments->create($uid,(int)$product,$intent,time()));
            }
            $order=$_POST['order_id']??null;
            if(!is_string($order))webResult(['error'=>'invalid_payment_request'],400);
            webResult(['status'=>$payments->status($uid,$order,time())]);
        }
        $session=TelegramAuth::loginVerifiedWebsiteSession($identity,$g,new TelegramLoginStore($db),time());
        $session['payments_enabled']=$payments->enabled();
        $session['payment_mode']=$payments->mode();
        $reward=$_SESSION['pending_reward']??'';
        if(is_string($reward)&&str_starts_with($reward,'r1_')&&RewardLinkTargets::matches($reward,'stalker_telegram_test'))$session['reward_code']=$reward;
        $_SESSION['game_token']=$session['token'];
        websiteAuthDiagnostic('accepted','game_session');
        webResult($session);
    }
    webResult(['error'=>'route_not_found'],404);
}catch(InvalidArgumentException|JsonException $e){
    $reference=websiteAuthDiagnostic('rejected',$stage,$e);
    webResult(['error'=>'authentication_rejected','reference'=>$reference],401);
}catch(Throwable $e){
    $reference=websiteAuthDiagnostic('failed',$stage,$e);
    webResult(['error'=>'authentication_unavailable','reference'=>$reference,'text'=>'Не удалось выполнить вход. Повторите позже.'],503);
}
