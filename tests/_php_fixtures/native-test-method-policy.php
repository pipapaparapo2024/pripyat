<?php
require __DIR__.'/../../server/core/models/nativetestmethodpolicy.php';
require __DIR__.'/../../server/core/controllers/users.php';
foreach(['users.devGrantShmot','users.get','users.save','shmot.buy','shmot.equip'] as $method){
    if(!NativeTestMethodPolicy::allows($method))throw new RuntimeException('Allowed method rejected');
}
foreach(['users.resetSession','users.resetAllPlayers','users.devGrantCurrency','users.devGrantShmotExtra','users.setDevFlag','shmot.devGrantShmot','users.DEVGrantShmot',[],null] as $method){
    if(NativeTestMethodPolicy::allows($method))throw new RuntimeException('Blocked method accepted');
}
$type=new ReflectionClass(Users::class);$controller=$type->newInstanceWithoutConstructor();
$registry=$type->getProperty('registry');$guard=$type->getMethod('_requireDevUser');
$tools=new class{public $reply;public function output($data){$this->reply=$data;}public function error($code){throw new RuntimeException('denied_'.$code);}};
foreach(['382448269'=>true,'999000715'=>false] as $uid=>$allowed){
    $registry->setValue($controller,['uid'=>(string)$uid,'platform'=>'vk','tools'=>$tools]);
    try{$granted=$guard->invoke($controller);}catch(RuntimeException $e){$granted=false;}
    if($granted!==$allowed)throw new RuntimeException('Developer guard mismatch');
}
$ops=new class{
    public $user=['shmot'=>'[]','max_energy'=>50];public $bonuses=0;
    public function loadUser(){return $this->user;}
    public function j($user,$key,$default){return json_decode($user[$key],true)??$default;}
    public function applyShmotOwnBonus(&$user,$id){$this->bonuses++;}
    public function saveUser($user){$this->user=$user;return true;}
    public function patchCurrencies($user,$fields){return array_intersect_key($user,array_flip($fields));}
};
$registry->setValue($controller,['uid'=>'382448269','platform'=>'vk','tools'=>$tools,'user_params'=>['shmot_json'=>json_encode([41=>['owned'=>true,'equipped'=>false],103=>['owned'=>true,'equipped'=>false]])]]);
$type->getProperty('ops')->setValue($controller,$ops);
$controller->devGrantShmot();$saved=json_decode($tools->reply['patch']['shmot'],true);
if(empty($saved[41]['owned'])||empty($saved[103]['owned'])||$ops->bonuses!==2)throw new RuntimeException('Developer grant failed');
$controller->devGrantShmot();if($ops->bonuses!==2)throw new RuntimeException('Duplicate grant bonus');
echo "TEST gateway: выдача шмота проходит только через серверную проверку разработчика; сбросы и другие dev-методы закрыты\n";
