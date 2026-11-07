const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('_client/src/game/interface.js','utf8');
const body=source.match(/const refreshFriendsButton = \(\) => \{([\s\S]*?)\n\t\t\};/)[1];
for(const [platform,site,tg,consent,visible] of [['vk',true,false,0,false],['ok',true,false,0,false],['site',true,false,1,true],['telegram',false,true,1,true],['vk',false,false,0,true],['vk',false,false,1,false]]){
 const friendsBtn={},window={platformRuntime:{platform},__siteRuntime:site,__telegramRuntime:tg,udata:{friends_scope_granted:consent}};
 vm.runInNewContext(body,{window,udata:window.udata,friendsBtn});
 for(const key of ['visible','interactive','buttonMode'])assert.strictEqual(friendsBtn[key],visible,platform+' '+key);
}
console.log('Friend button: website social hidden, standalone/Telegram invitation retained, native consent preserved');
