const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('_client/src/modules/universal_helper.js','utf8');
const method=src.slice(src.indexOf('    loadPhoto50('),src.indexOf('    numberAnimation('));
async function scenario(platform,photo=null){
    let calls=0;
    const context={window:{platformRuntime:{platform,getAvatar:()=>Promise.resolve(photo),callApi:()=>{calls++;return Promise.resolve({response:[{photo_50:'https://vk.example/avatar.png'}]});}}},
        bitmaps50:{id:[],bm:[]},VK_token:'vk-test-token',VK_version:'5.132',null_photo50:'./images/2048 аватар заглушка.png',PIXI:{Sprite:{from:function(url){this.url=url;}}}};
    vm.createContext(context);vm.runInContext('class Helper {'+method+'}; this.helper=new Helper();',context);
    let sprite;await context.helper.loadPhoto50('42',v=>sprite=v);
    return {calls,url:sprite.url};
}
(async()=>{
    const tg=await scenario('telegram');assert.equal(tg.calls,0);assert.equal(tg.url,'./images/2048 аватар заглушка.png');
    const tgPhoto=await scenario('telegram','https://tg-test-pripyat-game.ru/images/telegram-avatars/photo.jpg');assert.equal(tgPhoto.calls,0);assert.equal(tgPhoto.url,'https://tg-test-pripyat-game.ru/images/telegram-avatars/photo.jpg');
    const resolver=fs.readFileSync('_client/src/game/bosses/bosses-combat.js','utf8');
    const start=resolver.indexOf('    proto._resolveVkUsers = function(ids, callback){');
    const branch=resolver.slice(start,resolver.indexOf('        const out = {};',start))+'callback({});};';
    const requested=[];const ctx={window:{platformRuntime:{platform:'telegram',getAvatar:id=>{requested.push(id);return Promise.resolve('https://photo/'+id);}}}};
    vm.createContext(ctx);vm.runInContext('const proto={};'+branch+'this.resolve=proto._resolveVkUsers;',ctx);
    let profiles;await ctx.resolve(['18','18',0,'../private'],value=>profiles=value);
    assert.deepEqual(requested,['18']);assert.equal(profiles['18'].photo,'https://photo/18');
    for(const platform of ['vk','ok']){const legacy=await scenario(platform);assert.equal(legacy.calls,1);assert.equal(legacy.url,'https://vk.example/avatar.png');}
    console.log('Аватары: Telegram использует локальный ресурс; VK/OK сохраняют прежнее получение фотографии');
})().catch(e=>{console.error(e);process.exitCode=1;});
