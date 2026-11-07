<?php
ini_set('display_errors','0');header('Cache-Control: no-store, private');header('Referrer-Policy: no-referrer');header('X-Content-Type-Options: nosniff');
require_once __DIR__.'/sociallinkstore.php';require_once __DIR__.'/socialidentity.php';require_once __DIR__.'/siteratelimit.php';
function linkJson(array $data,int $status=200): never {http_response_code($status);header('Content-Type: application/json; charset=utf-8');echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
try{
 $config=json_decode(file_get_contents(__DIR__.'/../private/site-runtime.json'),true,32,JSON_THROW_ON_ERROR);$store=new SocialLinkStore(__DIR__.'/../private/social-links');$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);$now=time();$method=$_SERVER['REQUEST_METHOD']??'';
 if($path==='/auth/social/native'){
  if(($_SERVER['HTTP_ORIGIN']??'')!=='https://pripyat-game.ru')linkJson(['error'=>'origin_rejected'],403);
  header('Access-Control-Allow-Origin: https://pripyat-game.ru');header('Vary: Origin');
  if($method==='OPTIONS'){header('Access-Control-Allow-Methods: POST');header('Access-Control-Allow-Headers: Content-Type');http_response_code(204);exit;}
  if($method!=='POST'||(int)($_SERVER['CONTENT_LENGTH']??0)>16384)linkJson(['error'=>'invalid_request'],400);
  (new SiteRateLimit('/var/lib/pripyat-site-test/limits',$config['rate_secret']))->consume('native-link',$_SERVER['REMOTE_ADDR']??'',30,900,$now);
  $input=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);$launch=$input['launch']??[];if(!is_array($launch))throw new DomainException('invalid_launch');
  $world=($launch['vk_client']??'')==='ok'?'ok':'vk';$uid=(string)($launch['vk_user_id']??'');NativeProdBoundary::resolve($launch,$world,$uid,$config['native'],$now,true);
  $external=$world==='ok'?(string)($launch['vk_ok_user_id']??''):$uid;$d=NativeProdBoundary::database($config['native'],$world);
  $db=new PDO('mysql:host=127.0.0.1;port=3306;dbname='.$d['database'].';charset=utf8mb4',$d['user'],$d['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
  $q=$db->prepare('SELECT s.vk_params FROM secure s INNER JOIN users u ON u.id=s.id WHERE s.id=?');$q->execute([$uid]);$raw=$q->fetchColumn();if(!is_string($raw))throw new DomainException('native_character_missing');
  $saved=json_decode($raw,true,32,JSON_THROW_ON_ERROR);NativeProdBoundary::resolve($saved,$world,$uid,$config['native'],$now,false);
  if(($world==='ok'?(string)($saved['vk_ok_user_id']??''):$uid)!==$external)throw new DomainException('native_identity_mismatch');
  $code=$input['code']??'';if(!is_string($code))throw new DomainException('invalid_link_code');$preview=$store->preview($code,$world,$now);
  if(($input['approve']??false)===true)$store->approve($code,$world,(int)$uid,$external,$now);
  linkJson($preview+['approved'=>($input['approve']??false)===true]);
 }
 session_name('pripyat_website_test');session_start(['cookie_secure'=>true,'cookie_httponly'=>true,'cookie_samesite'=>'Lax','cookie_path'=>'/','use_strict_mode'=>true]);
 $identity=$_SESSION['social_verified']??null;if(!is_array($identity)||($identity['expires_at']??0)<=$now)throw new DomainException('login_required');
 $ready=false;try{$existing=SocialIdentity::resolve($identity,$config);$existing['sessions']->validateCharacter($existing['uid'],$existing['external']);$ready=true;}catch(DomainException $e){if(!in_array($e->getMessage(),['native_identity_missing','social_link_required','native_mapping_missing','native_character_missing','native_launch_required'],true))throw $e;}
 if($ready){unset($_SESSION['social_needs_link']);header('Location: /game/',true,303);exit;}
 $simple=$identity['platform']==='vk'||isset($config['social_links']['ok'][$identity['provider_id']]);
 if($simple){
  header('Content-Type: text/html; charset=utf-8');$ok=$identity['platform']==='ok';$url=$ok?'https://ok.ru/game/512005669202':'https://vk.com/app54574178';
  echo '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><title>Подключите персонажа — Припять</title><main><h1>Сначала откройте игру в соцсети</h1><p>Нам пока не удалось подтвердить вашего персонажа. Откройте «Припять» внутри '.($ok?'Одноклассников':'ВКонтакте').', дождитесь загрузки и вернитесь сюда. Новый персонаж на сайте не создаётся.</p><p><a target="_blank" rel="noopener noreferrer" href="'.$url.'">Открыть игру в соцсети ↗</a></p><p><a href="/auth/'.($ok?'ok':'vk').'/start">Я открыл игру — повторить вход</a></p><a href="/">На главную</a></main></html>';exit;
 }
 if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
 if($method==='POST'){
  if(($_SERVER['HTTP_ORIGIN']??'')!=='https://pripyat-game-site.ru'||!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['csrf'],$_POST['csrf']))linkJson(['error'=>'csrf_rejected'],403);
  $code=$_SESSION['social_link_code']??'';$store->finish($code,$identity,$now);unset($_SESSION['social_link_code'],$_SESSION['social_needs_link']);SocialIdentity::resolve($identity,$config);header('Location: /game/',true,303);exit;
 }
 if($method!=='GET')linkJson(['error'=>'method_rejected'],405);
 if(($_SESSION['social_link_expires']??0)<=$now){$_SESSION['social_link_code']=$store->start($identity,$now);$_SESSION['social_link_expires']=$now+600;}
 $e=fn($v)=>htmlspecialchars($v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');$world=$identity['platform'];$url=$world==='ok'?'https://ok.ru/game/512005669202':'https://vk.com/app54574178';
 header('Content-Type: text/html; charset=utf-8');echo '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><title>Подключение персонажа — Припять</title><main><h1>Подключите персонажа</h1><p>Откройте игру в '.($world==='ok'?'Одноклассниках':'ВКонтакте').'. Дождитесь загрузки и нажмите «Подключить сайт» в правом нижнем углу. Введите этот одноразовый код и подтвердите подключение.</p><p><code style="overflow-wrap:anywhere;user-select:all">'.$e($_SESSION['social_link_code']).'</code></p><p>Код действует 10 минут. Не передавайте его другим людям. Подключайте только собственного персонажа.</p><p><a target="_blank" rel="noopener noreferrer" href="'.$url.'">Открыть игру в соцсети ↗</a></p><form method="post"><input type="hidden" name="csrf" value="'.$e($_SESSION['csrf']).'"><button>Я подтвердил подключение — продолжить</button></form><p>Персонаж на сайте не создаётся. После подключения здесь будет тот же прогресс, что и в соцсети.</p><a href="/">На главную</a></main></html>';
}catch(Throwable $e){http_response_code(400);header('Content-Type: text/html; charset=utf-8');echo '<!doctype html><html lang="ru"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><main><h1>Подключение не завершено</h1><p>Подтвердите код внутри игры своей соцсети. Если код истёк, начните вход заново. Персонажи не изменены.</p><a href="/auth/social/link">Вернуться к подключению</a> · <a href="/">На главную</a></main></html>';}
