<?php
require __DIR__.'/../../server/core/models/gameops.php';
require __DIR__.'/../../server/core/models/achievementengine.php';
require __DIR__.'/../../server/core/controllers/users.php';
function wpCheck($ok,$message){if(!$ok)throw new Exception($message);}
foreach(['habar','roulette','poker','game2048','ryukzak','dice'] as $file){
 require __DIR__.'/../../server/core/controllers/'.$file.'.php';
 $class=ucfirst($file);$ref=new ReflectionClass($class);$instance=$ref->newInstanceWithoutConstructor();$p=$ref->getProperty('ops');$p->setValue($instance,new Gameops([]));
 $wid=$file==='game2048'?4:3;$type=$wid===4?'gun':'machete';$data=array_fill(0,6,[]);$data[$wid]=['qty'=>10,'acquired_total'=>100];
 $user=['weapons'=>json_encode($data),'ammo_'.$type=>10];
 $method=$ref->getMethod('_grantWeaponReward');$method->invokeArgs($instance,[&$user,$type,5]);
 $slots=json_decode($user['weapons'],true);wpCheck($slots[$wid]['qty']===15 && $slots[$wid]['acquired_total']===105,$file.' lifetime grant mismatch');
}
require __DIR__.'/../../server/core/models/raznaryadkaprogress.php';
$user=['weapons'=>json_encode([[],[],[],[],['qty'=>4,'acquired_total'=>50]]),'ammo_gun'=>4];
RaznaryadkaProgress::_grantWeaponReward(new Gameops([]),$user,'gun',6);$slots=json_decode($user['weapons'],true);wpCheck($slots[4]['acquired_total']===56,'assignment reward mismatch');
$slot=['qty'=>40];WeaponProgress::seed($slot);$slot['qty']=10;WeaponProgress::acquire($slot,5,$slot['qty']);wpCheck($slot['acquired_total']===45,'consumption reduced lifetime total');
$slots=[[],[],[],['qty'=>8,'acquired_total'=>200],['qty'=>34],['qty'=>13]];
$user=['weapons'=>json_encode($slots)];$state=AchievementEngine::buildState(new Gameops([]),$user);wpCheck($state['mac']===200 && $state['gun']===34 && $state['auto']===13,'old and new achievement progress mismatch');
$controller=new Users([]);$incoming=$slots;$incoming[3]['qty']=1;$incoming[3]['acquired_total']=999999;
$safe=$controller->_sanitizeWeapons($slots,$incoming);wpCheck($safe[3]['acquired_total']===200,'client forged acquired_total');
$safe=$controller->_sanitizeWeapons($slots,[]);wpCheck($safe[3]['acquired_total']===200,'client erased lifetime total');
echo "Weapon progress: all reward sources, current-stock minimum, lifetime after consumption, server achievements and tamper protection passed\n";
