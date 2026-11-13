const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync('_client/src/modules/site-runtime.js','utf8')
 .replace('export function createSiteRuntime','function createSiteRuntime');
const url='https://tg-test-pripyat-game.ru/images/telegram-avatars/'+'a'.repeat(64)+'.jpg?v=123';
const calls=[];
const window={TS:{php(method,params,success){calls.push({method,params});success({photo_url:url});}}};
const context=vm.createContext({window});
vm.runInContext(source+'\nthis.createRuntime=createSiteRuntime;',context);
(async()=>{
 const runtime=context.createRuntime({platform:'telegram',player_id:'20',profile:{first_name:'Тестер'}});
 const user=await runtime.getCurrentUser();
 assert.equal(user.photo_50,url);
 assert.equal(user.first_name,'Тестер');
 assert.equal(calls[0].method,'telegramavatars.get');
 assert.equal(calls[0].params.player_id,'20');
 assert.equal(await runtime.getAvatar('21'),url);
 assert.equal(calls[1].method,'telegramavatars.get');
 assert.equal(calls[1].params.player_id,'21');
 window.TS.php=(method,params,success)=>success({photo_url:'https://attacker.invalid/photo.jpg'});
 assert.equal(await runtime.getAvatar('21'),null);
 const site=context.createRuntime({platform:'site',player_id:'1',avatar_url:'/assets/avatars/avatar.jpg'});
 assert.equal((await site.getCurrentUser()).photo_50,'/assets/avatars/avatar.jpg');
 console.log('Аватар Telegram на сайте: свой профиль, другой игрок и запрет чужого URL проверены');
})().catch(error=>{console.error(error);process.exitCode=1;});
