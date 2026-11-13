<?php
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
$path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
if($path==='/auth/status'&&array_key_exists('donations',$_GET)){
 http_response_code(404);echo '{"error":"route_not_found"}';exit;
}
require_once __DIR__.'/siteauth.php';
require_once __DIR__.'/rewardintent.php';
require_once __DIR__.'/siteratelimit.php';
require_once __DIR__.'/sitephoneactions.php';
require_once __DIR__.'/sitesessions.php';
require_once __DIR__.'/sitefriends.php';
require_once __DIR__.'/siteavatar.php';
require_once __DIR__.'/siteroles.php';
require_once __DIR__.'/siteyookassa.php';
function siteResult(array $data,int $code=200): never {
 if($code>=400)RewardIntent::audit('bootstrap_error',in_array($data['error']??'',['csrf_rejected','rate_limited','login_required','temporarily_unavailable','request_rejected','invalid_input'],true)?$data['error']:'request_rejected',(int)($_SESSION['site_authenticated']['player_id']??0));
 if(isset($data['player_id'],$data['platform'])&&array_key_exists('reward_code',$data))RewardIntent::audit('bootstrap',is_string($data['reward_code'])?'delivered':(($_SESSION['reward_intent']['platform']??null)!==$data['platform']?'target_mismatch':'intent_expired'),(int)$data['player_id'],$data['platform']);
 http_response_code($code);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;
}
try {
 session_name('pripyat_website_test');
 session_start(['cookie_secure'=>true,'cookie_httponly'=>true,'cookie_samesite'=>'Lax','cookie_path'=>'/','use_strict_mode'=>true]);
 if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
 if($path==='/auth/status'&&($_SERVER['REQUEST_METHOD']??'')==='GET'&&($_GET['receipts']??null)==='1'){
  if(($_SERVER['HTTP_SEC_FETCH_SITE']??'same-origin')!=='same-origin')siteResult(['error'=>'forbidden'],403);
  require_once __DIR__.'/sitereceipthistory.php';
  $config=json_decode(file_get_contents(__DIR__.'/../private/site-runtime.json'),true,32,JSON_THROW_ON_ERROR);
  $session=$_SESSION;
  session_write_close();
  try {
   $limiter=new SiteRateLimit('/var/lib/pripyat-site-test/limits',$config['rate_secret']);
   $limiter->consume('receipt-history',session_id(),30,300,time());
   siteResult(['receipts'=>SiteReceiptHistory::read($session,$config)]);
  } catch(DomainException $e) {
   siteResult(['error'=>$e->getMessage()==='rate_limited'?'rate_limited':'login_required'],$e->getMessage()==='rate_limited'?429:401);
  }
 }
 if($path==='/auth/status'&&($_SERVER['REQUEST_METHOD']??'')==='GET')siteResult(['authenticated'=>(($_SESSION['site_authenticated']['expires_at']??0)>time())||(($_SESSION['social_verified']['expires_at']??0)>time()),'platform'=>isset($_SESSION['site_authenticated'])?'site':($_SESSION['social_verified']['platform']??null),'needs_character_link'=>!empty($_SESSION['social_needs_link'])&&!isset($_SESSION['site_authenticated']),'providers'=>['site'=>true,'vk'=>true,'ok'=>true,'telegram'=>false],'csrf'=>$_SESSION['csrf']]);
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST')siteResult(['error'=>'post_required'],405);
 if(($_SERVER['HTTP_ORIGIN']??'')!=='https://pripyat-game-site.ru'||!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['csrf'],$_POST['csrf']))siteResult(['error'=>'csrf_rejected','text'=>'РћР±РЅРѕРІРёС‚Рµ СЃС‚СЂР°РЅРёС†Сѓ Рё РїРѕРІС‚РѕСЂРёС‚Рµ РґРµР№СЃС‚РІРёРµ.'],403);
 if((int)($_SERVER['CONTENT_LENGTH']??0)>($path==='/auth/site/avatar'?2200000:8192))siteResult(['error'=>'request_too_large'],413);
 $action=basename($path);
 if(!in_array($action,['register','login','verify','resend','forgot','reset','phone-start','phone-check','bootstrap','logout','avatar','set-password'],true))siteResult(['error'=>'route_not_found'],404);
 foreach($_POST as $value)if(!is_string($value))siteResult(['error'=>'invalid_input'],400);
 require_once __DIR__.'/rewardintent.php';RewardIntent::capture($_POST,time());
 $c=json_decode(file_get_contents(__DIR__.'/../private/site-runtime.json'),true,32,JSON_THROW_ON_ERROR);
 $access=$c['access'];if(($access['enabled']??false)!==true)throw new RuntimeException('disabled');
 $limiter=new SiteRateLimit('/var/lib/pripyat-site-test/limits',$c['rate_secret']);$now=time();
 $limiter->consume('http-ip',$_SERVER['REMOTE_ADDR']??'',30,900,$now);
 $limiter->consume('http-session',session_id(),20,900,$now);
 if(isset($_POST['email']))$limiter->consume('email-action',strtolower(trim($_POST['email'])),8,1800,$now);
 if(($access['email']['mode']??'')==='open')$access['email']['ids']=['*'];
 $d=$c['database'];if($d['database']!=='stalker_site_test'||!in_array($d['host'],['127.0.0.1','localhost'],true))throw new RuntimeException('invalid_database');
 $db=new PDO('mysql:host='.$d['host'].';port=3306;dbname=stalker_site_test;charset=utf8mb4',$d['user'],$d['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
 if(!in_array($access['email']['mode']??'',['allowlist','open'],true)||!is_array($access['email']['ids']??null))throw new RuntimeException('invalid_access_policy');
 if($action==='avatar'){
  $owner=$_SESSION['site_authenticated']??$_SESSION['site_pending']??$_SESSION['site_registered']??null;
  if(!is_array($owner)||($owner['expires_at']??0)<=$now)throw new DomainException('login_required');
  $q=$db->prepare('SELECT email,disabled_at FROM site_accounts WHERE player_id=?');$q->execute([$owner['player_id']]);$row=$q->fetch(PDO::FETCH_ASSOC);
  if(!$row||$row['disabled_at']!==null||(!in_array('*',$access['email']['ids'],true)&&!in_array(strtolower($row['email']),$access['email']['ids'],true)))throw new DomainException('access_denied');
  $url=SiteAvatar::upload((int)$owner['player_id'],$_FILES['avatar']??[],$c['rate_secret']);siteResult(['avatar_url'=>$url,'text'=>'РђРІР°С‚Р°СЂ СЃРѕС…СЂР°РЅС‘РЅ.']);
 }
 if($action==='bootstrap'){require_once __DIR__.'/sitepaymentaccess.php';
  if(isset($_SESSION['social_verified'])&&!isset($_SESSION['site_authenticated'])){
   require_once __DIR__.'/socialidentity.php';$i=SocialIdentity::resolve($_SESSION['social_verified'],$c);$s=$i['sessions']->issue($i['uid'],$i['external'],$now);$_SESSION['social_game_token']=$s['token'];$s['roles']=SocialIdentity::roles($i['platform'],$i['external']);$q=$i['db']->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('site_payment_orders','site_payment_receipts')");$s['payments_enabled']=(new SiteYooKassa($c['payments']??[]))->checkoutReady()&&(int)$q->fetchColumn()===2;require_once __DIR__.'/socialprofiles.php';$s['avatar_url']=SocialProfiles::get($i['platform'],$i['uid'])??($i['platform']==='vk'?($_SESSION['social_verified']['profile']['avatar']??null):null);$s['payments_enabled']=$s['payments_enabled']&&SitePaymentAccess::allowed($i['platform'],$i['external'],$c['payments']??[]);$s['payment_mode']=(new SiteYooKassa($c['payments']??[]))->isTest()?'test':'live';$s['reward_code']=RewardIntent::current($i['platform'],$now);siteResult($s);
  }
  $auth=$_SESSION['site_authenticated']??null;
  if(!is_array($auth)||($auth['expires_at']??0)<=$now)throw new DomainException('login_required');
  $q=$db->prepare('SELECT auth_version FROM site_accounts WHERE player_id=?');$q->execute([$auth['player_id']]);
  if((int)$q->fetchColumn()!==(int)$auth['auth_version'])throw new DomainException('login_required');
  $session=(new SiteSessions($db,$access['email']['ids']))->issue((int)$auth['player_id'],$now,(int)$auth['auth_version']);$_SESSION['game_token']=$session['token'];
  $q=$db->prepare('SELECT email FROM site_accounts WHERE player_id=?');$q->execute([$auth['player_id']]);$session['roles']=SiteRoles::forEmail((string)$q->fetchColumn(),$c);
  $session['payments_enabled']=false;
  if((new SiteYooKassa($c['payments']??[]))->checkoutReady()){$q=$db->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='stalker_site_test' AND table_name IN ('site_payment_orders','site_payment_receipts')");$session['payments_enabled']=(int)$q->fetchColumn()===2;}
  $session['payments_enabled']=$session['payments_enabled']&&SitePaymentAccess::allowed('site',strtolower((string)$db->query('SELECT email FROM site_accounts WHERE player_id='.(int)$auth['player_id'])->fetchColumn()),$c['payments']??[]);$session['avatar_url']=SiteAvatar::url((int)$auth['player_id'],$c['rate_secret']);$session['payment_mode']=(new SiteYooKassa($c['payments']??[]))->isTest()?'test':'live';$session['reward_code']=RewardIntent::current('site',$now);siteResult($session);
 }
 if($action==='logout'){
  if(isset($_SESSION['social_verified'],$_SESSION['social_game_token'])){
   require_once __DIR__.'/socialidentity.php';$i=SocialIdentity::resolve($_SESSION['social_verified'],$c);$lock=NativePlayerSessionLock::acquire($i['db'],$i['database']['database'],$i['uid']);
   try{$q=$i['db']->prepare("UPDATE secure SET token='',req_key='',lifetime=0 WHERE id=? AND token=?");$q->execute([$i['uid'],$_SESSION['social_game_token']]);}finally{NativePlayerSessionLock::release($i['db'],$lock);}
  }
  $token=$_SESSION['game_token']??'';$hash=hash('sha256',$token);
  $q=$db->prepare('SELECT player_id FROM site_sessions WHERE token_hash=?');$q->execute([$hash]);$id=$q->fetchColumn();
  if($id!==false){$sessions=new SiteSessions($db,$access['email']['ids']);$sessions->lock((int)$id);try{$q=$db->prepare('DELETE FROM site_sessions WHERE token_hash=?');$q->execute([$hash]);}finally{$sessions->unlock((int)$id);}}
  $_SESSION=[];session_regenerate_id(true);siteResult(['logged_out'=>true]);
 }
 if(in_array($action,['phone-start','phone-check'],true)){
  $phone=new SitePhoneActions($db,new SitePhoneProvider($c['phone']),$access['email']['ids'],hex2bin($c['phone_hmac_key']),hex2bin($c['phone_encryption_key']));
  $result=$phone->handle($action,$_POST,$now);
  if($result['verified']??false){$_SESSION['site_authenticated']=$_SESSION['site_pending'];$_SESSION['site_authenticated']['expires_at']=$now+3600;unset($_SESSION['site_pending']);$result['redirect']='/game/';}
  siteResult($result);
 }
 $actions=new SiteEmailActions(new SiteAccounts($db,$access['email']['ids']),new SiteMailer($c['mail']));
 $result=$actions->handle($action,$_POST,$now);
 if(($result['phone_step']??false)&&isset($_SESSION['site_pending'])){
  $q=$db->prepare('SELECT player_id FROM site_phone_identities WHERE player_id=?');$q->execute([$_SESSION['site_pending']['player_id']]);
  if($q->fetchColumn()!==false||!SiteSessions::requiresPhone($_SESSION['site_pending']['email'])){$_SESSION['site_authenticated']=$_SESSION['site_pending'];$_SESSION['site_authenticated']['expires_at']=$now+3600;unset($_SESSION['site_pending']);$result=['redirect'=>'/game/','text'=>'Р’С…РѕРґ РІС‹РїРѕР»РЅРµРЅ.'];}
 }
 siteResult($result);
}catch(DomainException $e){
 $code=$e->getMessage();
 $messages=['registration_closed'=>'Р РµРіРёСЃС‚СЂР°С†РёСЏ СЃРµР№С‡Р°СЃ РЅРµРґРѕСЃС‚СѓРїРЅР°.','account_exists'=>'РђРєРєР°СѓРЅС‚ СѓР¶Рµ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅ. Р’РѕР№РґРёС‚Рµ РёР»Рё РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚Рµ РїР°СЂРѕР»СЊ.','invalid_credentials'=>'РќРµРІРµСЂРЅР°СЏ РїРѕС‡С‚Р° РёР»Рё РїР°СЂРѕР»СЊ.','invalid_email_token'=>'РЎСЃС‹Р»РєР° РЅРµРґРµР№СЃС‚РІРёС‚РµР»СЊРЅР° РёР»Рё СЃСЂРѕРє РµС‘ РґРµР№СЃС‚РІРёСЏ РёСЃС‚С‘Рє.','rate_limited'=>'РЎР»РёС€РєРѕРј РјРЅРѕРіРѕ Р·Р°РїСЂРѕСЃРѕРІ. РџРѕРїСЂРѕР±СѓР№С‚Рµ РїРѕР·Р¶Рµ.'];
 siteResult(['error'=>isset($messages[$code])?$code:'request_rejected','text'=>$messages[$code]??'РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ РґРµР№СЃС‚РІРёРµ.'],$code==='rate_limited'?429:400);
}catch(InvalidArgumentException $e){siteResult(['error'=>'invalid_input','text'=>($action??'')==='phone-start'?'Р’РІРµРґРёС‚Рµ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР° СЃ + Рё РєРѕРґРѕРј СЃС‚СЂР°РЅС‹.':'РџСЂРѕРІРµСЂСЊС‚Рµ РїРѕС‡С‚Сѓ Рё РїР°СЂРѕР»СЊ. РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ РѕС‚ 10 РґРѕ 256 СЃРёРјРІРѕР»РѕРІ.'],400);
}catch(Throwable $e){error_log('[site-auth] failed type='.get_class($e));siteResult(['error'=>'temporarily_unavailable','text'=>'РЎРµСЂРІРёСЃ РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРµРЅ. РџРѕРІС‚РѕСЂРёС‚Рµ РїРѕР·Р¶Рµ.'],503);}
