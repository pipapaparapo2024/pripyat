// Compiled PROD bundle + pinned real Launcher consumer. No real SDK or game API calls.
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
(async()=>{
 const fixtures=JSON.parse(fs.readFileSync(0,'utf8'));
 const contract=JSON.parse(fs.readFileSync('tests/_fixtures/ok-launcher-payment-contract.json','utf8'));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const [world,launch] of Object.entries(fixtures)){
   const page=await browser.newPage({viewport:{width:1280,height:720}});
   await page.route(url=>!['127.0.0.1','localhost'].includes(url.hostname),r=>r.abort());
   await page.route('**/libs/browser.min.js',r=>r.fulfill({contentType:'application/javascript',body:`window.__paymentProbe=[];window.vkBridge={subscribe(){},supports(){return false},send(method,params){if(method==='OKWebAppOpenPayForm'||method==='VKWebAppShowOrderBox')window.__paymentProbe.push({method,params});return Promise.resolve({success:true})},sendPromise(m,p){return this.send(m,p)}};`}));
   await page.route('**/fapi5.js',r=>r.fulfill({contentType:'application/javascript',body:'/* real SDK deliberately blocked */'}));
   await page.route(url=>url.pathname.startsWith('/server/')&&url.pathname.endsWith('.php'),r=>r.fulfill({status:403,contentType:'application/json',body:'{"status":"error","code":47}'}));
   await page.goto(process.env.PRIPYAT_CLOSED_PROD_URL+'/client/ver0_41/?'+new URLSearchParams(launch),{waitUntil:'domcontentloaded',referer:world==='ok'?'https://ok.ru/':'https://vk.com/'});
   await page.waitForFunction(()=>window.platformRuntime,null,{timeout:20000});
   const result=await page.evaluate(async world=>{
    await window.platformRuntime.startNativePurchase(world==='ok'?'ok_item6':'item6',{name:'2000 тушенок',price:3500});
    return {world:window.platformRuntime.platform,probe:window.__paymentProbe};
   },world);
   assert.equal(result.world,world);assert.equal(result.probe.length,1);assert.equal(await page.evaluate(()=>window.__nativeProdDevDiagnostics),true);
   const {method,params}=result.probe[0];
   assert.equal(method,'VKWebAppShowOrderBox');assert.deepEqual(params,{type:'item',item:world==='ok'?'ok_item6':'item6'});
   if(world==='ok')assert(contract.miniAppRegistryClasses.includes(contract.orderBoxClass));
   console.log(JSON.stringify({world,compiledBundleTransport:'passed',documentedOrderBox:true,realSdkBlocked:true,gameApiMocked:true}));await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exit(1)});
