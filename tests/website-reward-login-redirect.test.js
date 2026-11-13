const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../_client/src/website-entry.js'),'utf8');
const begin=source.indexOf('(async()=>{')+11;
const end=source.indexOf(" const r=await fetch(authBase+'/bootstrap'",begin);
(async()=>{
 assert(begin>=10&&end>begin,'Entry guard boundary exists');
 const reward='r1_prod_vk_'+'a'.repeat(32);
 for(const test of [
  {search:'?platform=vk&reward='+reward,status:{authenticated:false},expectedStatus:'/auth/status'},
  {search:'?platform=vk&reward='+reward,status:{authenticated:true,platform:'site'},expectedStatus:'/auth/status'},
  {search:'?auth=telegram&platform=vk&reward='+reward,status:{authenticated:false},expectedStatus:'/auth/telegram/status'},
 ]){
  let target,statusUrl;
  const location={search:test.search,replace(url){target=url;}};
  const context={location,URLSearchParams,fetch:async(url)=>{statusUrl=url;return {json:async()=>test.status};}};
  await vm.runInNewContext('(async()=>{'+source.slice(begin,end)+'})()',context);
  assert.equal(statusUrl,test.expectedStatus,'Entry checks the endpoint for the selected login mode');
  assert.equal(target,'/?platform=vk&reward='+reward,'Reward and world must survive login or world selection');
 }
 assert.match(source,/fetch\(authBase\+'\/bootstrap'/,'Bootstrap endpoint follows the selected auth route');
 console.log('Website reward entry preserves the reward when login or platform selection is required');
})().catch(e=>{console.error(e);process.exitCode=1;});
