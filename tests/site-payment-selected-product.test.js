const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const storage=new Map(),products=[];let create,status;
const popup={opener:null,closed:false,location:{replace(url){this.url=url;}},close(){}};
const c={Promise,Uint8Array,crypto:{getRandomValues:b=>b.fill(2)},document:{hidden:false},setInterval:()=>1,clearInterval(){},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},window:{open:()=>popup,addEventListener(){},removeEventListener(){},TS:{php(method,p,done){if(method==='sitepayments.create'){products.push(p.product_id);create=done;}else if(method==='sitepayments.status')status=done;else done({});}}}};
vm.runInNewContext(fs.readFileSync('_client/src/modules/site-payments.js','utf8').replace('export function','function')+';installSitePayments(true);',c);
(async()=>{
 let request=c.window.__sitePurchase('item102');create({order_id:'old-70',confirmation_url:'https://yoomoney.ru/checkout/70'});await request;
 const oldStatus=status;
 request=c.window.__sitePurchase('item100');assert.equal(products.at(-1),100,'50 energy must create its own order');create({order_id:'new-21',confirmation_url:'https://yoomoney.ru/checkout/21'});await request;assert.equal(popup.location.url,'https://yoomoney.ru/checkout/21');
 oldStatus({status:'credited'});assert.equal(storage.get('pripyat-site-payment'),'new-21','old status cannot erase new order');
 const before=products.length;await c.window.__sitePurchase('item100');assert.equal(products.length,before,'same item resumes its own payment');
 status({status:'pending'});
 for(let i=1;i<8;i++){
  request=c.window.__sitePurchase('item'+(100+i));assert.equal(products.at(-1),100+i);create({order_id:'order-'+i,confirmation_url:'https://yoomoney.ru/checkout/'+i});await request;
  status({status:'pending'});
 }
 storage.delete('pripyat-site-payment-item');request=c.window.__sitePurchase('item107');assert.equal(products.at(-1),107,'legacy cache without item must not be reused');create({order_id:'legacy-replacement',confirmation_url:'https://yoomoney.ru/checkout/new'});await request;
 console.log('Checkout: selected product, eight energy packs, same-item resume, legacy cache and stale status race passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
