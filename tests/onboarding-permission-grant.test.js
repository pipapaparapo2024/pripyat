const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('_client/src/game/preloader.js','utf8');
const start=src.indexOf('\t_requestFriendsScope(done){'),end=src.indexOf('\n\t// Пишется только',start);
const method=src.slice(start,end);
async function scenario(result,reject=false){
 let saved=0,loaded=0,asked=0;
 const context={window:{dispatchEvent(){}},Event:class{},VK_token:'old',markFriendsScopeAsked(){asked++;},runtime:()=>({requestFriendsToken:()=>reject?Promise.reject(new Error('denied')):Promise.resolve(result)})};
 vm.createContext(context);vm.runInContext('class Loader{'+method+'};this.loader=new Loader();',context);
 context.loader._persistFriendsScopeGranted=fn=>{saved++;fn(true);};context.loader._loadFriends=fn=>{loaded++;fn(true);};
 let reason;await new Promise(resolve=>context.loader._requestFriendsScope((ok,r)=>{reason={ok,r};resolve();}));
 return {saved,loaded,asked,reason,token:context.VK_token,pending:context.loader._friendsScopeRequestPending};
}
(async()=>{
 for(const result of [null,{}, {access_token:''},{access_token:'token',scope:''},{access_token:'token',scope:['photos']},{access_token:'token',scope:123}]){
  const r=await scenario(result);assert.equal(r.saved,0);assert.equal(r.loaded,0);assert.equal(r.reason.r,'scope');assert.equal(r.token,'old');assert.equal(r.pending,false);
 }
 for(const result of [{access_token:'token'},{access_token:'token',scope:'friends'},{access_token:'token',scope:['friends','photos']}]){
  const r=await scenario(result);assert.equal(r.saved,1);assert.equal(r.loaded,1);assert.equal(r.reason.ok,true);
 }
 const denied=await scenario(null,true);assert.equal(denied.saved,0);assert.equal(denied.reason.r,'denied');
 console.log('Onboarding: empty token/missing scope never records permission; valid grants, old SDK, denial and retry flags checked');
})().catch(e=>{console.error(e);process.exitCode=1;});
