const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process'),{findPhpBin}=require('./_php_bin.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ok-payment752-')),file=path.join(dir,'state.json');
const initial={user:{id:'42',stew:'10',coins:'100',energy:'10'},trans:[],ledger:[]};
function reset(){fs.writeFileSync(file,JSON.stringify(initial));}
function run(scenario='normal'){return spawnSync(findPhpBin(),['tests/_php_fixtures/ok-payment752.php',file,scenario],{encoding:'utf8'});}
function state(){return JSON.parse(fs.readFileSync(file,'utf8'));}
try{
 reset();let res=run('missing-sampler');assert.equal(res.status,0);assert.ok(JSON.parse(res.stdout).error_code,'missing bootstrap dependency must fail safely');assert.deepEqual(state(),initial,'crash must occur before credit');
 reset();res=run();assert.equal(res.status,0,res.stdout+res.stderr);assert.equal(res.stdout,'true');assert.equal(Number(state().user.stew),90);assert.equal(Object.keys(state().ledger).length,1);
 assert.equal(state().ledger['fixture-transaction'].game_uid,42);assert.deepEqual(state().trans,[],'VK ledger changed');
 const credited=state();res=run();assert.equal(res.status,0,res.stdout+res.stderr);assert.equal(res.stdout,'true');assert.deepEqual(state(),credited,'repeat callback double credited');res=run('mapping-missing');assert.equal(res.stdout,'true');assert.deepEqual(state(),credited,'processed payment should not require a current login');
 for(const scenario of ['signature','amount','mapping-missing','mapping-tampered','credit-failure','ledger-failure','commit-failure']){reset();res=run(scenario);assert.equal(res.status,0,res.stderr);assert.ok(JSON.parse(res.stdout).error_code);assert.deepEqual(state(),initial,scenario+' credited or consumed transaction');if(scenario.endsWith('failure')){res=run();assert.equal(res.stdout,'true');assert.equal(Number(state().user.stew),90);assert.equal(Object.keys(state().ledger).length,1);}}
 reset();res=run('legacy');assert.equal(res.status,0,res.stderr);assert.equal(res.stdout,'true');assert.equal(Number(state().user.stew),90);
 console.log('Full OK callback + real Database: bootstrap regression reproduced; signed credit, duplicate, invalid signature/amount and legacy code passed');
}finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('ok-payment752-'));fs.rmSync(dir,{recursive:true,force:true});}
