<?php
// Run: php tests/boss-rating-window.php. No database connection or mutations.
if(!class_exists('Bosses', false)) require __DIR__.'/../server/core/controllers/bosses.php';
function check($condition,$label){if(!$condition) throw new Exception($label);echo "PASS $label\n";}
class FakeLog {
    public $queries = [];
    public function query($sql){
        $this->queries[]=$sql;
        if(strpos($sql,'MAX(`id`)')!==false) $row=['maxId'=>20];
        else {preg_match('/`time`>=(\d+)/',$sql,$m);$since=intval($m[1]??0);$sum=0;foreach([[100,1000],[200,1000],[300,20]] as $hit) if($hit[0]>=$since)$sum+=$hit[1];$row=['s'=>$sum];}
        return new class($row){private $row;function __construct($r){$this->row=$r;}function fetch_assoc(){return $this->row;}};
    }
}
$r=new ReflectionClass('Bosses');$boss=$r->newInstanceWithoutConstructor();$method=$r->getMethod('_ratingTop');$db=new FakeLog();
check($method->invoke($boss,$db,1,'Me',0,0,['bossStartMs'=>[[0]]],[])===[], 'closed fight has no all-time rating');
check(count($db->queries)===0,'closed fight never queries history');
$top=$method->invoke($boss,$db,1,'Me',0,0,['bossStartMs'=>[[300]]],[]);
check($top[0]['damage']===20,'new fight excludes two previous victories');
$sync=$r->getMethod('_syncFightSession');
$old=['bossId'=>0,'diffIdx'=>0,'hp'=>0,'cursorId'=>20,'startMs'=>200];
$fresh=$sync->invoke($boss,$db,1,$old,0,0,300,[]);
check($fresh['hp']===980 && $fresh['startMs']===300,'same boss new attempt resets cached HP');
$again=$sync->invoke($boss,$db,1,$fresh,0,0,300,[]);
check($again===$fresh,'same attempt preserves HP and cursor');
