const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  fs.mkdirSync(process.env.PRIPYAT_GATE_SCREENSHOT_DIR,{recursive:true});
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:800}});let gameRequests=0;
   page.on('request',r=>{if(/\/libs\/index\.js/.test(r.url())||/\/server\/universal\.php/.test(r.url()))gameRequests++});
   await page.route('**/libs/browser.min.js',r=>r.fulfill({contentType:'application/javascript',body:'window.vkBridge={send:()=>Promise.resolve({})};'}));
   const response=await page.goto(process.env.PRIPYAT_CLOSED_PROD_URL+'/client/ver0_41/?vk_user_id=382448269&sign=forged',{waitUntil:'networkidle'});
   assert.equal(response.status(),200);
   const state=await page.evaluate(()=>({heading:document.querySelector('h1').textContent,canvas:document.querySelectorAll('canvas').length,overflow:document.documentElement.scrollWidth>innerWidth}));
   assert(state.heading.includes('Идут технические работы'));assert.equal(state.canvas,0);assert.equal(state.overflow,false);assert.equal(gameRequests,0);
   const background=await page.evaluate(async()=>{
    if(!getComputedStyle(document.body).backgroundImage.includes('maintenance-background.jpg'))throw new Error('Maintenance background CSS missing');
    return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error('Maintenance background failed'));image.src='/client/ver0_41/images/maintenance-background.jpg'});
   });
   assert(background.width>0&&background.height>0);
   await page.screenshot({path:path.join(process.env.PRIPYAT_GATE_SCREENSHOT_DIR,'closed-prod-'+width+'.png')});
   console.log(JSON.stringify({width,maintenance:'passed',backgroundLoaded:true,gameRequests,...state}));await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exit(1)});
