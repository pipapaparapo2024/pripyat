<?php
$root=$argv[1]??dirname(__DIR__,2).'/server';
require $root.'/core/models/gameops.php';require $root.'/core/controllers/bosses.php';
final class DamageResult {function __construct(private array $row){}function fetch_assoc(){return $this->row;}}
final class DamageMemory {
 public array $rows=[];
 function query($sql){
  $rows=$this->rows;
  if(preg_match('/`time` < (\d+)/',$sql,$m)){$rows=array_filter($rows,fn($r)=>$r['time']<(int)$m[1]);return new DamageResult(['maxId'=>$rows?max(array_column($rows,'id')):null]);}
  preg_match_all('/\(`uid`=(\d+) AND `time`>=(\d+)\)/',$sql,$pairs,PREG_SET_ORDER);
  if($pairs){$rows=array_filter($rows,function($r)use($pairs){foreach($pairs as $p)if($r['uid']==$p[1]&&$r['time']>=$p[2])return true;return false;});}
  else {foreach(['uid','boss_id'] as $f)if(preg_match('/`'.$f.'`=(\d+)/',$sql,$m))$rows=array_filter($rows,fn($r)=>$r[$f]==$m[1]);if(preg_match('/`time`>=(\d+)/',$sql,$m))$rows=array_filter($rows,fn($r)=>$r['time']>=$m[1]);}
  if(str_contains($sql,'`is_sedoy`=0'))$rows=array_filter($rows,fn($r)=>$r['is_sedoy']==0);
  if(preg_match('/`id` > (\d+)/',$sql,$m))$rows=array_filter($rows,fn($r)=>$r['id']>$m[1]);
  return new DamageResult(['s'=>array_sum(array_column($rows,'damage')),'maxId'=>$rows?max(array_column($rows,'id')):null]);
 }
}
$mysql=in_array('--mysql',$argv,true);$db=$mysql?new mysqli('localhost','root','','stalker'):new DamageMemory;
if($mysql)$db->query('CREATE TEMPORARY TABLE boss_damage_log (id BIGINT PRIMARY KEY,uid BIGINT,boss_id INT,diff_idx INT,time BIGINT,damage BIGINT,is_sedoy INT)');
$b=new Bosses([]);$ref=new ReflectionMethod($b,'_syncFightSession');$hp=(new ReflectionProperty($b,'BOSS_HP'))->getValue($b);$checks=0;
function checkDamage($actual,$expected,$label){global $checks;$checks++;if($actual!==$expected)throw new RuntimeException($label.': expected '.$expected.', got '.$actual);}
foreach(range(0,7) as $boss)foreach(range(0,3) as $diff){
 $rows=[[1,200,7,0,900,700,0],[2,100,$boss,$diff,1050,40,0],[3,200,($boss+1)%8,3,1100,100,0],[4,200,0,0,1101,900,1],[5,300,0,0,1102,800,0],[6,100,($boss+1)%8,0,1103,600,0]];
 $set=function($rows)use($db,$mysql){if($mysql){$db->query('DELETE FROM boss_damage_log');foreach($rows as $r)$db->query('INSERT INTO boss_damage_log VALUES('.implode(',',$r).')');}else $db->rows=array_map(fn($r)=>array_combine(['id','uid','boss_id','diff_idx','time','damage','is_sedoy'],$r),$rows);};$set($rows);
 $sync=fn($s,$friends=[200=>1000])=>$ref->invoke($b,$db,100,$s,$diff,$boss,1000,$friends);
 $expected=$hp[$boss][$diff]-40-($diff===3?0:100);
 $s=$sync([]);checkDamage($s['hp'],$expected,'recovery');
 foreach(range(1,3) as $poll){$s=$sync(json_decode(json_encode($s),true));checkDamage($s['hp'],$expected,'repeat after persisted reload');}
 $recovered=$sync([]);checkDamage($recovered['hp'],$expected,'lost cache recovery');
 $late=$sync([],[]);checkDamage($late['hp'],$hp[$boss][$diff]-40,'friends not loaded');$late=$sync($late);checkDamage($late['hp'],$expected,'friends loaded later');
 $rows[]=[7,200,($boss+2)%8,0,1200,25,0];$set($rows);$s=$sync($s);$expected-=($diff===3?0:25);checkDamage($s['hp'],$expected,'new damage');checkDamage($sync($s)['hp'],$expected,'new damage repeated');checkDamage($sync([])['hp'],$expected,'rebuild after new damage');
}
echo "PASS: $checks recovery and repeated-request checks, mysql=".($mysql?'yes':'no')."\n";
