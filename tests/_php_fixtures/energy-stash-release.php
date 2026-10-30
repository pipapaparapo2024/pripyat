<?php
require __DIR__.'/../../server/core/models/gameops.php';
require __DIR__.'/../../server/core/models/achievementengine.php';
function check($ok,$message){if(!$ok) throw new RuntimeException($message);}
class ReleaseDb {
    public $user; public $updates=[];
    function getData(...$args){return $this->user;}
    function saveData($table,$update){$this->updates[]=$update;$this->user=array_merge($this->user,$update);return ['ok'=>1];}
}
class ReleaseTools {public $out;function output($v){$this->out=$v;}function error($code){throw new RuntimeException('Unexpected error '.$code);}}
$db=new ReleaseDb;$tools=new ReleaseTools;
$db->user=['id'=>1,'energy'=>'10','energy_time'=>(string)time(),'energy_spent'=>'100','max_energy'=>'50','train_count'=>'0','base_stats'=>'[]','stash_claims'=>'{"1":1}','exp'=>'0'];
$registry=['uid'=>1,'utb'=>'users','udb'=>$db,'tools'=>$tools,'server'=>'fake','user'=>'fake','pass'=>'fake','db'=>'fake','user_params'=>['stat_id'=>0]];
$ops=new Gameops($registry);$stale=$ops->loadUser();
$db->user['energy']='6';$db->user['stash_claims']='{"1":10}';$stale['exp']='5';$ops->saveUser($stale);
check($db->user['energy']==='6','unrelated save resurrected spent energy');
check($db->user['stash_claims']==='{"1":10}','unrelated save erased claim/gift counters');
check(!isset($ops->patchCurrencies($stale)['energy']),'unrelated response sends stale energy back to HUD');
// Actual Base::train, replacing only the database transport.
class TestMysqli {
    public $connect_error=false;public static $queries=[];
    function __construct(...$args){}function set_charset($s){}function begin_transaction(){}function commit(){}function rollback(){}function close(){}
    function real_escape_string($s){return addslashes((string)$s);}
    function query($sql){
        self::$queries[]=$sql;
        if(str_starts_with($sql,'SELECT'))return new class {public $num_rows=1;function fetch_assoc(){return ['base_stats'=>'[]','train_count'=>'0'];}};
        return true;
    }
}
$src=file_get_contents(__DIR__.'/../../server/core/controllers/base.php');
$src=str_replace(['<?php','?>','new mysqli('],['','','new TestMysqli('],$src);eval($src);
$db->user['energy']='0';$before=$db->user;$db->updates=[];
(new Base($registry))->train();
check(count($db->updates)===0,'training rewrote a stale full row after locked UPDATE');
check($tools->out['patch']['train_count']==1,'training with zero energy failed');
check($db->user['energy']===$before['energy'] && $db->user['energy_time']===$before['energy_time'],'training changed energy');
foreach(TestMysqli::$queries as $sql)check(!preg_match('/\benergy(_time|_spent)?\b/',$sql),'training SQL touches energy');
$stats=json_decode($tools->out['patch']['base_stats'],true);check($stats[0]['xp']>=40,'training did not progress');
// Real checkpoint spending formula and elapsed-time regeneration remain available.
$zone=['energy'=>'10','energy_time'=>(string)(time()-300),'max_energy'=>'50'];
check($ops->spendEnergy($zone,4),'zone spending failed');check($zone['energy']===7,'zone must regenerate one then spend four');
// Fifteen consumable collections, exact 1/10 achievement thresholds, no duplicate awards.
$catalog=json_decode(file_get_contents(__DIR__.'/../../server/json/achievements_config.json'),true);
$stashCatalog=array_values(array_filter($catalog,fn($a)=>$a['cat']==='stash'));
check(count($stashCatalog)===30,'expected 30 collection achievements');
$user=['stash_claims'=>'{"1":true}','stash_data'=>'{}'];
check(ZanachkiModel::achievementCounts($ops,$user)['k_lezv']===1,'legacy boolean must count as one');
$user=[];ZanachkiModel::grantAllCollections($ops,$user,10);
foreach(range(1,15) as $col){
    check(ZanachkiModel::claimCollectionReward($ops,$user,$col)===true,'first exchange failed');
}
[$user,$earned]=AchievementEngine::checkAll($ops,$user,$stashCatalog);
check(count($earned)===15 && intval($user['achievement_stars'])===75,'first exchange awards must be 15 x 5');
foreach(range(1,15) as $col)foreach(range(2,10) as $_)check(ZanachkiModel::claimCollectionReward($ops,$user,$col)===true,'repeated exchange failed');
[$user,$earned]=AchievementEngine::checkAll($ops,$user,$stashCatalog);
check(count($earned)===15 && intval($user['achievement_stars'])===225,'tenth exchange awards must add 15 x 10');
[$user,$earned]=AchievementEngine::checkAll($ops,$user,$stashCatalog);check(count($earned)===0,'awards duplicated');
// Per-recipient daily cap, failures do not consume quota, next Moscow day resets it.
$giver=[];ZanachkiModel::grantAllCollections($ops,$giver,30);$target=['id'=>42];
foreach(range(1,10) as $_){$target['stash_wishlist']='[{"col":1,"pos":1}]';check(ZanachkiModel::giveCard($ops,$giver,$target,1,1,'2026-11-01')===true,'allowed gift rejected');}
$beforeGiver=$giver;$beforeTarget=$target;
check(ZanachkiModel::giveCard($ops,$giver,$target,1,1,'2026-11-01')===101,'eleventh gift accepted');
check($giver===$beforeGiver && $target===$beforeTarget,'rejected gift changed inventories');
$other=['id'=>43,'stash_wishlist'=>'[{"col":1,"pos":1}]'];
check(ZanachkiModel::giveCard($ops,$giver,$other,1,1,'2026-11-01')===true,'different friend shares cap');
$target['stash_wishlist']='[{"col":1,"pos":1}]';
check(ZanachkiModel::giveCard($ops,$giver,$target,1,1,'2026-11-02')===true,'next day did not reset cap');
check(count(ZanachkiModel::getClaimedMap($ops,$giver))===0,'gift metadata counted as a collection');
check(ZanachkiModel::claimCollectionReward($ops,$giver,1)===true,'exchange after gifts failed');
check(ZanachkiModel::giftCount($ops,$giver,42,'2026-11-02')===1,'exchange reset gift quota');
echo 'OK';
