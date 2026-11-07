const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('_client/src/modules/site-payments.js','utf8').replace('export function','function');
const storage=new Map(),events={},calls=[];let opened=0,create,settled='pending';
const popup={opener:{},closed:false,location:{replace(url){this.url=url;}},close(){this.closed=true;}};
const context={Promise,Uint8Array,crypto:{getRandomValues:b=>b.fill(1)},document:{hidden:false},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setInterval:()=>1,clearInterval(){},window:{location:{href:'https://pripyat-game-site.ru/game/'},open(){opened++;return popup;},addEventListener:(e,fn)=>events[e]=fn,removeEventListener(){},TS:{php(method,params,done){calls.push(method);if(method==='sitepayments.create'){assert.equal(opened,1);create=done;}else if(method==='sitepayments.status')done({status:settled});else done({});}}}};
vm.runInNewContext(source+';installSitePayments(true);',context);
(async()=>{
 const purchase=context.window.__sitePurchase('item0');
 assert.equal(context.window.location.href,'https://pripyat-game-site.ru/game/');
 create({confirmation_url:'https://yoomoney.ru/checkout/test',order_id:'order-1'});assert.equal(await purchase,true);
 assert.equal(popup.location.url,'https://yoomoney.ru/checkout/test');assert.equal(popup.opener,null);
 assert.equal(context.window.location.href,'https://pripyat-game-site.ru/game/');
 settled='credited';events.focus();assert.ok(calls.includes('users.get'));assert.equal(storage.has('pripyat-site-payment'),false);
 context.window.open=()=>null;const before=calls.length;assert.equal(await context.window.__sitePurchase('item0'),false);assert.equal(calls.length,before);
 assert.ok(fs.readFileSync('website/app/sitepayments.php','utf8').includes("'return_url'=>'https://pripyat-game-site.ru/payment/'"));
 console.log('Site checkout: separate tab, unchanged game URL, balance refresh and popup-block protection passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
