const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
(async()=>{
 const fixtures=JSON.parse(fs.readFileSync(0,'utf8'));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const [uid,launch] of Object.entries(fixtures)){
   const page=await browser.newPage({viewport:{width:1280,height:720}});let probes=0,gameLogs=0,apiCalls=0,gameBundleRequests=0;
   page.on('console',m=>{if(m.text().includes('GAME_DIAGNOSTIC_PRIVACY_PROBE'))probes++;if(m.text().startsWith('['))gameLogs++});
   page.on('request',r=>{if(r.url().includes('/libs/index.js'))gameBundleRequests++});
   await page.route(url=>!['127.0.0.1','localhost'].includes(url.hostname),r=>r.abort());
   await page.route('**/libs/browser.min.js',r=>r.fulfill({contentType:'application/javascript',body:`window.vkBridge={subscribe(){},supports(){return false},send(m,p){return this.sendPromise(m,p)},sendPromise(m,p){if(m==='VKWebAppGetUserInfo')return Promise.resolve({id:${uid},first_name:'Console',last_name:'Verification',photo_50:''});if(m==='VKWebAppGetAuthToken')return Promise.reject({error_type:'client_error',error_data:{error_code:4}});return Promise.resolve({result:true});}};`}));
   await page.route('**/fapi5.js',r=>r.fulfill({contentType:'application/javascript',body:'/* SDK not exercised in console test. */'}));
   await page.route(url=>url.pathname.startsWith('/server/')&&url.pathname.endsWith('.php'),r=>{apiCalls++;return r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({status:'error',code:47,maintenance:true,text:'API blocked for read-only console verification'})})});
   await page.goto(process.env.PRIPYAT_CLOSED_PROD_URL+'/client/ver0_41/?'+new URLSearchParams(launch),{waitUntil:'domcontentloaded'});
   if(uid==='42'){
    assert((await page.locator('h1').textContent()).includes('Идут технические работы'));assert.equal(gameBundleRequests,0);assert.equal(apiCalls,0);
    console.log(JSON.stringify({uid,ordinaryPlayerMaintenance:true,gameBundleRequests,apiCalls}));
   }else{
    await page.waitForFunction(()=>window.vk_params&&window.__closedNativeProd===true,null,{timeout:20000});
    assert.equal(await page.evaluate(()=>window.__nativeProdDevDiagnostics),uid==='382448269','Owner-only panel diagnostics flag');
    assert.equal(await page.evaluate(()=>window.debug_mode),false,'TEST-only tools must remain off');
    await page.evaluate(()=>{for(const method of ['log','warn','error','info','debug'])console[method]('[GAME_DIAGNOSTIC_PRIVACY_PROBE]',method)});
    await page.waitForTimeout(150);assert.equal(probes,uid==='382448269'?5:0);
    if(uid!=='382448269')assert.equal(gameLogs,0,'Diagnostic logs exposed to another account');
    console.log(JSON.stringify({uid,diagnosticProbeMessages:probes,ownerOnlyPolicy:'passed',testToolsOff:true,gameApiMocked:true}));
   }
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exit(1)});
