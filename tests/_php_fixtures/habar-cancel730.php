<?php
function check($v,$m){if(!$v)throw new RuntimeException($m);}
class Gameops {function loadUser(){return ['habar_bought'=>2,'habar_bought_ts'=>123];}function i($u,$k){return intval($u[$k]??0);}function catalog($k){return ['containers'=>[1=>['rewards'=>[]]]];}public $r;function __construct($r){$this->r=$r;}function fail($c){$this->r['tools']->out=['error'=>$c];}function ok($v){$this->r['tools']->out=$v;}}
class CancelTools{public $out;}
class CancelDb{
 public $connect_error=false;public static $row=['habar_bought'=>2,'habar_bought_ts'=>123];public static $queries=[];public static $fail=false;public static $rollback=0;public static $commit=0;
 function __construct(...$a){}function set_charset($s){}function begin_transaction(){}function close(){}function rollback(){self::$rollback++;}function commit(){self::$commit++;return true;}
 function query($sql){self::$queries[]=$sql;if(str_starts_with($sql,'SELECT'))return new class {public $num_rows=1;function fetch_assoc(){return CancelDb::$row;}};return !self::$fail;}
}
$s=file_get_contents(__DIR__.'/../../server/core/controllers/habar.php');eval(str_replace(['<?php','new mysqli('],['','new CancelDb('],$s));
$t=new CancelTools;$r=['uid'=>438953352,'utb'=>'users','tools'=>$t,'server'=>'','user'=>'','pass'=>'','db'=>'','user_params'=>['container_id'=>1,'bought_ts'=>123]];
(new Habar($r))->cancel();check(count($t->out['patch'])===4,'patch must only reset subscription');check(CancelDb::$commit===1,'commit missing');
foreach(CancelDb::$queries as $sql){check(str_contains($sql,'`id`=438953352'),'wrong account');check(!preg_match('/energy|coins|stew|weapons|habar_counts/',$sql),'cancellation changed other resources');}
CancelDb::$row['habar_bought_ts']=124;(new Habar($r))->cancel();check($t->out['error']===57,'stale confirmation cancelled a newer purchase');check(CancelDb::$commit===1,'stale confirmation committed');
CancelDb::$row=['habar_bought'=>0,'habar_bought_ts'=>0];(new Habar($r))->cancel();check($t->out['error']===57,'duplicate cancellation accepted');
CancelDb::$row=['habar_bought'=>2,'habar_bought_ts'=>123];CancelDb::$fail=true;(new Habar($r))->cancel();check($t->out['error']===99,'database failure not reported');check(CancelDb::$rollback===3,'failed requests must rollback');
CancelDb::$fail=false;CancelDb::$row=['habar_bought'=>0,'habar_bought_ts'=>0];CancelDb::$queries=[];
(new Habar($r))->collectDay();check($t->out['error']===57,'in-flight collection survived cancellation');
foreach(CancelDb::$queries as $sql)check(!str_starts_with($sql,'UPDATE'),'cancelled collection wrote rewards');
CancelDb::$row=['habar_bought'=>2,'habar_bought_ts'=>124];(new Habar($r))->collectDay();check($t->out['error']===57,'stale collection consumed a newer purchase');
echo 'OK';
