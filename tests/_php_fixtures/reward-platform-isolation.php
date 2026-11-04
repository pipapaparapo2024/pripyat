<?php
require __DIR__.'/../../server/core/models/rewardlinkpublisher.php';
function checkReward($v,$label){if(!$v)throw new RuntimeException($label);}
function rejectReward($f){try{$f();}catch(Throwable $e){return;}throw new RuntimeException('Ожидался отказ');}
class RewardMemoryDb {
 public $name,$rows=[],$fail=false;
 function __construct($name){$this->name=$name;}
 function query($q){return new class($this->name){private $name;function __construct($n){$this->name=$n;}function fetchColumn(){return $this->name;}};}
 function prepare($q){checkReward(str_starts_with($q,'INSERT INTO reward_links'),'Публикация меняет только reward_links');return new class($this){private $db;function __construct($db){$this->db=$db;}function execute($args){if($this->db->fail)throw new RuntimeException('fixture');$this->db->rows[]=$args;return true;}};}
}
$dbs=[];foreach(RewardLinkTargets::DATABASES['test'] as $name)$dbs[$name]=new RewardMemoryDb($name);
$calls=[];$publisher=new RewardLinkPublisher('test',function($name)use(&$calls,&$dbs){$calls[]=$name;return $dbs[$name];});
$reward=[['kind'=>'currency','field'=>'coins','amount'=>7]];
$results=$publisher->create(['vk','ok','telegram','site'],$reward,'Проверка',60,1000);
checkReward(count(array_unique(array_column($results,'code')))===4,'У четырёх площадок разные коды');
foreach($results as $platform=>$r){
 checkReward($r['created']===true,'Ссылка создана');$target=RewardLinkTargets::database('test',$platform);
 checkReward(count($dbs[$target]->rows)===1,'Ровно одна запись своей БД');
 foreach(RewardLinkTargets::DATABASES as $env=>$map)foreach($map as $p=>$db)checkReward(RewardLinkTargets::matches($r['code'],$db)===($env==='test'&&$p===$platform),'Код не подходит другой площадке/PROD');
}
$before=count($calls);rejectReward(fn()=>$publisher->create(['vk','mysql'],$reward,'',0,1000));checkReward(count($calls)===$before,'Все площадки проверены до соединения');
rejectReward(fn()=>$publisher->create(['vk','vk'],$reward,'',0,1000));
rejectReward(fn()=>$publisher->create([], $reward,'',0,1000));
rejectReward(fn()=>$publisher->create(['vk'],[['kind'=>'currency','field'=>'id','amount'=>1]],'',0,1000));
$dbs['stalker_ok_test']->fail=true;$r=$publisher->create(['telegram','ok'],$reward,'',0,1000);
checkReward($r['telegram']['created']&&!$r['ok']['created']&&!isset($r['ok']['code']),'Частичный сбой явно отмечен без ложной ссылки');
$wrong=new RewardLinkPublisher('test',fn($name)=>new RewardMemoryDb('stalker'));
checkReward(!$wrong->create(['vk'],$reward,'',0,1000)['vk']['created'],'Ошибочный конфиг PROD отвергнут до INSERT');
foreach(['r1_test_vk_bad','r1_prod_mysql_'.str_repeat('a',32),'r1_test_site_'.str_repeat('a',32).'x'] as $bad)checkReward(!RewardLinkTargets::matches($bad,'stalker_test'),'Неверный привязанный код отвергнут');
checkReward(RewardLinkTargets::matches('historical-code','legacy-db'),'Исторические коды сохранены');
echo "Награды: четыре отдельные БД/кода, TEST/PROD, выбор площадок, ошибочный конфиг и частичный сбой проверены\n";
