const assert=require('assert'),path=require('path');
const {findPhpBin,runPhp}=require('./_php_bin');
const php=findPhpBin();assert(php,'PHP required');
const result=runPhp(php,`require ${JSON.stringify(path.join(__dirname,'_php_fixtures/energy-stash-release.php'))};`);
assert(result.ok,result.stderr||result.stdout);assert.strictEqual(result.stdout.trim(),'OK');
console.log('Real PHP: energy isolation, free training, 30 collection achievements, 10 gifts per friend/day passed');
