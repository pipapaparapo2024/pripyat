const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('_client/src/modules/telegram-login.js','utf8').replace('export async function','async function');
const context={URL,URLSearchParams,window:{location:{href:'https://tg-test.example/login',origin:'https://tg-test.example'}}};
vm.createContext(context);vm.runInContext(source,context);
(async()=>{
    let sent=0;
    const session={platform:'telegram',environment:'test',player_id:'1',token:'a'.repeat(64),req_key:'b'.repeat(32),expires_at:1793533600};
    const fetchImpl=async(url,options)=>{
        sent++;assert.equal(url,'https://tg-test.example/server/telegram-login.php');
        assert.equal(new URLSearchParams(options.body).get('init_data'),'signed+data&x=1');
        assert.equal(options.redirect,'error');
        return {ok:true,json:async()=>session};
    };
    const args={webApp:{initData:'signed+data&x=1',initDataUnsafe:{user:{id:999}}},endpoint:'/server/telegram-login.php',fetchImpl};
    const result=await context.loginTelegramTest(args);
    assert.equal(result.player_id,'1');assert(Object.isFrozen(result));
    await assert.rejects(()=>context.loginTelegramTest({...args,webApp:{initData:''}}));
    await assert.rejects(()=>context.loginTelegramTest({...args,endpoint:'https://evil.example/login'}));
    assert.equal(sent,1);
    await assert.rejects(()=>context.loginTelegramTest({...args,fetchImpl:async()=>({ok:false})}));
    await assert.rejects(()=>context.loginTelegramTest({...args,fetchImpl:async()=>({ok:true,json:async()=>({...session,platform:'vk'})})}));
    console.log('Telegram-клиент: подписанные данные, внутренний ID, same-origin и ошибки проверены');
})().catch(e=>{console.error(e);process.exitCode=1;});
