const assert=require('assert'),path=require('path');
const {findPhpBin,runPhp}=require('./_php_bin');
const php=findPhpBin();assert(php);
const result=runPhp(php,`require ${JSON.stringify(path.join(__dirname,'_php_fixtures/stash-transfer-atomic.php'))};`);
assert(result.ok,result.stderr||result.stdout);assert.strictEqual(result.stdout.trim(),'OK');
console.log('Actual stash controllers: atomic sender/recipient/quota, failure rollback, no duplicate collection claim passed');
