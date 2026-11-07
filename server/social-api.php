<?php
ini_set('display_errors','0');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
require_once __DIR__.'/../app/socialidentity.php';require_once __DIR__.'/core/models/telegramgateway.php';
require_once __DIR__.'/../app/sitefriends.php';
require_once __DIR__.'/../app/sitepayments.php';require_once __DIR__.'/../app/socialoauth.php';
require_once __DIR__.'/../app/socialprofiles.php';
$identity=null;$auth=null;$key=null;
try{
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST')throw new DomainException('post_required');
 session_name('pripyat_website_test');session_start(['cookie_secure'=>true,'cookie_httponly'=>true,'cookie_samesite'=>'Lax','cookie_path'=>'/','use_strict_mode'=>true]);$login=$_SESSION['social_verified']??[];session_write_close();
 $c=json_decode(file_get_contents(__DIR__.'/../private/site-runtime.json'),true,32,JSON_THROW_ON_ERROR);$identity=SocialIdentity::resolve($login,$c);
 $method=$_POST['method']??'';$raw=$_POST['payload']??'';
 if(!is_string($method)||!is_string($raw)||strlen($raw)>1048576||(!TelegramGateway::allowed($method)&&!in_array($method,['sitepayments.create','sitepayments.status','sitefriends.list','siteprofiles.get','siteavatars.get'],true))||str_starts_with($method,'telegram'))throw new DomainException('method_forbidden');
 $params=json_decode($raw,true,64,JSON_THROW_ON_ERROR);if(!is_array($params))throw new DomainException('invalid_payload');
 $auth=$identity['sessions']->authenticate($identity['uid'],$identity['external'],(string)($_POST['token']??''),(string)($_POST['req_key']??''),time());$key=$auth['req_key'];$uid=$auth['uid'];$pdo=$identity['db'];
 $roles=SocialIdentity::roles($identity['platform'],$identity['external']);
 SocialProfiles::put($identity['platform'],$uid,$login['profile']['avatar']??null);
 if(TelegramGateway::requiresDeveloper($method)&&!in_array('developer',$roles,true))throw new DomainException('developer_required');
 if(str_starts_with($method,'sitepayments.')){
  require_once __DIR__.'/../app/sitepaymentaccess.php';if($method==='sitepayments.create'&&!SitePaymentAccess::allowed($identity['platform'],$identity['external'],$c['payments']??[]))throw new DomainException('test_payments_forbidden');
  $payments=new SitePayments($pdo,new SiteYooKassa($c['payments']??[]),$identity['platform']);
  if($method==='sitepayments.create'){$q=$pdo->prepare('SELECT COUNT(*) FROM site_payment_orders WHERE player_id=? AND created_at>?');$q->execute([$uid,time()-3600]);if((int)$q->fetchColumn()>=10)throw new DomainException('rate_limited');$result=$payments->create($uid,(int)($params['product_id']??-1),(string)($params['intent']??''),time());}
  else{$q=$pdo->prepare('SELECT provider_payment_id FROM site_payment_orders WHERE id=? AND player_id=?');$q->execute([(string)($params['order_id']??''),$uid]);$id=$q->fetchColumn();if(!$id)throw new DomainException('unknown_payment');[$settlementProvider]=SiteYooKassa::lookup($c,$id);$result=['status'=>(new SitePayments($pdo,$settlementProvider,$identity['platform']))->settle($id,time())];}
  echo json_encode($result+['req_key'=>$key]);exit;
 }
 if($method==='sitefriends.list'){
  $q=$pdo->prepare('SELECT friends FROM users WHERE id=?');$q->execute([$uid]);$ids=array_values(array_filter(array_map('intval',explode(',',(string)$q->fetchColumn())),fn($v)=>$v>0&&$v!==$uid));$players=[];
  if($ids){$q=$pdo->prepare('SELECT id,nick FROM users WHERE id IN ('.implode(',',array_fill(0,count($ids),'?')).')');$q->execute($ids);$players=$q->fetchAll(PDO::FETCH_ASSOC);}
  echo json_encode(['players'=>$players,'total'=>count($players),'req_key'=>$key]);exit;
 }
 if($method==='siteprofiles.get'||$method==='siteavatars.get'){
  $ids=$method==='siteavatars.get'?[(string)($params['player_id']??$uid)]:explode(',',(string)($params['ids']??$uid));if(count($ids)>100)throw new DomainException('invalid_ids');foreach($ids as $id)if(!preg_match('/^[1-9][0-9]{0,9}$/D',$id))throw new DomainException('invalid_id');
  $q=$pdo->prepare('SELECT id,nick FROM users WHERE id IN ('.implode(',',array_fill(0,count($ids),'?')).')');$q->execute($ids);$players=[];
  $rows=$q->fetchAll(PDO::FETCH_ASSOC);
  if($identity['platform']==='vk'&&!empty($login['access_token'])){
   try{$remote=SocialOAuth::http('https://api.vk.ru/method/users.get',['user_ids'=>implode(',',array_column($rows,'id')),'fields'=>'photo_50,photo_100','access_token'=>$login['access_token'],'v'=>'5.199']);foreach($remote['response']??[] as $p)if(in_array((string)($p['id']??''),array_map('strval',array_column($rows,'id')),true))SocialProfiles::put('vk',(int)$p['id'],$p['photo_100']??$p['photo_50']??null);}catch(Throwable $e){}
  }
  foreach($rows as $p){$avatar=SocialProfiles::get($identity['platform'],(int)$p['id']);$players[]=['id'=>(int)$p['id'],'first_name'=>$p['nick']?:'Сталкер','last_name'=>'','photo_50'=>$avatar??'/game/images/2048%20аватар%20заглушка.png'];}
  echo json_encode(['players'=>$players,'photo_url'=>$players[0]['photo_50']??null,'req_key'=>$key]);exit;
 }
 if($method==='users.get')$params['users']='skip';
 if(str_starts_with($method,'top.')&&($params['scope']??'')==='friends'){$q=$pdo->prepare('SELECT friends FROM users WHERE id=?');$q->execute([$uid]);$params['friends']=(string)$q->fetchColumn();}
 if($method==='users.save'&&isset($params['udata_json'])){$data=json_decode($params['udata_json'],true,64,JSON_THROW_ON_ERROR);if(!is_array($data))throw new DomainException('invalid_save');unset($data['id'],$data['friends'],$data['friends_since'],$data['friends_scope_granted'],$data['energy'],$data['energy_time']);$params['udata_json']=json_encode($data,JSON_THROW_ON_ERROR);}
 chdir(__DIR__);spl_autoload_register(function($class){$p=__DIR__.'/core/models/'.strtolower($class).'.php';if(is_file($p))require_once $p;});$d=$identity['database'];
 $registry=new ArrayObject(['classes'=>TelegramGateway::CLASSES,'server'=>'127.0.0.1','user'=>$d['user'],'pass'=>$d['password'],'db'=>$d['database'],'utb'=>'users','uid'=>$uid,'ref_uid'=>1,'user_params'=>$params,'req_key'=>$key,'api_id'=>0,'api_secret'=>'','api_service'=>'','balabols'=>[],'names'=>[],'platform'=>$identity['platform'],'roles'=>$roles]);$GLOBALS['registry']=$registry;
 $registry['tools']=new Tools($registry);$registry['json']=new Jsonloader;$registry['db_sampler']=new SampleLoader;$registry['udb']=new Database($registry);$router=new Router($registry);$router->setPath(__DIR__.'/core/controllers');$registry['router']=$router;
 [$class,$action]=explode('.',$method,2);ob_start();if($router->exec(ucfirst($class),$action)===false)throw new DomainException('method_forbidden');$out=ob_get_clean();json_decode($out,true,64,JSON_THROW_ON_ERROR);echo $out;
}catch(Throwable $e){if(ob_get_level())ob_end_clean();error_log('[site-social-api] failed type='.get_class($e).' method='.(preg_match('/^[a-z]+\.[A-Za-z]+$/D',$method??'')?$method:'invalid').' reason='.(in_array($e->getMessage(),['stale_session','invalid_session','method_forbidden','invalid_save','invalid_payload','native_launch_required','closed_test_access_denied'],true)?$e->getMessage():'other'));echo json_encode(['status'=>'error','code'=>5,'req_key'=>$key,'text'=>'Не удалось подтвердить сессию. Войдите заново.']);}
finally{if($identity&&$auth)NativePlayerSessionLock::release($identity['db'],$auth['lock']);}
