<?php
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store, private');
require_once __DIR__.'/../app/sitesessions.php';
require_once __DIR__.'/core/models/telegramgateway.php';
require_once __DIR__.'/../app/sitefriends.php';require_once __DIR__.'/core/models/gamefriendrequests.php';
require_once __DIR__.'/../app/siteavatar.php';
require_once __DIR__.'/../app/siteroles.php';
require_once __DIR__.'/../app/sitepayments.php';
$key=null;$sessions=null;$uid=null;
try{
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST')throw new InvalidArgumentException('post_required');
 $c=json_decode(file_get_contents(__DIR__.'/../private/site-runtime.json'),true,32,JSON_THROW_ON_ERROR);
 $d=$c['database'];$a=$c['access'];
 if($d['database']!=='stalker_site_test'||$d['host']!=='127.0.0.1'||($a['enabled']??false)!==true||!in_array($a['email']['mode']??'',['allowlist','open'],true))throw new RuntimeException('disabled');
 $method=$_POST['method']??'';$raw=$_POST['payload']??'';
 if(!is_string($method)||(!TelegramGateway::allowed($method)&&!in_array($method,['sitepayments.create','sitepayments.status','siteprofiles.get','siteavatars.get','sitefriends.list','sitefriends.requests','sitefriends.send','sitefriends.accept','sitefriends.decline','sitefriends.remove'],true))||str_starts_with($method,'telegram')||!is_string($raw)||strlen($raw)>1048576)throw new InvalidArgumentException('method_forbidden');
 $params=json_decode($raw,true,64,JSON_THROW_ON_ERROR);if(!is_array($params))throw new InvalidArgumentException('invalid_payload');
 $pdo=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_site_test;charset=utf8mb4',$d['user'],$d['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
 if(($a['email']['mode']??'')==='open')$a['email']['ids']=['*'];
 $sessions=new SiteSessions($pdo,$a['email']['ids']);$auth=$sessions->authenticate((string)($_POST['token']??''),(string)($_POST['req_key']??''),time());$uid=$auth['uid'];$key=$auth['req_key'];
 $q=$pdo->prepare('SELECT email FROM site_accounts WHERE player_id=?');$q->execute([$uid]);$roles=SiteRoles::forEmail((string)$q->fetchColumn(),$c);
 if(TelegramGateway::requiresDeveloper($method)&&!in_array('developer',$roles,true)){echo json_encode(['status'=>'error','code'=>403,'req_key'=>$key,'text'=>'Нет доступа разработчика.']);exit;}
 if(str_starts_with($method,'sitepayments.')){
  require_once __DIR__.'/../app/sitepaymentaccess.php';$payer=$pdo->prepare('SELECT email FROM site_accounts WHERE player_id=?');$payer->execute([$uid]);if($method==='sitepayments.create'&&!SitePaymentAccess::allowed('site',strtolower((string)$payer->fetchColumn()),$c['payments']??[]))throw new DomainException('test_payments_forbidden');
  $payments=new SitePayments($pdo,new SiteYooKassa($c['payments']??[]));
  if($method==='sitepayments.create'){
   $q=$pdo->prepare('SELECT COUNT(*) FROM site_payment_orders WHERE player_id=? AND created_at>?');$q->execute([$uid,time()-3600]);if((int)$q->fetchColumn()>=10)throw new DomainException('rate_limited');
   $result=$payments->create($uid,(int)($params['product_id']??-1),(string)($params['intent']??''),time());
  }else{
   $q=$pdo->prepare('SELECT provider_payment_id FROM site_payment_orders WHERE id=? AND player_id=?');$q->execute([(string)($params['order_id']??''),$uid]);$id=$q->fetchColumn();if(!$id)throw new DomainException('unknown_payment');[$settlementProvider]=SiteYooKassa::lookup($c,$id);$result=['status'=>(new SitePayments($pdo,$settlementProvider,'site'))->settle($id,time())];
  }
  echo json_encode($result+['req_key'=>$key],JSON_THROW_ON_ERROR);exit;
 }
 if($method==='siteprofiles.get'){
  $rawIds=$params['ids']??'';if(!is_string($rawIds)||strlen($rawIds)>1200)throw new InvalidArgumentException('invalid_players');
  $ids=explode(',',$rawIds);if(count($ids)>100)throw new InvalidArgumentException('too_many_players');
  foreach($ids as $id)if(!preg_match('/^[1-9][0-9]{0,9}$/D',$id)||(int)$id>2147483647)throw new InvalidArgumentException('invalid_player');
  $q=$pdo->prepare('SELECT id,nick FROM users WHERE id IN ('.implode(',',array_fill(0,count($ids),'?')).')');$q->execute($ids);$players=[];
  foreach($q->fetchAll(PDO::FETCH_ASSOC) as $row)$players[]=['id'=>(int)$row['id'],'first_name'=>$row['nick']?:'Сталкер','last_name'=>'','photo_50'=>SiteAvatar::url((int)$row['id'],$c['rate_secret'])];
  echo json_encode(['players'=>$players,'req_key'=>$key],JSON_THROW_ON_ERROR);exit;
 }
 if($method==='siteavatars.get'){echo json_encode(['photo_url'=>SiteAvatar::url((int)($params['player_id']??$uid),$c['rate_secret']),'req_key'=>$key]);exit;}
 if(str_starts_with($method,'sitefriends.')){
  $requests=new GameFriendRequests($pdo);$action=substr($method,12);
  if(in_array($action,['requests','send','accept','decline'],true)){$result=$action==='requests'?$requests->incoming($uid):$requests->act($uid,(int)($params['id']??0),$action);echo json_encode($result+['req_key'=>$key]);exit;}
  $friends=new SiteFriends($pdo,$c['rate_secret']);
  $result=match($method){'sitefriends.invite'=>['link'=>$friends->invite($uid)],'sitefriends.remove'=>['removed'=>$friends->remove($uid,(int)($params['id']??0))],default=>$friends->list($uid)};
  echo json_encode($result+['req_key'=>$key,'current_time'=>time()],JSON_THROW_ON_ERROR);exit;
 }
 if($method==='users.get')$params['users']='skip';
 if(str_starts_with($method,'top.')&&($params['scope']??'')==='friends'){
  $q=$pdo->prepare('SELECT friends FROM users WHERE id=?');$q->execute([$uid]);
  $params['friends']=(string)$q->fetchColumn();
 }
 if($method==='users.save'&&isset($params['udata_json'])){
  $data=json_decode($params['udata_json'],true,64,JSON_THROW_ON_ERROR);if(!is_array($data))throw new InvalidArgumentException('invalid_save');
  unset($data['id'],$data['friends'],$data['friends_since'],$data['friends_scope_granted'],$data['energy'],$data['energy_time']);$params['udata_json']=json_encode($data,JSON_THROW_ON_ERROR);
 }
 chdir(__DIR__);spl_autoload_register(function($class){$file=__DIR__.'/core/models/'.strtolower($class).'.php';if(is_file($file))require_once $file;});
 $registry=new ArrayObject(['classes'=>TelegramGateway::CLASSES,'server'=>'127.0.0.1','user'=>$d['user'],'pass'=>$d['password'],'db'=>'stalker_site_test','utb'=>'users','uid'=>$uid,'ref_uid'=>1,'user_params'=>$params,'req_key'=>$key,'api_id'=>0,'api_secret'=>'','api_service'=>'','balabols'=>[],'names'=>[],'platform'=>'site','roles'=>$roles]);
 $GLOBALS['registry']=$registry;$registry['tools']=new Tools($registry);$registry['json']=new Jsonloader;$registry['db_sampler']=new SampleLoader;$registry['udb']=new SiteDatabase($registry);
 $router=new Router($registry);$router->setPath(__DIR__.'/core/controllers');$registry['router']=$router;
 [$class,$action]=explode('.',$method,2);ob_start();
 if($router->exec(ucfirst($class),$action)===false)throw new InvalidArgumentException('method_forbidden');
 $out=ob_get_clean();json_decode($out,true,64,JSON_THROW_ON_ERROR);echo $out;
}catch(DomainException $e){if(ob_get_level())ob_end_clean();echo json_encode(['status'=>'error','code'=>5,'req_key'=>$key,'text'=>'Сессия устарела. Войдите заново.']);
}catch(Throwable $e){if(ob_get_level())ob_end_clean();error_log('[site-api] failed type='.get_class($e).' method='.(preg_match('/^[a-z]+\.[A-Za-z]+$/D',$method??'')?$method:'invalid').' reason='.(in_array($e->getMessage(),['stale_session','invalid_session','method_forbidden','invalid_save','invalid_payload','native_launch_required','closed_test_access_denied'],true)?$e->getMessage():'other'));echo json_encode(['status'=>'error','code'=>99,'req_key'=>$key,'text'=>'Не удалось выполнить действие.']);
}finally{if($sessions&&$uid!==null)$sessions->unlock($uid);}
