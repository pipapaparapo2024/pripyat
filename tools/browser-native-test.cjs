const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
(async()=>{
 const fixture=JSON.parse(fs.readFileSync(0,'utf8'));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio','--no-proxy-server','--host-resolver-rules=MAP test-pripyat-game.ru 135.106.159.212']});
 try{
  for(const platform of ['vk','ok']){
   const context=await browser.newContext({viewport:{width:1280,height:720}});const page=await context.newPage();const errors=[],failed=[];
   page.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});page.on('console',m=>{if(m.type()==='error'&&m.text().includes('[onboarding.start]'))errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)failed.push({path:new URL(r.url()).pathname,status:r.status()})});
   await page.route('**/libs/browser.min.js',route=>route.fulfill({contentType:'application/javascript',body:`window.vkBridge={subscribe(){},supports(){return false},send(method,p={}){return this.sendPromise(method,p)},sendPromise(method,p={}){if(method==='VKWebAppGetUserInfo')return Promise.resolve({id:999000715,first_name:'TEST',last_name:'Fixture',photo_50:''});if(method==='VKWebAppStorageGet')return Promise.resolve({keys:(p.keys||[]).map(key=>({key,value:''}))});if(method==='VKWebAppCallAPIMethod'){if(p.method==='users.get')return Promise.resolve({response:[{id:999000715,first_name:'TEST',last_name:'Fixture',photo_50:'https://test-pripyat-game.ru/server/images/noicon.png'}]});if(p.method==='utils.getServerTime')return Promise.resolve({response:Math.floor(Date.now()/1000)});if(p.method==='friends.get')return Promise.resolve({response:{items:[]}});if(p.method==='friends.getAppUsers')return Promise.resolve({response:[]});}if(method==='VKWebAppGetAuthToken')return Promise.reject(new Error('Permission not granted in fixture'));return Promise.resolve({result:true});}};`}));
   await page.route('**/fapi5.js',route=>route.fulfill({contentType:'application/javascript',body:'/* Platform API intentionally not exercised in synthetic host. */'}));
   const url='https://test-pripyat-game.ru/client/ver0_41/index.html?'+new URLSearchParams(fixture.launches[platform]);
   await page.goto(url,{waitUntil:'domcontentloaded',referer:platform==='ok'?'https://ok.ru/':'https://vk.com/'});
   try{await page.waitForFunction(()=>window._preloaderHiddenFired&&window.udata&&window.iface,null,{timeout:120000});}
   catch(e){console.log(JSON.stringify({platform,errors,failed,state:await page.evaluate(()=>({text:document.body.innerText.slice(-250),udata:!!window.udata,iface:!!window.iface,platform:window.platformRuntime?.platform}))}));throw e;}
   if(await page.evaluate(()=>platformRuntime.platform)!==platform)throw new Error('Wrong platform');
   let leaked=0;const diagnosticListener=m=>{if(m.text().includes('PRIVATE_DIAGNOSTIC_PROBE'))leaked++};
   page.on('console',diagnosticListener);
   await page.evaluate(()=>{for(const method of ['log','warn','error','info','debug'])console[method]('PRIVATE_DIAGNOSTIC_PROBE')});
   await page.waitForTimeout(100);page.off('console',diagnosticListener);
   if(leaked)throw new Error('Diagnostics leaked to a non-developer fixture');
   const cards=await page.evaluate(async()=>{
    const ranks=['семерка','восьмерка','девятка','десятка','валет','дама','король','туз'];
    for(const rank of ranks){const url='./images/карта ранг '+rank+'.png';const r=await fetch(url);if(!r.ok)throw new Error('Missing card: '+rank);PIXI.Texture.from(url)}
    return ranks.length;
   });
   console.log(JSON.stringify({platform,privateDiagnostics:'passed',blackjackCards:cards}));
   const resources=await page.evaluate(async()=>{
    const urls=[],original=PIXI.Texture.from;
    PIXI.Texture.from=function(url,...rest){urls.push(url);return original.call(this,url,...rest)};
    try{zone._preloadLocationAssets()}finally{PIXI.Texture.from=original}
    const bad=[];for(const url of urls){const r=await fetch(url);if(!r.ok)bad.push({url,status:r.status})}
    return {checked:urls.length,bad};
   });
   if(resources.bad.length)throw new Error(JSON.stringify(resources));
   console.log(JSON.stringify({platform,locationPreload:resources.checked,missing:resources.bad}));
   const locations=await page.evaluate(()=>{
    hata.open();const result=[];
    for(const [id,title,file] of [[6,'СТАНЦИЯ','хата фон станция.png'],[7,'ЗАПРАВКА','хата фон заправка.png']]){
     hata._idx=id;hata._render();
     if(hata._titleTxt.text!=='ЛОКАЦИЯ : '+title)throw new Error('Wrong location title');
     if(hata._bgSpr.texture!==PIXI.Texture.from('./images/'+file))throw new Error('Wrong location background');
     result.push(title);
    }hata.close();return result;
   });
   await page.evaluate(()=>{shmot._openShmotShop();shmot._shopCat=2;shmot._shopRefresh()});
   await page.waitForFunction(()=>{
    const icons=shmot._shopCont.children.filter(s=>s.texture?.baseTexture?.resource?.url&&/шмот штаны (бродяга|следопыт)\.png/.test(decodeURIComponent(s.texture.baseTexture.resource.url)));
    return icons.length===2&&icons.every(s=>Math.abs(s.height-85)<.01
      &&s.texture.frame.height===s.texture.baseTexture.height
      &&s.texture.frame.width===s.texture.baseTexture.width);
   },null,{timeout:20000});
   console.log(JSON.stringify({platform,locationTitles:locations,compressedPantsHeight:85,fullPantsTexture:true}));
   await page.evaluate(()=>{if(shmot._shopWin.parent)shmot._shopWin.parent.removeChild(shmot._shopWin);iface.popHud('shmot')});
   await page.evaluate(async()=>{udata.nick='Native browser fixture';udata.snd_vol='0.29';await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('save_timeout')),15000);flushPlayerSave('native_browser_fixture',e=>{clearTimeout(timer);e?reject(new Error('save_failed')):resolve()})})});
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window._preloaderHiddenFired&&window.udata&&window.iface,null,{timeout:120000});
   const state=await page.evaluate(()=>({nick:udata.nick,sound:Number(udata.snd_vol),platform:platformRuntime.platform,server:my_server}));
   if(state.nick!=='Native browser fixture'||Math.abs(state.sound-.29)>.001||errors.length||failed.length)throw new Error(JSON.stringify({state,errors,failed}));
   console.log(JSON.stringify({platform,boot:'passed',saveReload:'passed',errors,failed}));await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exit(1)});
