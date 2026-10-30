<?php
define('OK_SCHEMA_TEST', true);
require __DIR__ . '/../../tools/repair-ok-feature-schema.php';
function check($condition,$message){if(!$condition) throw new Exception($message);}
class Rows {
    private $rows;
    function __construct($rows){$this->rows=$rows;}
    function fetch_assoc(){return array_shift($this->rows);}
}
class SchemaLink {
    public $database='stalker_ok', $columns=['id','coins'], $queries=[], $fail=false;
    function query($sql){
        $this->queries[]=$sql;
        if(str_starts_with($sql,'SELECT DATABASE'))return new Rows([['db'=>$this->database]]);
        if(str_contains($sql,'GET_LOCK'))return new Rows([['acquired'=>1]]);
        if(str_starts_with($sql,'SHOW COLUMNS'))return new Rows(array_map(fn($name)=>['Field'=>$name],$this->columns));
        if(preg_match('/ADD COLUMN `([^`]+)`/', $sql,$match)){
            if($this->fail)throw new RuntimeException('simulated ALTER failure');
            $this->columns[]=$match[1];
        }
        return true;
    }
}
$link=new SchemaLink;
$result=repairOkFeatureSchema($link,false);
check(count($result['missing'])===9 && $link->columns===['id','coins'],'check mode mutates schema');
$result=repairOkFeatureSchema($link,true);
check(count($result['added'])===9,'missing feature columns not added');
check(repairOkFeatureSchema($link,true)['added']===[],'migration is not idempotent');
foreach($link->queries as $sql){
    check(!preg_match('/\b(DELETE|TRUNCATE|DROP|INSERT|UPDATE)\b/i',$sql),'migration changes player data');
    if(str_starts_with($sql,'ALTER'))check(str_contains($sql,'`stalker_ok`.`users` ADD COLUMN'),'wrong target');
}
$link=new SchemaLink;$link->database='stalker';
try{repairOkFeatureSchema($link,true);throw new Exception('VK schema accepted');}catch(RuntimeException $e){}
check(count($link->queries)===1,'VK refusal happened after writes');
$link=new SchemaLink;$link->fail=true;
try{repairOkFeatureSchema($link,true);throw new Exception('failure swallowed');}catch(RuntimeException $e){}
check(str_contains(end($link->queries),'RELEASE_LOCK'),'lock leaked after failure');
echo "OK feature schema: dry-run, target isolation, additive changes, idempotency and cleanup passed\n";
