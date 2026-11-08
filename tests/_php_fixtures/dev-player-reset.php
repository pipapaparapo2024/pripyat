<?php
require __DIR__.'/../../server/core/models/devplayerreset.php';
require __DIR__.'/../../server/core/controllers/users.php';
require __DIR__.'/../../server/core/models/gameops.php';
class ResetResult {function __construct(private array $rows){}function fetch_assoc(){return array_shift($this->rows);}}
class ResetDb {
 public array $rows;private array $snapshot=[];public bool $fail=false;
 function begin_transaction(){$this->snapshot=$this->rows;}
 function commit(){}function rollback(){$this->rows=$this->snapshot;}
 function query($sql){if(str_starts_with($sql,'SHOW COLUMNS'))return new ResetResult(array_map(fn($k)=>['Field'=>$k,'Type'=>in_array($k,['shmot','weapons','name','friends','dice_session'])?'text':'bigint'],array_keys($this->rows[7])));throw new Exception('unexpected_query');}
 function execute_query($sql,$args){
  if(str_starts_with($sql,'SELECT id'))return new ResetResult(isset($this->rows[$args[0]])?[['id'=>$args[0]]]:[]);
  if(str_contains($sql,'information_schema'))return new ResetResult([['n'=>0]]);
  if(str_starts_with($sql,'UPDATE')){if($this->fail)throw new Exception('simulated_failure');preg_match_all('/`([a-z_0-9]+)`=\?/',$sql,$m);$id=array_pop($args);foreach($m[1] as $i=>$key)$this->rows[$id][$key]=$args[$i];return true;}
  throw new Exception('unexpected_statement');
 }
}
$u=(new ReflectionClass(Users::class))->newInstanceWithoutConstructor();$defaults=(new ReflectionMethod(Users::class,'_defaultResetUdata'))->invoke($u);
$db=new ResetDb();$dirty=array_fill_keys(array_keys($defaults),999);$dirty+=array_fill_keys(['id','name','friends','level','weapon_ak','game2048_fragments','stew_spent','pvp_wins','gym_invites_sent'],999);$dirty['name']='identity';$dirty['friends']='friends';$db->rows=[7=>$dirty,8=>$dirty];$other=$db->rows[8];$patch=DevPlayerReset::apply($db,'users',7,$defaults);
foreach(['achievement_stars','ach_score','blue_points','dice_points','roulette_spichki','game2048_fragments','weapon_ak','stew_spent','pvp_wins','gym_invites_sent'] as $key)if((int)$db->rows[7][$key]!==0)throw new Exception('not_reset_'.$key);
if((int)$db->rows[7]['energy']!==50||json_decode($db->rows[7]['weapons'],true)!==[])throw new Exception('bad_reset');
if($other!==$db->rows[8]||$db->rows[7]['name']!=='identity'||$db->rows[7]['friends']!=='friends')throw new Exception('unrelated_data_changed');
$before=$db->rows;$db->fail=true;try{DevPlayerReset::apply($db,'users',7,$defaults);throw new Exception('expected_failure');}catch(Exception $e){if($e->getMessage()!=='simulated_failure')throw $e;}if($before!==$db->rows)throw new Exception('rollback_failed');
foreach([['platform'=>'site','uid'=>382448269],['platform'=>'vk','uid'=>9999]] as $registry)if((new Gameops($registry))->isDeveloper())throw new Exception('developer_escalation');
foreach([['platform'=>'vk','uid'=>382448269],['platform'=>'site','uid'=>7,'roles'=>['developer']]] as $registry)if(!(new Gameops($registry))->isDeveloper())throw new Exception('developer_denied');
$tools=new class {function error($n){return $n;}};if(method_exists(Users::class, 'resetAllPlayers'))throw new Exception('mass_reset_present');
$ordinary=(new ReflectionClass(Users::class))->newInstanceWithoutConstructor();(new ReflectionProperty(Users::class,'registry'))->setValue($ordinary,['platform'=>'site','uid'=>7,'roles'=>[],'tools'=>$tools]);if($ordinary->resetSession()!==null)throw new Exception('ordinary_reset_response');
echo "PASS: complete own reset, identity and neighbour preserved, rollback, developer checks, mass reset denied\n";

// Exercise the controller entry point with the actual connection helper and a fake transport.
class ResetConnection extends ResetDb {
    public static self $last;
    public static array $initialRows;
    public bool $closed = false;
    public $connect_error = null;
    public function __construct($host, $user, $pass, $database, $port) {
        if ($database !== 'fixture' || $port !== 3306) throw new RuntimeException('wrong_database');
        $this->rows = self::$initialRows;
        self::$last = $this;
    }
    public function set_charset($charset) { return $charset === 'utf8mb4'; }
    public function close() { $this->closed = true; }
}
ResetConnection::$initialRows = [7=>$dirty, 8=>$dirty];
class_alias(ResetConnection::class, 'ResetControllerFixture\\mysqli');
class_alias(DevPlayerReset::class, 'ResetControllerFixture\\DevPlayerReset');
$dir = realpath(__DIR__.'/../../server/core/controllers');
$source = str_replace('__DIR__', var_export($dir, true), file_get_contents($dir.'/users.php'));
eval('namespace ResetControllerFixture; use \Throwable;'.substr($source, 5));
$class = new ReflectionClass('ResetControllerFixture\\Users');
$controller = $class->newInstanceWithoutConstructor();
$tools = new class {
    public function output($data) { return $data; }
    public function error($code) { throw new RuntimeException('Controller failed: '.$code); }
};
$class->getProperty('registry')->setValue($controller, [
    'platform'=>'site', 'roles'=>['developer'], 'uid'=>7, 'utb'=>'users', 'db'=>'fixture',
    'server'=>'fixture', 'user'=>'fixture', 'pass'=>'', 'tools'=>$tools,
    'user_params'=>['full_reset'=>true, 'uid'=>8],
]);
$result = $controller->resetSession();
$link = ResetConnection::$last;
if (($result['ok']??null)!==1 || (int)$link->rows[7]['ach_score']!==0 || $link->rows[8]!==$dirty || !$link->closed) {
    throw new RuntimeException('Authenticated reset did not complete for the current account');
}
echo "PASS: full reset through Users::resetSession with the controller connection helper\n";
