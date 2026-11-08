<?php
namespace DiceRewardTest;
class RaznaryadkaProgress {static function report(...$args){}}
class mysqli {public $connect_error=false;function __construct(...$a){}function set_charset(...$a){}function real_escape_string($s){return $s;}function query(...$a){return true;}function close(){}}
require __DIR__.'/../../server/core/models/gameops.php';
class Gameops extends \Gameops {
 public $user,$result,$error;
 function __construct($r){}
 function loadUser($fields=['*']){return $this->user;}
 function saveUser($u){$this->user=$u;return true;}
 function catalog($name){return json_decode(file_get_contents(__DIR__.'/../../server/json/'.$name.'.json'),true);}
 function ok($extra=[]){$this->result=$extra;return $extra;}
 function fail($code){$this->error=$code;return false;}
 function report(...$args){}
}
$source=file_get_contents(__DIR__.'/../../server/core/controllers/dice.php');
// Resolve the connection name to the local lock stub; all reward code remains unchanged.
$source=str_replace('__DIR__',var_export(realpath(__DIR__.'/../../server/core/controllers'),true),$source);
eval('namespace DiceRewardTest;'.substr($source,5));
foreach([0,1] as $flag){
 $ops=new Gameops([]);$ops->user=['id'=>987654,'dev_force_drops'=>$flag,'dice_session'=>json_encode(['active'=>['rolls'=>[6,6,6,6]]]),'shmot'=>'[]','max_energy'=>50];
 $dice=(new \ReflectionClass(Dice::class))->newInstanceWithoutConstructor();
 (new \ReflectionProperty(Dice::class,'ops'))->setValue($dice,$ops);
 (new \ReflectionProperty(Dice::class,'registry'))->setValue($dice,['uid'=>987654,'server'=>'test','user'=>'test','pass'=>'','db'=>'test']);
 $dice->resolve();$reward=$ops->result;
 if(count($reward['shmotGranted'])!==1||$reward['rewards'][0]['amt']!==1)throw new \RuntimeException('Four sixes must grant exactly one item');
 $state=json_decode($ops->user['shmot'],true);if(count(array_filter($state,fn($r)=>!empty($r['owned'])))!==1)throw new \RuntimeException('Multiple owned items');
 $saved=$ops->user;$dice->resolve();if($ops->error!==68||$saved!==$ops->user)throw new \RuntimeException('Repeated resolve issued another item');
}
echo "PASS: one item for four sixes, both personal flag states, no repeated reward\n";
