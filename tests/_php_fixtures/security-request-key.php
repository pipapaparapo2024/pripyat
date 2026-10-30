<?php
require __DIR__ . '/../../server/core/models/database.php';
require __DIR__ . '/../../server/core/controllers/security.php';
function verify($condition, $message){if(!$condition) throw new RuntimeException($message);}

// Exercise the real Database method with a prepared-statement transport double.
// The database comparison is modeled here; no connection to live player data.
class KeyConnection {
    public $row=['uid'=>123,'token'=>'valid','key'=>'old','expires'=>PHP_INT_MAX];
    public $closed=0;
    function prepare($sql){
        verify($sql==='UPDATE secure SET req_key=? WHERE id=? AND token=? AND req_key=? AND time+lifetime>=?', 'CAS predicate changed');
        return new KeyStatement($this);
    }
}
class KeyStatement {
    public $affected_rows=0;
    private $link, $values=[];
    function __construct($link){$this->link=$link;}
    function bind_param($types, &...$values){
        verify($types==='sissi','invalid binding types');$this->values=&$values;
    }
    function execute(){
        [$next,$uid,$token,$previous,$now]=$this->values;
        $row=&$this->link->row;
        if($uid===$row['uid'] && $token===$row['token'] && $previous===$row['key'] && $now<=$row['expires']){
            $row['key']=$next;$this->affected_rows=1;
        }
    }
    function close(){$this->link->closed++;}
}
$class=new ReflectionClass(Database::class);
$database=$class->newInstanceWithoutConstructor();$link=new KeyConnection;
$class->getProperty('link')->setValue($database,$link);
verify(!$database->rotateRequestKey(999,'valid','old','stolen'),'wrong uid accepted');
verify(!$database->rotateRequestKey(123,'forged','old','stolen'),'wrong token accepted');
verify(!$database->rotateRequestKey(123,'valid','stale','stolen'),'stale key accepted');
verify($link->row['key']==='old','rejected request changed session');
verify($database->rotateRequestKey(123,'valid','old','first'),'valid rotation failed');
verify(!$database->rotateRequestKey(123,'valid','old','second'),'two requests consumed the same key');
verify($link->row['key']==='first','losing request overwrote winner');
$link->row['expires']=time()-1;
verify(!$database->rotateRequestKey(123,'valid','first','expired'),'expired session accepted');
verify($link->closed===6,'prepared statements not closed');

class TokenOutput {public $error=null,$result=null;function error($code){$this->error=$code;}function output($data){$this->result=$data;}}
class TokenStore {public $saved=[];function saveData($table,$data){$this->saved[]=$data;return ['error'=>false];}}
function tokenRequest($signedUid,$postedUid){
    $params=['vk_user_id'=>(string)$signedUid,'vk_ts'=>(string)time()];ksort($params);
    $params['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($params),'test-secret',true)),'+/','-_'),'=');
    $out=new TokenOutput;$store=new TokenStore;
    (new Security(['user_params'=>$params,'uid'=>$postedUid,'api_secret'=>'test-secret','udb'=>$store,'tools'=>$out]))->getToken();
    return [$out,$store];
}
[$out,$store]=tokenRequest(123,999);
verify($out->error===7 && $store->saved===[],'valid signature authorized another uid');
[$out,$store]=tokenRequest(123,123);
verify($out->error===null && count($store->saved)===1,'legitimate token issuance failed');
verify($store->saved[0]['id']===123,'token saved for wrong uid');
verify(strlen($store->saved[0]['req_key'])===32,'request key length incompatible');
verify(strlen($out->result['token'])===32 && ctype_xdigit($out->result['token']),'token format incompatible');
[$second]=tokenRequest(123,123);
verify($out->result['token']!==$second->result['token'],'tokens reused');

// Production Registry is write-once, unlike a PHP array. Exercise the full
// checkToken path with that contract and the real prepared-update method above.
class WriteOnceRegistry implements ArrayAccess {
    private $values;
    function __construct($values){$this->values=$values;}
    function offsetExists($key):bool{return isset($this->values[$key]);}
    function offsetGet($key):mixed{return $this->values[$key]??null;}
    function offsetSet($key,$value):void{if(!isset($this->values[$key]))$this->values[$key]=$value;}
    function offsetUnset($key):void{unset($this->values[$key]);}
}
class RequestStore {
    private $database,$link;
    function __construct($database,$link){$this->database=$database;$this->link=$link;}
    function getData(...$args){return ['token'=>$this->link->row['token'],'req_key'=>$this->link->row['key'],'time'=>time(),'lifetime'=>3600];}
    function rotateRequestKey(...$args){return $this->database->rotateRequestKey(...$args);}
}
$source=file_get_contents(__DIR__.'/../../server/universal.php');
$start=strpos($source,'    function checkToken(){');$end=strpos($source,'    function createReqKey()', $start);
eval(substr($source,$start,$end-$start));
$link->row['expires']=PHP_INT_MAX;
$GLOBALS['registry']=new WriteOnceRegistry(['uid'=>123,'udb'=>new RequestStore($database,$link)]);
$_POST=['method'=>'users.get','token'=>'valid','req_key'=>$link->row['key']];
$result=checkToken();
if(!(intval(date('G'))===0 && intval(date('i'))<4)){
    verify($result[0]===true,'valid request rejected with real Registry contract');
    verify($GLOBALS['registry']['req_key']===$link->row['key'],'response key does not match database');
    $_POST['req_key']=$GLOBALS['registry']['req_key'];
    verify(checkToken()[0]===true,'second consecutive request rejected');
    verify($GLOBALS['registry']['req_key']===$link->row['key'],'second response key stale');
}

// Running the retired endpoint must not instantiate PDO or touch a database.
ob_start();require __DIR__ . '/../../server/dev_energy.php';$body=ob_get_clean();
verify(http_response_code()===410,'debug endpoint not retired');
verify(json_decode($body,true)===['ok'=>false,'error'=>'gone'],'debug endpoint response changed');
echo "Security: real request-key method, replay, expiry, UID binding, token compatibility and retired endpoint passed\n";
