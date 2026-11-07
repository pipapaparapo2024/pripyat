<?php
require __DIR__.'/../../server/core/models/gameops.php';require __DIR__.'/../../server/core/controllers/users.php';require __DIR__.'/../../server/core/controllers/bosses.php';require __DIR__.'/../../server/core/models/telegramgateway.php';
function checkDev($v){if(!$v)throw new RuntimeException('Dev resource persistence failed');}
class DevMemoryDB {public $row=['id'=>20,'energy'=>10,'energy_time'=>0,'max_energy'=>50,'exp'=>0,'bosses_data'=>'{}'];public $writes=0;function getData(...$args){return $this->row;}function saveData($table,$data){$this->writes++;$this->row=array_replace($this->row,$data);return ['error'=>false];}}
class DevTools {public $result;function error($code){$this->result=['error'=>$code];}function output($data){$this->result=$data;}}
$db=new DevMemoryDB;$tools=new DevTools;$r=new ArrayObject(['platform'=>'telegram','roles'=>['developer'],'uid'=>20,'utb'=>'users','udb'=>$db,'tools'=>$tools,'user_params'=>['target'=>1000000]]);
(new Users($r))->devGrantEnergy();checkDev($db->row['energy']===1000000&&$db->row['max_energy']===50&&$db->row['energy_time']>0);checkDev($tools->result['patch']['energy']===1000000);
$ops=new Gameops($r);$user=$ops->loadUser();checkDev($ops->spendEnergy($user,7));$ops->saveUser($user);$ops=new Gameops($r);$user=$ops->loadUser();checkDev($ops->energySnapshot($user)[0]===999993);
$r['user_params']=['amount'=>50];(new Users($r))->devGrantEnergy();checkDev($db->row['energy']===1000043);
$r['user_params']=['fill'=>true];(new Users($r))->devGrantEnergy();checkDev($db->row['energy']===1000043);
$r['user_params']=['all_amt'=>1000000];(new Bosses($r))->devGrantKeys();$keys=json_decode($db->row['bosses_data'],true)['keys'];checkDev(count($keys)===8&&array_sum($keys)===8000000);
$r['user_params']=['poker_spichki'=>1000000,'roulette_spichki'=>1000000];(new Users($r))->devGrantCurrency();checkDev($db->row['poker_spichki']===1000000&&$db->row['roulette_spichki']===1000000);
$r['user_params']=['amount'=>-1];$before=$db->writes;(new Users($r))->devGrantEnergy();checkDev($tools->result['error']===54&&$before===$db->writes);
$r['roles']=[];$r['uid']=382448269;$r['user_params']=['target'=>1000000];$before=$db->writes;
foreach(['devGrantEnergy','devGetLogs'] as $method){(new Users($r))->$method();checkDev($tools->result['error']===403&&$before===$db->writes);}
(new Bosses($r))->devGrantKeys();checkDev($tools->result['error']===403&&$before===$db->writes);
foreach(['users.devGetLogs','users.devGrantEnergy','bosses.devGrantKeys','bosses.devResetDailyLimits'] as $method)checkDev(TelegramGateway::allowed($method)&&TelegramGateway::requiresDeveloper($method));
echo "Dev grant persists across spend/reload, overflow retained, invalid grant rejected, nondeveloper resources/logs denied\n";
