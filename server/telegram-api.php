<?php
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
require_once __DIR__.'/core/models/telegramauth.php';
require_once __DIR__.'/core/models/telegramgateway.php';
require_once __DIR__.'/core/models/telegramfriends.php';
require_once __DIR__.'/core/models/telegramstars.php';
require_once __DIR__.'/core/models/telegrambotclient.php';
require_once __DIR__.'/core/models/telegramaccess.php';
require_once __DIR__.'/core/models/telegramavatars.php';
require_once __DIR__.'/core/models/telegramplayerlock.php';
$requestKey=null;
try {
    if (($_SERVER['REQUEST_METHOD']??'') !== 'POST') {http_response_code(405);throw new InvalidArgumentException('post_required');}
    $path=getenv('PRIPYAT_TELEGRAM_CONFIG');
    if (!$path || !is_file($path)) throw new RuntimeException('disabled');
    $config=require $path;TelegramAuth::validateConfig($config);
    $method=$_POST['method']??'';
    if (!is_string($method) || !TelegramGateway::allowed($method)) {http_response_code(403);throw new InvalidArgumentException('method_forbidden');}
    $token=$_POST['token']??'';$key=$_POST['req_key']??'';$raw=$_POST['payload']??'';
    if (!is_string($token)||!is_string($key)||!is_string($raw)||strlen($raw)>1048576)throw new InvalidArgumentException('invalid_request');
    $params=json_decode($raw,true,64,JSON_THROW_ON_ERROR);
    if (!is_array($params))throw new InvalidArgumentException('invalid_request');
    $pdo=new PDO('mysql:host=127.0.0.1;port=3306;dbname=stalker_telegram_test;charset=utf8mb4',$config['db_user'],$config['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
    // Lock before authentication, then re-read the session: a newer login can revoke it
    // while this request waits. Hold through all legacy controller writes.
    $playerLock=TelegramPlayerLock::forSession($pdo,$token);
    $auth=TelegramGateway::authenticate($pdo,$token,$key,time());
    if(isset($auth['code'])){
        echo json_encode(['status'=>'error','code'=>$auth['code'],'req_key'=>$auth['req_key']??null,'text'=>'Сессия устарела. Откройте игру заново.']);exit;
    }
    $requestKey=$auth['req_key'];$uid=$auth['uid'];
    $externalQuery=$pdo->prepare('SELECT telegram_id FROM telegram_identities WHERE player_id=?');$externalQuery->execute([$uid]);$external=(string)$externalQuery->fetchColumn();
    if(!(new TelegramAccess)->allowed($external)){
        http_response_code(403);echo json_encode(['status'=>'error','code'=>403,'access_denied'=>true,'req_key'=>$requestKey,'text'=>'Доступ к игре отозван.']);exit;
    }
    if($method==='users.devGetLogs'&&$external!==TelegramAccess::OWNER){http_response_code(403);echo json_encode(['status'=>'error','code'=>403,'req_key'=>$requestKey]);exit;}
    if($method==='telegramavatars.get'){
        $target=$params['player_id']??'';
        if(!preg_match('/^[1-9][0-9]{0,9}$/D',(string)$target)||(int)$target>2147483647)throw new InvalidArgumentException('invalid_avatar_player');
        $externalQuery->execute([(int)$target]);$photoExternal=$externalQuery->fetchColumn();$url=null;
        if($photoExternal!==false&&(new TelegramAccess)->allowed((string)$photoExternal))$url=(new TelegramAvatars(new TelegramBotClient($config['bot_token'],$config['bot_api_environment']??'production'),$config['bot_token']))->get((string)$photoExternal,time());
        echo json_encode(['photo_url'=>$url,'req_key'=>$requestKey]);exit;
    }
    $roleQuery=$pdo->prepare('SELECT role FROM telegram_roles WHERE player_id=?');$roleQuery->execute([$uid]);$roles=$roleQuery->fetchAll(PDO::FETCH_COLUMN);
    if(TelegramGateway::requiresDeveloper($method)&&!in_array('developer',$roles,true)){
        http_response_code(403);echo json_encode(['status'=>'error','code'=>403,'req_key'=>$requestKey,'text'=>'Нет доступа разработчика.']);exit;
    }
    if(isset($_POST['uid']) && (string)$_POST['uid']!==(string)$uid)throw new InvalidArgumentException('uid_mismatch');
    if(str_starts_with($method,'telegramstars.')){
        if(($config['stars_enabled']??false)!==true)throw new InvalidArgumentException('stars_disabled');
        $catalog=json_decode(file_get_contents(__DIR__.'/json/telegram_stars.json'),true,32,JSON_THROW_ON_ERROR);
        $stars=new TelegramStars($pdo,$catalog,new TelegramBotClient($config['bot_token'],$config['bot_api_environment']??'production'));
        $result=$method==='telegramstars.create'?$stars->create($uid,(int)($params['product_id']??-1),time()):$stars->status($uid,(string)($params['order_id']??''));
        echo json_encode($result+['req_key'=>$requestKey,'current_time'=>time()],JSON_THROW_ON_ERROR);exit;
    }
    $friends=new TelegramFriends($pdo);require_once __DIR__.'/core/models/gamefriendrequests.php';
    if(in_array($method,['telegramfriends.requests','telegramfriends.send','telegramfriends.accept','telegramfriends.decline'],true)){$requests=new GameFriendRequests($pdo,true);$action=substr($method,16);$result=$action==='requests'?$requests->incoming($uid):$requests->act($uid,(int)($params['id']??0),$action);echo json_encode($result+['req_key'=>$requestKey]);exit;}
    if(str_starts_with($method,'telegramfriends.')){
        if($method==='telegramfriends.invite')$result=['link'=>$friends->invite($uid,time())];
        elseif($method==='telegramfriends.remove')$result=['removed'=>$friends->remove($uid,(int)($params['id']??0))];
        else $result=$friends->list($uid,(string)($params['scope']??'friends'),(int)($params['page']??0));
        echo json_encode($result+['req_key'=>$requestKey,'current_time'=>time()],JSON_THROW_ON_ERROR);exit;
    }
    $friends->sync($uid);
    $params=TelegramGateway::parameters($method,$params,$uid,$pdo);
    chdir(__DIR__);
    spl_autoload_register(function($class){$file=__DIR__.'/core/models/'.strtolower($class).'.php';if(is_file($file))require_once $file;});
    // ArrayObject is intentionally not legacy Registry: no request-selected database.
    $registry=new ArrayObject(['classes'=>TelegramGateway::CLASSES,'server'=>'127.0.0.1','user'=>$config['db_user'],'pass'=>$config['db_password'],'db'=>'stalker_telegram_test','utb'=>'users','uid'=>$uid,'ref_uid'=>1,'user_params'=>$params,'req_key'=>$requestKey,'api_id'=>0,'api_secret'=>'','api_service'=>'','balabols'=>[],'names'=>[]]);
    $GLOBALS['registry']=$registry;
    $registry['platform']='telegram';$registry['roles']=$roles;
    $registry['tools']=new Tools($registry);$registry['json']=new Jsonloader;$registry['db_sampler']=new SampleLoader;
    $registry['udb']=new TelegramDatabase($registry);
    $router=new Router($registry);$router->setPath(__DIR__.'/core/controllers');$registry['router']=$router;
    [$class,$action]=explode('.',$method,2);
    ob_start();
    if($router->exec(ucfirst($class),$action)===false){ob_end_clean();http_response_code(403);throw new InvalidArgumentException('method_forbidden');}
    $out=ob_get_clean();
    json_decode($out,true,64,JSON_THROW_ON_ERROR);
    echo $out;
}catch(InvalidArgumentException|JsonException $e){
    if(ob_get_level())ob_end_clean();
    echo json_encode(['status'=>'error','code'=>54,'req_key'=>$requestKey,'text'=>'Некорректный запрос Telegram.']);
}catch(Throwable $e){
    if(ob_get_level())ob_end_clean();
    // Never return/log session tokens or database credentials.
    error_log('[telegram-api] request_failed type='.get_class($e));
    echo json_encode(['status'=>'error','code'=>99,'req_key'=>$requestKey,'text'=>'Не удалось выполнить действие. Попробуйте ещё раз.']);
}
