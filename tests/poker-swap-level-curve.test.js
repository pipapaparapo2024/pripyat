const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const {findPhpBin} = require('./_php_bin');
const php = findPhpBin();
assert.ok(php, 'Для регрессии покера нужен PHP');
const source = fs.readFileSync('server/core/controllers/poker.php', 'utf8');
const method = source.match(/private function _swapsAllowed\(\$user\)\{[\s\S]*?\n {8}\}/)[0];
const cases = [0,139,140,145,629,630,1389,1390];
const fixture = `class Fixture {
 public $ops;
 function __construct() { $this->ops = new class {
  function i($user, $key) { return (int) $user[$key]; }
 }; }
 ${method}
 function run($n) { return $this->_swapsAllowed(['poker_games'=>$n,'dvor_games_data'=>['poker'=>['exp'=>99999]]]); }
}
$f=new Fixture(); echo json_encode(array_map(fn($n)=>$f->run($n), [${cases}]));`;
assert.deepEqual(JSON.parse(execFileSync(php, ['-r',fixture], {encoding:'utf8'})), [0,0,1,1,1,2,2,3]);
