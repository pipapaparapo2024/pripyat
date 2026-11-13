<?php
require __DIR__.'/../../tools/site-payment-reconcile.php';
require __DIR__.'/../../website/app/paymentattempts.php';
class ReconcileStatement extends PDOStatement {
 public array $rows=[]; private string $after='';
 public function execute(?array $params=null):bool {$this->after=$params[0];return true;}
 public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args):array{return array_slice(array_values(array_filter($this->rows,fn($r)=>strcmp($r['id'],$this->after)>0)),0,100);}
}
class ReconcileDatabase extends PDO {
 public array $rows=[];
 public function __construct(){}
 public function prepare(string $query,array $options=[]):PDOStatement|false{$s=new ReconcileStatement();$s->rows=$this->rows;return $s;}
}
$db=new ReconcileDatabase();for($i=0;$i<205;$i++)$db->rows[]=['id'=>sprintf('%064d',$i),'provider_payment_id'=>'p'.$i];
$events=[];$calls=0;
$failures=reconcilePendingPayments($db,function($id)use(&$calls){$calls++;if($id==='p100')throw new RuntimeException('private-secret');return $id==='p0'?'credited':'pending';},function($id,$result)use(&$events){$events[]=[$id,$result];});
if($calls!==205||$failures!==1||count($events)!==410||$events[201][1]!=='error:RuntimeException')throw new RuntimeException('pagination or reporting failed');
if(str_contains(json_encode($events),'private-secret'))throw new RuntimeException('secret leaked');
$dir=sys_get_temp_dir().'/attempts-'.bin2hex(random_bytes(8));mkdir($dir);
try{
 file_put_contents($dir.'/site.jsonl',json_encode(['payment_id'=>'p0','time'=>1,'source'=>'reconcile','outcome'=>'credited'])."\n{invalid\n");
 if(count(PaymentAttempts::read($dir,'site','p0'))!==1||PaymentAttempts::read($dir,'../site','p0')!==[]||PaymentAttempts::read($dir,'site','other')!==[])throw new RuntimeException('journal isolation failed');
}finally{unlink($dir.'/site.jsonl');rmdir($dir);}
echo "Reconcile: 205 orders, pagination, errors, audit and journal isolation passed\n";
