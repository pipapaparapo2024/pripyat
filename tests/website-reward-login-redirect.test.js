const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../_client/src/website-entry.js'),'utf8');
const begin=source.indexOf('(async()=>{')+11;
const end=source.indexOf(" const r=await fetch('/auth/bootstrap'");
(async()=>{
 for(const status of [{authenticated:false},{authenticated:true,platform:'site'}]){
  let target;
  const location={search:'?platform=vk&reward=r1_prod_vk_'+ 'a'.repeat(32),replace(url){target=url;}};
  const context={location,URLSearchParams,fetch:async()=>({json:async()=>status})};
  await vm.runInNewContext('(async()=>{'+source.slice(begin,end)+'})()',context);
  assert.equal(target,'/?platform=vk&reward=r1_prod_vk_'+'a'.repeat(32),'Reward and world must survive login or world selection');
 }
 console.log('Website reward entry preserves the reward when login or platform selection is required');
})().catch(e=>{console.error(e);process.exitCode=1;});
