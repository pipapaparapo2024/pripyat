const {execFileSync}=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const php=process.env.PHP_BIN||'C:/Users/HONOR/tools/php/php.exe';
execFileSync(php,[path.join(__dirname,'_php_fixtures/reward-audit.php')],{stdio:'inherit'});
const root=path.join(__dirname,'..');
const claim=fs.readFileSync(path.join(root,'server/core/controllers/rewardlinks.php'),'utf8');
assert.ok(claim.indexOf("$this->rewardResult(['claimed'=>1")>claim.indexOf('if(!$link->commit())'));
for(const reason of ['expired','already','target_mismatch','transaction_failed','database_unavailable'])assert.ok(claim.includes("'"+reason+"'"));
const site=fs.readFileSync(path.join(root,'website/app/sitehttp.php'),'utf8');assert.ok(site.includes("?'delivered':")&&site.includes("'intent_expired'"));
console.log('Reward result audit follows commit and covers failed requests');

// Execute the source wrapper in the installed app/server layout with a real open_basedir.
const os=require('node:os');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pripyat-audit-layout-'));
try{
 fs.mkdirSync(path.join(temp,'app'));fs.mkdirSync(path.join(temp,'server/core/models'),{recursive:true});
 fs.copyFileSync(path.join(root,'website/app/rewardaudit.php'),path.join(temp,'app/rewardaudit.php'));
 fs.copyFileSync(path.join(root,'server/core/models/rewardaudit.php'),path.join(temp,'server/core/models/rewardaudit.php'));
 const entry=path.join(temp,'entry.php');
 fs.writeFileSync(entry,"<?php require __DIR__.'/app/rewardaudit.php'; echo class_exists('RewardAudit')?'loaded':'missing';");
 assert.equal(execFileSync(php,['-d','open_basedir='+temp,entry],{encoding:'utf8'}),'loaded');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Installed audit wrapper resolves inside restricted runtime root');
