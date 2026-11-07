<?php
ini_set('display_errors','0');header('Cache-Control: no-store, private');header('Referrer-Policy: no-referrer');
require_once __DIR__.'/socialoauth.php';require_once __DIR__.'/siteratelimit.php';
require_once __DIR__.'/socialprofiles.php';
function socialTrace(string $attempt,string $platform,string $stage,string $result): void {
 // Use syslog directly. FastCGI stderr can make Nginx append the callback URL.
 if(!function_exists('openlog')||!function_exists('syslog')||!function_exists('closelog'))return;
 if(!openlog('pripyat-site-oauth',LOG_PID,LOG_USER))return;
 syslog(LOG_INFO,"attempt=$attempt platform=$platform stage=$stage result=$result");
 closelog();
}
function socialPage(string $title,string $text,int $status=200): never {
 http_response_code($status);header('Content-Type: text/html; charset=utf-8');$e=fn($v)=>htmlspecialchars($v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
 echo '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><title>Припять — вход через соцсеть</title><main><header>☢ ПРИПЯТЬ</header><section><h1>'.$e($title).'</h1><p>'.$e($text).'</p><a href="/">На главную</a></section></main></html>';exit;
}
$attempt='-';$platform='unknown';$stage='request';
try{
 session_name('pripyat_website_test');session_start(['cookie_secure'=>true,'cookie_httponly'=>true,'cookie_samesite'=>'Lax','cookie_path'=>'/','use_strict_mode'=>true]);
 $c=json_decode(file_get_contents(__DIR__.'/../private/site-runtime.json'),true,32,JSON_THROW_ON_ERROR);$vk=$c['vkid']??[];
 if(empty($vk['client_secret']))throw new RuntimeException('social_not_configured');
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
 if(($_SERVER['REQUEST_METHOD']??'')!=='GET')socialPage('Некорректный запрос','Для входа откройте сайт заново.',405);
 if(preg_match('~^/auth/(vk|ok)/start$~D',$path,$m)){
  $platform=$m[1];$stage='start';
  (new SiteRateLimit('/var/lib/pripyat-site-test/limits',$c['rate_secret']))->consume('social-start',$_SERVER['REMOTE_ADDR']??'',10,900,time());
  require_once __DIR__.'/rewardintent.php';RewardIntent::capture($_GET+['platform'=>$m[1]],time());
  $begin=SocialOAuth::begin($vk,$m[1],time());$_SESSION['social_oauth']=$begin['pending'];
  $attempt=SocialOAuth::traceId($begin['pending']['state'],(string)($c['rate_secret']??''));
  socialTrace($attempt,$platform,'start','redirected');header('Location: '.$begin['url'],true,302);exit;
 }
 if($path!=='/auth/vk/callback')socialPage('Страница не найдена','Вернитесь на главную.',404);
 $stage='callback';$state=$_GET['state']??'';
 $attempt=SocialOAuth::traceId($state,(string)($c['rate_secret']??''));
 socialTrace($attempt,$platform,$stage,'received');
 $stage='state';
 if(!is_string($state))throw new DomainException('invalid_social_state');
 $pending=SocialOAuth::consume($_SESSION,$state,time());$platform=$pending['platform'];
 $stage='callback_fields';
 if(($_GET['error']??null)==='access_denied'&&!isset($_GET['code']))throw new DomainException('access_denied');
 $code=$_GET['code']??'';$device=$_GET['device_id']??'';
 if(!is_string($code)||$code===''||strlen($code)>4096||!is_string($device)||$device===''||strlen($device)>1024)throw new DomainException('invalid_callback');
 $stage='token_exchange';
 $tokens=SocialOAuth::http('https://id.vk.ru/oauth2/auth',['grant_type'=>'authorization_code','client_id'=>$vk['client_id'],'client_secret'=>$vk['client_secret'],'redirect_uri'=>$vk['redirect_uri'],'code'=>$code,'device_id'=>$device,'code_verifier'=>$pending['verifier'],'state'=>$state]);
 if(!is_string($tokens['access_token']??null)||!is_string($tokens['state']??null)||!hash_equals($state,$tokens['state']))throw new DomainException('invalid_token_response');
 $stage='profile';
 $profile=SocialOAuth::http('https://id.vk.ru/oauth2/user_info',['client_id'=>$vk['client_id'],'access_token'=>$tokens['access_token']]);
 $user=$profile['user']??null;if(!is_array($user)||!preg_match('/^[1-9][0-9]{0,19}$/D',(string)($user['user_id']??''))||(string)($tokens['user_id']??'')!==(string)$user['user_id'])throw new DomainException('identity_mismatch');
 socialTrace($attempt,$platform,'profile','verified');
 $stage='character';
 // A provider identity is not a native game identity. Preserve evidence privately,
 // but issue no game session until the native identity has been independently proven.
 $native=null;$nativeError=null;
 if($pending['platform']==='vk'){
  try{$proof=SocialOAuth::http('https://api.vk.ru/method/users.get',['access_token'=>$tokens['access_token'],'v'=>'5.199']);$native=$proof['response'][0]['id']??null;$nativeError=$proof['error']['error_code']??null;}catch(Throwable $e){$nativeError='unavailable';}
 }
 session_regenerate_id(true);
 $_SESSION['social_verified']=['platform'=>$pending['platform'],'provider_id'=>(string)$user['user_id'],'native_vk_id'=>$native===null?null:(string)$native,'access_token'=>$tokens['access_token'],'profile'=>['first_name'=>$user['first_name']??'','last_name'=>$user['last_name']??'','avatar'=>$user['avatar']??null],'expires_at'=>time()+min(3600,(int)($tokens['expires_in']??3600))];
 unset($_SESSION['site_authenticated'],$_SESSION['site_pending'],$_SESSION['social_link_code'],$_SESSION['social_link_expires']);
 $diagnostic=['at'=>time(),'platform'=>$pending['platform'],'profile_fields'=>array_keys($user),'token_fields'=>array_keys($tokens),'provider_id'=>(string)$user['user_id'],'native_vk_id'=>$native,'native_error'=>$nativeError];
 $file=__DIR__.'/../private/social-checks/'.bin2hex(random_bytes(16)).'.json';file_put_contents($file,json_encode($diagnostic,JSON_THROW_ON_ERROR));chmod($file,0600);
 require_once __DIR__.'/socialidentity.php';try{$resolved=SocialIdentity::resolve($_SESSION['social_verified'],$c);$resolved['sessions']->validateCharacter($resolved['uid'],$resolved['external']);}catch(DomainException $e){if(!in_array($e->getMessage(),['native_identity_missing','social_link_required','native_mapping_missing','native_character_missing','native_launch_required'],true))throw $e;$_SESSION['social_needs_link']=true;socialTrace($attempt,$platform,$stage,SocialOAuth::failureReason($e));header('Location: /auth/social/link',true,302);exit;}SocialProfiles::put($resolved['platform'],$resolved['uid'],$user['avatar']??null);
 unset($_SESSION['social_needs_link']);socialTrace($attempt,$platform,'character','game_redirect');header('Location: /game/',true,302);exit;
}catch(DomainException $e){socialTrace($attempt,$platform,$stage,SocialOAuth::failureReason($e));socialPage('Вход не подтверждён','Проверка авторизации отклонена. Начните вход заново с сайта.',401);}
catch(Throwable $e){socialTrace($attempt,$platform,$stage,SocialOAuth::failureReason($e));socialPage('Вход временно недоступен','Не удалось завершить авторизацию. Повторите позже.',503);}
