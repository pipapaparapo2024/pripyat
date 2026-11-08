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
$tools=new class {function error($n){return $n;}};(new ReflectionProperty(Users::class,'registry'))->setValue($u,['tools'=>$tools]);if($u->resetAllPlayers()!==403)throw new Exception('mass_reset_allowed');
$ordinary=(new ReflectionClass(Users::class))->newInstanceWithoutConstructor();(new ReflectionProperty(Users::class,'registry'))->setValue($ordinary,['platform'=>'site','uid'=>7,'roles'=>[],'tools'=>$tools]);if($ordinary->resetSession()!==null)throw new Exception('ordinary_reset_response');
echo "PASS: complete own reset, identity and neighbour preserved, rollback, developer checks, mass reset denied\n";
