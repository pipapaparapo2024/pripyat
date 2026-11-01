<?php
// Execute the full HTTP entry point and the real Database class; only MySQL I/O is fake.
ini_set('error_log',PHP_OS_FAMILY==='Windows'?'NUL':'/dev/null');
$root=realpath(__DIR__.'/../..');chdir($root.'/server');
$stateFile=$argv[1];$scenario=$argv[2]??'normal';
class Registry extends ArrayObject {function __construct(){parent::__construct(['server'=>'fixture','user'=>'fixture','pass'=>'fixture','db'=>($_POST['platform']??'')==='ok'?'fixture_ok':'fixture_vk','utb'=>'users','api_secret'=>'fixture-secret','api_id'=>54574178]);}}
class SqlResult752 {public $num_rows;function __construct(public $row){$this->num_rows=$row===null?0:1;}function fetch_assoc(){return $this->row;}}
function fetch752($result,$mode){$row=$result->row;$result->row=null;return $row;}
class Sql752 {
 public static $state,$queries=0;public $error='',$insert_id=1;private $snapshot;
 function begin_transaction(){$this->snapshot=self::$state;return true;}function rollback(){self::$state=$this->snapshot;return true;}function commit(){global $scenario;return $scenario!=='commit-failure';}function close(){}function prepare($sql){return new Stmt753($this,$sql);}
 function __construct($server,$user,$pass,$db,$port){if($db!=='fixture_ok')throw new Exception('Callback selected VK database');}
 function real_escape_string($v){return addslashes($v);}
 function query($sql){
  self::$queries++;
  if(str_starts_with($sql,'SELECT')){
   if(str_contains($sql,'FROM secure '))return new SqlResult752(self::$state['identity']??null);
   if(str_contains($sql,'FROM trans ')){preg_match("/tid='([^']*)'/",$sql,$m);return new SqlResult752(self::$state['trans'][$m[1]]??null);}
   preg_match('/WHERE id=([0-9]+)/',$sql,$where);
   return new SqlResult752(isset($where[1]) && strval(self::$state['user']['id'])!==$where[1]?null:self::$state['user']);
  }
  if(preg_match('/^INSERT INTO (users|trans) SET (.*?) ON DUPLICATE KEY UPDATE/s',$sql,$m)){
   preg_match_all("/`([a-z_]+)`='([^']*)'/",$m[2],$fields,PREG_SET_ORDER);$data=[];foreach($fields as $v)$data[$v[1]]=stripslashes($v[2]);
   if($m[1]==='users')self::$state['user']=array_replace(self::$state['user'],$data);
   else self::$state['trans'][$data['tid']]=$data;
   return true;
  }
  throw new Exception('Unexpected SQL');
 }
}
class Stmt753 {
 public $affected_rows=0;private $args=[];
 function __construct(private $db,private $sql){}
 function bind_param($types,&...$args){$this->args=&$args;}
 function execute(){
  global $scenario;$a=$this->args;$sql=$this->sql;
  if(str_starts_with($sql,'INSERT IGNORE')){
   if(isset(Sql752::$state['ledger'][$a[0]])){$this->affected_rows=0;return true;}
   Sql752::$state['ledger'][$a[0]]=['ok_uid'=>$a[1],'product_id'=>$a[2],'amount'=>$a[3]];$this->affected_rows=1;return true;
  }
  if(str_starts_with($sql,'UPDATE users')){
   if($scenario==='credit-failure')return false;
   preg_match('/SET `([a-z_]+)`/',$sql,$m);$f=$m[1];Sql752::$state['user'][$f]=strval(intval(Sql752::$state['user'][$f])+$a[0]);$this->affected_rows=1;return true;
  }
  if(str_starts_with($sql,'UPDATE ok_payment_transactions')){
   if($scenario==='ledger-failure')return false;
   Sql752::$state['ledger'][$a[1]]['game_uid']=$a[0];return true;
  }
  return true;
 }
 function get_result(){
  if(str_contains($this->sql,'FROM ok_payment_transactions'))return new SqlResult752(Sql752::$state['ledger'][$this->args[0]]??null);
  return new SqlResult752(strval($this->args[0])===strval(Sql752::$state['user']['id'])?Sql752::$state['user']:null);
 }
 function close(){}
}
Sql752::$state=json_decode(file_get_contents($stateFile),true);
$params=['vk_app_id'=>'54574178','vk_client'=>'ok','vk_user_id'=>'42','vk_ok_user_id'=>'587256562321','vk_ts'=>'1'];ksort($params);
$params['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($params),'fixture-secret',true)),'+/','-_'),'=');
if($scenario==='mapping-tampered')$params['vk_user_id']='43';
if($scenario!=='mapping-missing')Sql752::$state['identity']=['id'=>'42','vk_params'=>json_encode($params)];
register_shutdown_function(function()use($stateFile){$state=Sql752::$state;unset($state['identity']);file_put_contents($stateFile,json_encode($state));});
$database=file_get_contents($root.'/server/core/models/database.php');
$connectCall=<<<'CALL'
mysqli_connect($registry['server'], $registry['user'], $registry['pass'], $registry['db'], 3306)
CALL;
$database=str_replace([$connectCall,'mysqli_fetch_array('],['new Sql752'.substr($connectCall,strlen('mysqli_connect')),'fetch752('],$database);
eval(str_replace(['<?php','?>'],'',$database));
$_GET=['uid'=>'587256562321','transaction_id'=>'fixture-transaction','product_code'=>$scenario==='legacy'?'3':'ok_item3','amount'=>$scenario==='amount'?'1':'140'];ksort($_GET);$signature='';foreach($_GET as $k=>$v)$signature.=$k.'='.$v;$_GET['sig']=$scenario==='signature'?'invalid':md5($signature.'fixture-secret');
$source=file_get_contents($root.'/server/ok_pay_callback.php');
// Keep the project's error log private and untouched by this fixture.
$source=str_replace(["ini_set('error_log', __DIR__ . '/php_errors.log');",'new mysqli('],['','new Sql752('], $source);
$samplerLine=<<<'LINE'
$registry['db_sampler'] = new SampleLoader;
LINE;
if($scenario==='missing-sampler')$source=str_replace($samplerLine,'', $source);
eval(str_replace(['<?php','?>'],'',$source));
