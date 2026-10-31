<?php
require __DIR__.'/../../server/core/controllers/dice.php';
$dice=(new ReflectionClass('Dice'))->newInstanceWithoutConstructor();
$method=new ReflectionMethod('Dice','_reducePremiumRoll');
$catalog=['table'=>[['v'=>6,'n'=>3,'type'=>'coins']],'die_weights'=>[1,1,1,1,1,1]];
mt_srand(738);
for($i=0;$i<1000;$i++){
    $trace=[];$rolls=[6,6,6,2];
    $out=$method->invokeArgs($dice,[$rolls,$catalog,&$trace,2]);
    foreach([0,1,3] as $kept) if($out[$kept]!==$rolls[$kept]) throw new Exception('Kept die changed');
}
echo "PASS: 1000 premium rerolls preserve all three kept dice\n";
require __DIR__.'/../../server/core/models/raznaryadkaprogress.php';
require __DIR__.'/../../server/core/controllers/raznaryadka.php';
class Prelaunch738Ops {
    public $user,$config,$output,$saves=0;
    function loadUser(){return $this->user;}
    function saveUser($user){$this->saves++;$this->user=$user;return true;}
    function catalog($key){return $this->config;}
    function j($user,$key,$default=[]){return $user[$key]??$default;}
    function patchCurrencies($user){return [];}
    function ok($output){$this->output=$output;}
}
$ops=new Prelaunch738Ops();
$ops->config=json_decode(file_get_contents(__DIR__.'/../../server/json/raznaryadka_config.json'),true);
$ops->config['launch_month']='9999-11';
$ops->user=['raznaryadka_data'=>['month'=>RaznaryadkaProgress::mskMonthKey(),'days'=>['31'=>['status'=>'done','prog'=>999]],'claimed'=>[2]]];
RaznaryadkaProgress::report($ops,'respect',100);
if($ops->saves!==0) throw new Exception('Prelaunch report writes progress');
$controller=(new ReflectionClass('Raznaryadka'))->newInstanceWithoutConstructor();
(new ReflectionProperty('Raznaryadka','ops'))->setValue($controller,$ops);
$controller->getState();
if($ops->output['done_count']!==0) throw new Exception('Prelaunch counted completed days');
foreach($ops->output['days'] as $day) if($day['status']!=='pending') throw new Exception('Prelaunch showed check mark');
foreach($ops->output['reward_tiers'] as $tier) if($tier['claimed']||$tier['eligible']) throw new Exception('Prelaunch reward eligible');
echo "PASS: prelaunch ignores historical done/claimed state and rejects progress\n";
require __DIR__.'/../../server/core/controllers/users.php';
class Dev738Tools {public $errorCode;function output($result){}function error($code){$this->errorCode=$code;}}
$tools=new Dev738Tools();
$users=(new ReflectionClass('Users'))->newInstanceWithoutConstructor();
$ops->user=['shmot'=>[100=>['owned'=>true]],'keyring_owner'=>0];
(new ReflectionProperty('Users','ops'))->setValue($users,$ops);
$registry=['uid'=>'438953352','tools'=>$tools,'user_params'=>['shmot_json'=>'{"100":{"owned":true}}']];
(new ReflectionProperty('Users','registry'))->setValue($users,$registry);
$users->devGrantShmot();
if(($ops->user['keyring_owner']??0)!==1) throw new Exception('Authorized wardrobe grant omitted keyring');
$registry['uid']='999000715';$saved=$ops->saves;
(new ReflectionProperty('Users','registry'))->setValue($users,$registry);
$users->devGrantShmot();
if($tools->errorCode!==403 || $ops->saves!==$saved) throw new Exception('Ordinary user passed dev guard');
echo "PASS: authorized wardrobe unlock grants keyring; ordinary user denied\n";
