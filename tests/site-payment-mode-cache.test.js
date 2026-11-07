const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('_client/src/modules/site-payments.js','utf8').replace('export function','function');
const saved=new Map();let created=0,opened='';
function run(scope){
 const c={Promise,Uint8Array,crypto:{getRandomValues:a=>a.fill(1)},document:{hidden:false},setInterval:()=>1,clearInterval(){},sessionStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},window:{open:()=>({opener:null,closed:false,location:{replace(url){opened=url}},close(){}}),addEventListener(){},removeEventListener(){},TS:{php(method,p,cb){if(method==='sitepayments.create'){created++;cb({order_id:scope,confirmation_url:'https://yoomoney.ru/checkout/'+scope})}else cb({status:'pending'});}}}};
 vm.runInNewContext(code+';installSitePayments(true,'+JSON.stringify(scope)+');',c);return c.window.__sitePurchase('item100');
}
(async()=>{
 await run('site-1-test');assert.equal(created,1);
 await run('site-1-live');assert.equal(created,2);assert( opened.endsWith('site-1-live'),'Боевой режим открыл тестовую ссылку');
 await run('site-1-live');assert.equal(created,2,'Повтор того же боевого товара не переиспользовал заказ');
 console.log('Кеш оплаты разделён по режимам: тестовая ссылка не используется после перехода на live');
})().catch(e=>{console.error(e);process.exitCode=1});
