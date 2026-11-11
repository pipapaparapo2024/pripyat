const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {execFileSync} = require('node:child_process');
const {findPhpBin} = require('./_php_bin');
const php = findPhpBin();
assert.ok(php);
const source = readFileSync('server/core/controllers/bosses.php', 'utf8');
const method = source.slice(source.indexOf('function tutorialHunter()'), source.indexOf('private function _isDevUser()'));
const fixture = `
class Store {
 public $row=['onboarding_step'=>'bosses','bosses_data'=>'{"keys":[4],"killsTotal":[2]}','cigarettes'=>7,'exp'=>9,'bosses_killed'=>3,'boss_kills_0'=>2];
 public $writes=0;
 function begin_transaction(){}
 function rollback(){}
 function commit(){}
 function fetch_assoc(){return $this->row;}
 function execute_query($sql,$values){
  if(str_starts_with($sql,'SELECT')){
   if(!str_contains($sql,'FOR UPDATE'))throw new Exception('lock missing');
   return $this;
  }
  $this->writes++;
  if(!str_starts_with($sql,'UPDATE ') || !str_contains($sql,'SET bosses_data=?,cigarettes=?,exp=? WHERE id=?'))throw new Exception('unexpected write');
  foreach(['bosses_data','cigarettes','exp'] as $i=>$key)$this->row[$key]=$values[$i];
  return true;
 }
}
class Fixture {
 public $registry=['uid'=>1,'utb'=>'users','user_params'=>[]];
 public $store;
 public $ops;
 function __construct(){$this->store=new Store();$this->ops=$this;}
 function _rawLink(){return $this->store;}
 function _decodeBossesData($raw){return json_decode($raw,true);}
 function fail($code){return ['error'=>$code];}
 function ok($data){return $data;}
 function patchCurrencies($row,$keys){return array_intersect_key($row,array_flip($keys));}
 function shot($n){$this->registry['user_params']['shot']=$n;return $this->tutorialHunter();}
 ${method}
}
$f=new Fixture();
$out=[$f->shot(0),$f->shot(10)];
for($n=1;$n<=10;$n++)$out[]=$f->shot($n);
$out[]=$f->shot(10);
$out[]=$f->shot(0);
$f->store->row['onboarding_step']='done';
$out[]=$f->shot(0);
echo json_encode([$out,$f->store->row,$f->store->writes]);`;
const [results, row, writes] = JSON.parse(execFileSync(php, ['-r', fixture], {encoding:'utf8'}));
assert.deepEqual(results.slice(0, 2).map(x => x.hp), [1000, 1000]);
assert.deepEqual(results.slice(2, 12).map(x => x.hp), [900,800,700,600,500,400,300,200,100,0]);
assert.deepEqual(results.slice(11, 14).map(x => x.patch.cigarettes), [107,107,107]);
assert.equal(results[14].error, 54);
assert.equal(row.exp, 34);
assert.equal(row.bosses_killed,3);
assert.equal(row.boss_kills_0,2);
assert.deepEqual(JSON.parse(row.bosses_data), {keys:[4], tutorialHunterShots:10, killsTotal:[2]});
assert.equal(writes, 10);
