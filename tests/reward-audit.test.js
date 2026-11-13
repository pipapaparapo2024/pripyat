const {execFileSync}=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const php=process.env.PHP_BIN||'C:/Users/HONOR/tools/php/php.exe';
execFileSync(php,[path.join(__dirname,'_php_fixtures/reward-audit.php')],{stdio:'inherit'});
const root=path.join(__dirname,'..');
const claim=fs.readFileSync(path.join(root,'server/core/controllers/rewardlinks.php'),'utf8');
assert.ok(claim.indexOf("$this->rewardResult(['claimed'=>1")>claim.indexOf('if(!$link->commit())'));
for(const reason of ['expired','already','target_mismatch','transaction_failed','database_unavailable'])assert.ok(claim.includes("'"+reason+"'"));
const site=fs.readFileSync(path.join(root,'website/app/sitehttp.php'),'utf8');assert.ok(site.includes("?'delivered':")&&site.includes("'intent_expired'"));
console.log('Reward result audit follows commit and covers failed requests');
