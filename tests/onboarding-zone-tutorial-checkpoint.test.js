const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {execFileSync}=require('node:child_process');
const {findPhpBin}=require('./_php_bin');
const php=findPhpBin();
assert.ok(php,'PHP CLI is required for the tutorial checkpoint regression test');
const source=readFileSync('server/core/controllers/zone.php','utf8');
const method=source.slice(source.indexOf('function fillCheckpoint(){'),source.indexOf('// Отдельная явная кнопка'));
assert.ok(method.includes("$tutorialRequested = strval($this->registry['user_params']['tutorial'] ?? '') === '1';"));
const fixture=`
class RaznaryadkaProgress { static function report($ops,$kind,$amount){} }
class ZanachkiModel { static function grantRandomCards($ops,&$user,$count){} }
class Fixture {
 public $registry=['uid'=>7,'user_params'=>['loc'=>0,'cp'=>0]];
 public $ops;
 public $row=['onboarding_step'=>'zone','energy'=>'1','energy_time'=>'1700000000','max_energy'=>'50','zone'=>null,'cigarettes'=>'0','exp'=>'0','respect'=>'0','energy_spent'=>'0','zone_fights'=>'0','zone_fights_0'=>'0','total_damage'=>'0','stash_count'=>'0','stash_data'=>'[]'];
 public $saved=0,$energySpent=0,$lastResponse=null;
 function __construct(){ $this->ops=$this;$this->row['zone']=json_encode(['0'=>['cps'=>array_fill(0,6,0),'biz'=>[0,0,0],'cleared'=>0]]); }
 function _withUserLock($fn){$fn();return $this->lastResponse;}
 function _loadZoneProgress($u){return is_array($u['zone'])?$u['zone']:json_decode($u['zone'],true);}
 function _locProgress(&$p,$idx,$cfg){$key=(string)$idx;if(!isset($p[$key]))$p[$key]=['cps'=>array_fill(0,6,0),'biz'=>[0,0,0],'cleared'=>0];while(count($p[$key]['cps'])<6)$p[$key]['cps'][]=0;return $p[$key];}
 function _applyCaptureIfFull(&$p,$idx,&$u){return null;}
 function _recordRespectLeader($loc,$amount){}
 function _gangBonus($user,$key){return 0;}
 function _catalog(){return ['locations'=>[['checkpoints'=>array_fill(0,6,['cell_cost'=>4,'cig'=>3,'exp'=>2,'resp'=>1]),'businesses'=>[]]]];}
 function loadUser(){return $this->row;}
 function i($u,$k,$d=0){return intval($u[$k]??$d);}
 function add(&$u,$k,$v){$u[$k]=(string)(intval($u[$k]??0)+$v);}
 function energySnapshot($u){return [intval($u['energy']),intval($u['energy_time'])];}
 function spendEnergy(&$u,$n){$this->energySpent+=$n;if(intval($u['energy'])<$n)return false;$u['energy']=(string)(intval($u['energy'])-$n);return true;}
 function saveUser($u){$this->row=$u;$this->saved++;return true;}
 function patchCurrencies($u,$keys){return array_intersect_key($u,array_flip($keys));}
 function fail($code){return $this->lastResponse=['error'=>$code];}
 function ok($data){return $this->lastResponse=$data;}
 function grant($tutorial,$loc=0,$cp=0){$this->registry['user_params']=['loc'=>$loc,'cp'=>$cp];if($tutorial)$this->registry['user_params']['tutorial']='1';$this->lastResponse=null;$this->fillCheckpoint();return $this->lastResponse;}
 ${method}
}
$f=new Fixture();$first=$f->grant(true);$second=$f->grant(true);$third=$f->grant(true);
$tutorial=json_decode($f->row['zone'],true);$tutorialSnapshot=[$f->row['energy'],$f->row['energy_time'],$f->row['energy_spent'],$f->row['zone_fights'],$tutorial['0']['cps'][0],$tutorial['_tutorial_zone_actions'],$f->saved,$f->energySpent];
$f->row['onboarding_step']='done';$f->row['energy']='10';$normal=$f->grant(false);$normalSnapshot=[$f->row['energy'],$f->row['energy_spent'],$f->energySpent,json_decode($f->row['zone'],true)['0']['cps'][0]];
echo json_encode([$first,$second,$third,$tutorialSnapshot,$normal,$normalSnapshot]);`;
const raw=execFileSync(php,['-r',fixture],{encoding:'utf8'});
const [first,second,third,tutorialState,normal,normalState]=JSON.parse(raw);
assert.equal(first.tutorialActionNumber,1);
assert.equal(second.tutorialActionNumber,2);
assert.equal(third.error,62,'Third free action is rejected by the server');
assert.deepEqual(tutorialState,[1,1700000000,0,2,2,2,2,0],'Two tutorial actions save normal checkpoint progress/rewards without spending energy');
assert.ok(normal.patch,'Normal fillCheckpoint still succeeds outside tutorial');
assert.deepEqual(normalState,['6',4,4,3],'Normal gameplay still spends energy and increments ordinary progress');
assert.match(method,/\$user\['onboarding_step'\].*!== 'zone'/s);
assert.ok(method.indexOf("$progress['_tutorial_zone_actions'] = $tutorialActionNumber;") < method.indexOf("$user['zone'] = json_encode($progress);"));
console.log('Tutorial Cordon: two authorized free server actions count as checkpoint progress/rewards; third denied; normal energy cost preserved');
