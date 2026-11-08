<?php
namespace RouletteIsolation;
require __DIR__.'/../../server/core/models/gameops.php';
class Gameops extends \Gameops {
 public array $user;public $error=null,$result=null;function loadUser($fields=['*']){return $this->user;}function saveUser($u){$this->user=$u;return true;}function fail($n){$this->error=$n;return false;}function ok($data=[]){$this->result=$data;return $data;}
}
$src=file_get_contents(__DIR__.'/../../server/core/controllers/roulette.php');$src=str_replace('__DIR__',var_export(realpath(__DIR__.'/../../server/core/controllers'),true),$src);eval('namespace RouletteIsolation;'.substr($src,5));
foreach([false,true] as $dev){$ops=new Gameops(['platform'=>'site','uid'=>7,'roles'=>$dev?['developer']:[]]);$ops->user=['coins'=>0,'coins_earned'=>0,'roulette_cups'=>'["__prize_choice_dev__"]'];$r=(new \ReflectionClass(Roulette::class))->newInstanceWithoutConstructor();(new \ReflectionProperty(Roulette::class,'ops'))->setValue($r,$ops);$tools=new class{function output($data){return $data;}};(new \ReflectionProperty(Roulette::class,'registry'))->setValue($r,['uid'=>7,'tools'=>$tools]);$r->openMinigame();if(!$dev){if($ops->error!==85)throw new \Exception('ordinary_player_forced_choice');continue;}$cups=json_decode($ops->user['roulette_cups'],true);if(count($cups)!==9||in_array('kush',$cups,true)||in_array('keyring',$cups,true))throw new \Exception('dev_shared_prizes');$r->openMinigame();if($ops->error!==85)throw new \Exception('repeated_choice');$ops->user['roulette_cups']='["__prize_choice_dev__"]';$r->claimPrize();if((int)$ops->user['coins']!==500||$ops->user['roulette_cups']!==null)throw new \Exception('guaranteed_500_changed');}
echo "PASS: forced developer minigame has no shared state or rare prizes, no replay; guaranteed 500 unchanged\n";
