const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
(async()=>{
    const fixture=JSON.parse(fs.readFileSync(0,'utf8'));
    const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio']});
    try{
        const context=await browser.newContext({viewport:{width:1280,height:800}});
        await context.addInitScript(raw=>{
            window.Telegram={WebApp:{initData:raw,platform:'tdesktop',ready(){},expand(){},onEvent(){},isVersionAtLeast(){return true;},requestFullscreen(){window.__fullscreenRequested=true;}}};
        },fixture.init_data);
        const page=await context.newPage();
        const errors=[];const failed=[];const apiFailures=[];
        page.on('pageerror',e=>{errors.push(e.message);console.log(JSON.stringify({pageError:e.stack}));});
        page.on('response',async r=>{
            if(new URL(r.url()).pathname==='/server/telegram-api.php'){
                try{const body=await r.json();if(body.status==='error'){const failure={apiMethod:new URLSearchParams(r.request().postData()).get('method'),code:body.code};apiFailures.push(failure);console.log(JSON.stringify(failure));}}catch(_){}
            }
        });
        page.on('response',r=>{if(r.status()>=400)failed.push({path:new URL(r.url()).pathname,status:r.status()});});
        await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* Test host injected by fixture. */'}));
        await page.goto('https://tg-test-pripyat-game.ru/',{waitUntil:'domcontentloaded',timeout:45000});
        await page.locator('[data-tg-enter]').click({timeout:30000});
        if(!await page.evaluate(()=>window.__fullscreenRequested))throw new Error('Desktop fullscreen not requested');
        console.log('Telegram browser: страница открыта');
        try{
            await page.waitForFunction(()=>window._preloaderHiddenFired && window.udata && window.iface,null,{timeout:120000});
        }catch(e){
            console.log(JSON.stringify({stage:'boot_failed',errors,failed:failed.slice(0,20),state:await page.evaluate(()=>({canvas:!!document.querySelector('canvas'),player:!!window.udata,iface:!!window.iface,preloaderHidden:!!window._preloaderHiddenFired,errorText:document.body.innerText.slice(-350)}))}));
            throw new Error('Telegram browser boot failed');
        }
        const loaded=await page.evaluate(()=>({id:String(udata.id),platform:platformRuntime.platform,server:my_server,step:udata.onboarding_step}));
        console.log('Telegram browser: игровой экран загружен');
        const payment=await page.evaluate(async()=>{
            if(window.telegramEruda||document.querySelector('#telegram-developer-logs'))throw new Error('Developer console visible to ordinary user');
            let opened=false;const before=String(udata.stew);
            Telegram.WebApp.openInvoice=(url,done)=>{opened=/^https:\/\/t\.me\/\$/.test(url);done('cancelled');};
            const result=await window.__telegramPurchase('item0');
            return {opened,result,before,after:String(udata.stew)};
        });
        if(!payment.opened||payment.result!==false||payment.before!==payment.after)throw new Error('Cancelled invoice/browser permissions failed');
        console.log('Telegram browser: настоящий счёт открыт с имитацией отмены; списания и награды нет, Eruda обычному игроку недоступна');
        if(loaded.platform!=='telegram'||loaded.server!=='https://tg-test-pripyat-game.ru/server')throw new Error('Wrong runtime');
        // Exercise the real persistence Proxy and serialized TS request queue.
        await page.evaluate(async()=>{
            udata.nick='TG Browser';udata.snd_vol='0.31';
            await new Promise((resolve,reject)=>{
                const timer=setTimeout(()=>reject(new Error('Save timeout: '+JSON.stringify({wait:TS.wait,method:TS.thisReq && TS.thisReq.m,queued:TS.reqs.length}))),20000);
                flushPlayerSave('telegram_browser_fixture',err=>{clearTimeout(timer);err?reject(new Error('save_failed')):resolve();});
            });
        });
        console.log('Telegram browser: сохранение подтверждено');
        await page.reload({waitUntil:'domcontentloaded'});
        await page.locator('[data-tg-enter]').click({timeout:30000});
        await page.waitForFunction(()=>window._preloaderHiddenFired && window.udata && window.iface,null,{timeout:120000});
        const restored=await page.evaluate(()=>({id:String(udata.id),nick:udata.nick,sound:Number(udata.snd_vol)}));
        if(restored.id!==loaded.id||restored.nick!=='TG Browser'||Math.abs(restored.sound-0.31)>0.001)throw new Error('Browser persistence failed');
        await page.evaluate(()=>window.openTelegramFriends());
        await page.getByRole('button',{name:'Не друзья',exact:true}).click();
        await page.getByRole('button',{name:'Пригласить',exact:true}).click();
        await page.locator('#telegram-friends input').waitFor();
        const invite=await page.locator('#telegram-friends input').inputValue();
        if(!/^https:\/\/t\.me\/pripyat_game_test_bot\?start=f_[a-f0-9]{48}$/.test(invite))throw new Error('Invalid invitation link');
        await page.getByRole('button',{name:'Закрыть',exact:true}).click();
        await page.waitForFunction(()=>!document.getElementById('_preloader_spine'),null,{timeout:5000});
        await page.screenshot({path:fixture.screenshot,fullPage:true});
        console.log(JSON.stringify({browser:'Edge headless',boot:'passed',persistence:'passed',errors,failed:failed.slice(0,20),screenshot:fixture.screenshot}));
        if(errors.length||failed.length||apiFailures.length)throw new Error('Browser/API errors detected');
    }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
