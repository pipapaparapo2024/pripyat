const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {findPhpBin, runPhp} = require('./_php_bin');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const db = read('server/core/models/database.php');
assert(!read('server/dev_energy.php').includes('PDO'));
assert(read('server/dev_energy.php').includes('http_response_code(410)'));
assert(!db.includes('if(false)'));
assert(!db.includes('count(explode("`"'));
assert(db.includes('AND token=? AND req_key=?'));
const users = read('server/core/controllers/users.php');
const allowed = users.slice(users.indexOf('$allowed ='), users.indexOf('$strictNumericFields'));
for(const key of ['natisk_event_id','natisk_free_attempts','natisk_paid_attempts','natisk_kills'])
    assert(!allowed.includes("'" + key + "'"), key + ' must be server owned');
const php = findPhpBin();
assert(php, 'PHP required for security regressions');
const result = runPhp(php, `
require ${JSON.stringify(path.join(root,'server/core/controllers/security.php'))};
require ${JSON.stringify(path.join(root,'server/core/controllers/event.php'))};
require ${JSON.stringify(path.join(root,'server/core/models/database.php'))};
class OutputSink {public $error; public $out; function error($c){$this->error=$c;} function output($v){$this->out=$v;}}
class Store {public $writes=0; function saveData($t,$v){$this->writes++;}}
function check($ok,$label){if(!$ok) throw new Exception($label);}
$ref=new ReflectionClass(Database::class); $database=$ref->newInstanceWithoutConstructor();
class EscapeLink {function real_escape_string($s){return addslashes($s);}}
$ref->getProperty('link')->setValue($database,new EscapeLink);
$value="name ".chr(96)." ' ".chr(92)." кириллица";
$sql=$database->toSQL(['nickname'=>$value]);
check($sql===chr(96).'nickname'.chr(96)."='".addslashes($value)."'",'SQL value must remain quoted data');
try{$database->toSQL(['bad'.chr(96).'column'=>'x']);throw new Exception('invalid column accepted');}catch(InvalidArgumentException $e){}
$now=time();
foreach([$now,$now-90000,$now+600,null,'bad'] as $ts){
 $sink=new OutputSink; $store=new Store;
 $params=['vk_user_id'=>'123','vk_ts'=>$ts]; ksort($params);
 $params['sign']=rtrim(strtr(base64_encode(hash_hmac('sha256',http_build_query($params),'test',true)),'+/','-_'),'=');
 $r=['user_params'=>$params,'api_secret'=>'test','uid'=>123,'udb'=>$store,'tools'=>$sink];
 (new Security($r))->getToken();
 check($store->writes===($ts===$now?1:0),'launch age validation');
 if($ts!==$now)check($sink->error===8,'stale launch must return recovery code, not identity spoofing');
}
$sink=new OutputSink; $store=new Store;
(new Security(['user_params'=>['sign'=>'forged','vk_ts'=>$now,'vk_user_id'=>123],'api_secret'=>'test','uid'=>123,'udb'=>$store,'tools'=>$sink]))->getToken();
check($sink->error===0 && $store->writes===0,'forged signature accepted');
$sink=new OutputSink; (new Event(['tools'=>$sink]))->save(); check($sink->error===44,'legacy event must reject without DB writes');
$source=file_get_contents(${JSON.stringify(path.join(root,'server/universal.php'))});
$start=strpos($source,'    function checkToken(){'); $end=strpos($source,'    function createReqKey()', $start);
eval(substr($source,$start,$end-$start));
class AuthStore {public $writes=0; public $key='old';function getData(...$args){return ['token'=>'valid','time'=>time(),'lifetime'=>1000,'req_key'=>$this->key];}function rotateRequestKey($uid,$token,$previous,$next){if($previous!==$this->key)return false;$this->writes++;$this->key=$next;return true;}}
$store=new AuthStore; $GLOBALS['registry']=['udb'=>$store,'uid'=>123];
$_POST=['method'=>'users.save','token'=>'wrong','req_key'=>'old']; check(checkToken()[0]===false && $store->writes===0,'invalid token mutates session');
$_POST['token']='valid'; $_POST['req_key']='wrong'; check(checkToken()[0]===false && $store->writes===0,'invalid key mutates session');
$_POST['req_key']='old'; $ok=checkToken();
if(!(intval(date('G'))===0 && intval(date('i'))<4)){check($ok[0] && $store->writes===1,'valid request');check(!checkToken()[0] && $store->writes===1,'replay accepted');}
echo 'PHP security regressions OK';
`);
assert(result.ok, result.stderr);
console.log(result.stdout);
