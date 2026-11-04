<?php
ini_set('error_log',PHP_OS_FAMILY==='Windows'?'NUL':'/dev/null');
require __DIR__.'/../../server/core/models/gameops.php';
function verify747($condition,$message){if(!$condition)throw new Exception($message);}
class HabarResult747 {public $num_rows=1;function __construct(private $row){}function fetch_assoc(){return $this->row;}}
class HabarStmt747 {
    private $args=[];
    function __construct(private $db,private $sql){}
    function bind_param($types,&...$args){$this->args=&$args;}
    function execute(){
        if(str_starts_with($this->sql,'INSERT IGNORE')){$this->db->affected_rows=HabarSql747::$claimed?0:1;HabarSql747::$claimed=true;}
        if(str_starts_with($this->sql,'DELETE'))HabarSql747::$claimed=false;
        return true;
    }
    function get_result(){return new HabarResult747(['id'=>18,'reward'=>json_encode(HabarSql747::$reward),'expires_at'=>HabarSql747::$expires,'active'=>1]);}
    function close(){}
}
class HabarSql747 {
    public static $row=[],$claimed=false,$reward=[['kind'=>'habar','containerId'=>1]],$onCommit=null,$queries=[];
    public static $nowOverride=null,$failUpdate=false,$failCommit=false,$expires=null,$onLock=null;
    static function nowMs(){return self::$nowOverride ?? intval(round(microtime(true)*1000));}
    public $connect_error=false,$affected_rows=0;
    private $snapshot=null;
    function __construct(...$args){}function set_charset($v){}
    function begin_transaction(){$this->snapshot=[self::$row,self::$claimed];return true;}
    function rollback(){if($this->snapshot!==null)[self::$row,self::$claimed]=$this->snapshot;return true;}
    function close(){}
    function real_escape_string($v){return str_replace("'","\\'",$v);}
    function prepare($sql){return new HabarStmt747($this,$sql);}
    function query($sql){
        self::$queries[]=$sql;
        if(str_starts_with($sql,'SELECT') && is_callable(self::$onLock)){$hook=self::$onLock;self::$onLock=null;$hook();}
        if(str_starts_with($sql,'UPDATE') && self::$failUpdate)return false;
        if(str_starts_with($sql,'SELECT'))return new HabarResult747(self::$row + array_fill_keys(['dice_points','blue_points','poker_chips','sedoy_dmg_total','sedoy_dmg_left','ammo_machete','ammo_gun','ammo_auto'],'0'));
        if(str_starts_with($sql,'UPDATE')){preg_match_all("/`([a-z_]+)`='([^']*)'/",$sql,$m,PREG_SET_ORDER);foreach($m as $v)self::$row[$v[1]]=$v[2];}
        return true;
    }
    function commit(){if(self::$failCommit)return false;$this->snapshot=null;if(is_callable(self::$onCommit)){ $hook=self::$onCommit;self::$onCommit=null;$hook();}return true;}
}
class HabarUdb747 {
    public $updates=[];
    function getData(...$args){return HabarSql747::$row;}
    function saveData($table,$data){$this->updates[]=$data;HabarSql747::$row=array_replace(HabarSql747::$row,$data);return [];}
}
class HabarCatalog747 {function get($name,...$args){if($name==='habar_daily_config')return ['total_days'=>30,'containers'=>[1=>['rewards'=>[['type'=>'coins','amount'=>5]]]]];return json_decode(file_get_contents(__DIR__.'/../../server/json/'.$name.'.json'),true);}}
class HabarTools747 {public $result;function output($value){$this->result=$value;}function error($code){$this->result=['error'=>$code];}}
foreach(['habar','rewardlinks'] as $name){$path=realpath(__DIR__.'/../../server/core/controllers/'.$name.'.php');$source=file_get_contents($path);$source=str_replace('__DIR__',var_export(dirname($path),true),$source);eval(str_replace(['<?php','new mysqli(','intval(round(microtime(true) * 1000))'],['','new HabarSql747(','HabarSql747::nowMs()'],$source));}
$tools=new HabarTools747;$udb=new HabarUdb747;
$registry=['tools'=>$tools,'udb'=>$udb,'utb'=>'users','uid'=>42,'json'=>new HabarCatalog747,'server'=>'','user'=>'','pass'=>'','db'=>'','user_params'=>['container_id'=>1,'code'=>'fixture']];
function fresh747(){HabarSql747::$row=['id'=>42,'habar_bought'=>'0','habar_bought_ts'=>'1000','habar_days_collected'=>'30','habar_last_collect_ts'=>'2000','habar_counts'=>'[0,0,0,0]','stew'=>'10000','coins'=>'100','cigarettes'=>'100','respect'=>'0','exp'=>'0','level'=>'0','energy'=>'10','weapons'=>'[]','shmot'=>'[]','bosses_data'=>'{}'];HabarSql747::$claimed=false;HabarSql747::$onCommit=null;}
fresh747();$before=intval(microtime(true)*1000);(new Habar($registry))->buy();$after=intval(ceil(microtime(true)*1000));
$ts=intval(HabarSql747::$row['habar_bought_ts']);
verify747($ts>=$before && $ts<=$after,'buy must record server time');
verify747(intval(HabarSql747::$row['habar_days_collected'])===0 && intval(HabarSql747::$row['habar_last_collect_ts'])===0,'buy must reset old collection state');
verify747(intval(HabarSql747::$row['stew'])===9750,'buy price changed');
(new Habar($registry))->buy();verify747($tools->result===['error'=>56] && intval(HabarSql747::$row['habar_bought_ts'])===$ts,'duplicate buy reset date');
fresh747();$before=intval(microtime(true)*1000);(new Rewardlinks($registry))->claim();$after=intval(ceil(microtime(true)*1000));
$gift=HabarSql747::$row;verify747(intval($gift['habar_bought_ts'])>=$before && intval($gift['habar_bought_ts'])<=$after,'gift must record server time');
verify747(intval($gift['habar_days_collected'])===0 && intval($gift['habar_last_collect_ts'])===0,'gift must reset old collection state');
verify747(isset($tools->result['patch']['habar_bought_ts']),'gift patch missing date');
(new Rewardlinks($registry))->claim();verify747(($tools->result['reason']??null)==='already' && HabarSql747::$row===$gift,'same gift awarded twice');
fresh747();HabarSql747::$onCommit=function(){HabarSql747::$row['habar_last_collect_ts']='9000';HabarSql747::$row['habar_days_collected']='1';};
(new Rewardlinks($registry))->claim();verify747(HabarSql747::$row['habar_last_collect_ts']==='9000' && HabarSql747::$row['habar_days_collected']==='1','gift save overwrote concurrent collection');
fresh747();$ops=new Gameops($registry);$old=$ops->loadUser();HabarSql747::$row['habar_bought']='3';HabarSql747::$row['habar_bought_ts']='7000';HabarSql747::$row['habar_days_collected']='1';HabarSql747::$row['habar_last_collect_ts']='9000';$old['coins']='101';$ops->saveUser($old);
verify747(HabarSql747::$row['habar_bought_ts']==='7000' && HabarSql747::$row['habar_bought']==='3' && HabarSql747::$row['habar_last_collect_ts']==='9000','unrelated stale save restored older Habar');
fresh747();HabarSql747::$row['habar_bought']='2';HabarSql747::$row['habar_bought_ts']=strval(intval(microtime(true)*1000));HabarSql747::$row['habar_days_collected']='0';HabarSql747::$row['habar_last_collect_ts']='0';
(new Habar($registry))->collectDay();verify747(intval(HabarSql747::$row['coins'])===105 && intval(HabarSql747::$row['habar_days_collected'])===1,'daily reward was overwritten');
$collected=HabarSql747::$row;(new Habar($registry))->collectDay();verify747($tools->result===['error'=>59] && HabarSql747::$row===$collected,'second daily collection allowed');
HabarSql747::$row['habar_bought_ts']=strval(intval(microtime(true)*1000)-31*86400000);$expiredRow=HabarSql747::$row;(new Habar($registry))->collectDay();verify747($tools->result===['error'=>58] && HabarSql747::$row===$expiredRow,'expired Habar collected');
echo "Habar lifecycle: buy/gift dates, resets, price, duplicate rejection, concurrent collection and newer purchase protected\n";
