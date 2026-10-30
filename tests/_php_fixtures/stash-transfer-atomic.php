<?php
require __DIR__.'/../../server/core/models/gameops.php';
require __DIR__.'/../../server/core/models/zanachkimodel.php';
function ensure($value,$message){if(!$value)throw new RuntimeException($message);}
class AtomicRows {public $num_rows;private $rows;function __construct($rows){$this->rows=$rows;$this->num_rows=count($rows);}function fetch_assoc(){return array_shift($this->rows);}}
class AtomicLink {
    public static $rows=[],$failRecipient=false;public $connect_error=false;private $before=null;
    function __construct(...$args){}function set_charset($s){}function real_escape_string($s){return addslashes($s);}
    function begin_transaction(){$this->before=self::$rows;}
    function commit(){$this->before=null;}
    function rollback(){if($this->before!==null)self::$rows=$this->before;$this->before=null;}
    function close(){$this->rollback();}
    function query($sql){
        if(str_contains($sql,'SELECT *')){
            if(preg_match('/id IN \((\d+),(\d+)\)/',$sql,$m))$ids=[(int)$m[1],(int)$m[2]];
            else {preg_match('/id=(\d+)/',$sql,$m);$ids=[(int)$m[1]];}
            return new AtomicRows(array_values(array_intersect_key(self::$rows,array_flip($ids))));
        }
        return new AtomicRows([['result'=>1]]);
    }
    function prepare($sql){return new class($sql) {
        private $sql,$values;function __construct($sql){$this->sql=$sql;}
        function bind_param($types,&...$values){$this->values=$values;}
        function execute(){
            $id=(int)end($this->values);
            if($id===2 && AtomicLink::$failRecipient)throw new RuntimeException('Injected recipient write failure');
            preg_match('/SET (.+) WHERE/',$this->sql,$m);
            foreach(explode(',',$m[1]) as $i=>$assignment){$field=trim(explode('=',$assignment)[0]," `");AtomicLink::$rows[$id][$field]=$this->values[$i];}
            return true;
        }
    };}
}
class AtomicDb {function getData($table,$fields,$where){return AtomicLink::$rows[1];}function saveData(){throw new RuntimeException('Unexpected non-transactional save');}}
class AtomicTools {public $out;function output($out){$this->out=$out;}function error($code){throw new RuntimeException('Denied '.$code);}}
$src=file_get_contents(__DIR__.'/../../server/core/controllers/zanachki.php');eval(str_replace(['<?php','?>','new mysqli('],['','','new AtomicLink('],$src));
$tools=new AtomicTools;$registry=['uid'=>1,'utb'=>'users','udb'=>new AtomicDb,'tools'=>$tools,'server'=>'x','user'=>'x','pass'=>'x','db'=>'x','user_params'=>['target_id'=>2,'collection_id'=>1,'position'=>1]];
AtomicLink::$rows=[1=>['id'=>1,'stash_data'=>'{"1":{"1":2}}','stash_claims'=>'{}'],2=>['id'=>2,'stash_data'=>'{}','stash_wishlist'=>'[{"col":1,"pos":1}]']];
$before=AtomicLink::$rows;AtomicLink::$failRecipient=true;
try{(new Zanachki($registry))->giveCard();throw new RuntimeException('Expected injected failure');}catch(RuntimeException $e){ensure($e->getMessage()==='Injected recipient write failure','wrong failure');}
ensure(AtomicLink::$rows===$before,'failed receiver write did not roll back sender inventory and quota');
AtomicLink::$failRecipient=false;(new Zanachki($registry))->giveCard();
ensure(json_decode(AtomicLink::$rows[1]['stash_data'],true)[1][1]===1,'sender inventory wrong');
ensure(json_decode(AtomicLink::$rows[2]['stash_data'],true)[1][1]===1,'receiver inventory wrong');
ensure(json_decode(AtomicLink::$rows[2]['stash_wishlist'],true)===[],'request not removed');
$ops=new Gameops($registry);ensure(ZanachkiModel::giftCount($ops,AtomicLink::$rows[1],2)===1,'quota not committed');
// Two real collection controller calls consume only complete sets; no duplicate claim.
AtomicLink::$rows[1]=['id'=>1,'stash_data'=>json_encode([1=>array_fill(1,7,1)]),'stash_claims'=>AtomicLink::$rows[1]['stash_claims'],'exp'=>'0','cigarettes'=>'0'];
(new Zanachki($registry))->claimCollection();
ensure(json_decode(AtomicLink::$rows[1]['stash_claims'],true)[1]===1,'exchange count not saved');
$after=AtomicLink::$rows;
try{(new Zanachki($registry))->claimCollection();throw new RuntimeException('Duplicate accepted');}catch(RuntimeException $e){ensure($e->getMessage()==='Denied 88','second claim must fail incomplete');}
ensure(AtomicLink::$rows===$after,'rejected repeat changed resources');
ensure(ZanachkiModel::giftCount($ops,AtomicLink::$rows[1],2)===1,'claim erased gift metadata');
echo 'OK';
