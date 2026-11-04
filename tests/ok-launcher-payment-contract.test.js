const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{findPhpBin}=require('./_php_bin.js');
const php=findPhpBin(),contract=JSON.parse(fs.readFileSync('tests/_fixtures/ok-launcher-payment-contract.json','utf8'));
const runtimeSource=fs.readFileSync('_client/src/modules/platform-runtime.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
const iapSource=fs.readFileSync('_client/src/modules/iap.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
const prices=JSON.parse(fs.readFileSync('server/json/donuts.json','utf8'));
(async()=>{
 assert(contract.miniAppRegistryClasses.includes(contract.orderBoxClass));
 assert(!contract.miniAppRegistryClasses.includes(contract.openPayFormClass));
 let cancelled=false,polls=0,calls=0;
 const handler=vm.runInNewContext('({async handle(e,t){'+contract.legacyOrderBox+'},createResult(data){return data},createFailed(e){return e}})',{oo:{UI:{async openVkMiniAppPayment(name,code,price){assert.equal(name,'item');assert.equal(price,null);if(cancelled)throw Error('cancel');}}}});
 // Official protocol: SDK sends only SKU; a signed POST retrieves its price from the real callback.
 const products=[];let id=0;
 for(const currency of ['stew','coins','cigarettes'])for(const [i,count] of prices[currency].default.entries())products.push({id:id++,price:prices[currency].price_ok[i],name:count+' '+currency});
 [20,49,70,140,280,420,595,840].forEach((price,i)=>products.push({id:100+i,price,name:'Energy '+i}));
 let current;
 const bridge={async send(method,data){
  calls++;assert.equal(method,'VKWebAppShowOrderBox');assert.deepEqual(JSON.parse(JSON.stringify(data)),{type:'item',item:'ok_item'+current.id});
  const reply=JSON.parse(execFileSync(php,['tests/_php_fixtures/native-prod-catalog.php','site-ok-app',String(current.id),data.item],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  assert(reply.response);assert.equal(reply.response.price,current.price);assert.equal(reply.response.item_id,data.item);assert(reply.response.title.length>0);
  return handler.handle(data);
 }};
 const rt={detectPlatform:()=> 'ok',isVk:()=>false,window:{}};vm.runInNewContext(runtimeSource+';this.create=createVkOkRuntime',rt);
 for(const useRuntime of [false,true]){
  const context={Promise,console:{log(){},warn(){},error(){}},isOk:()=>true,logOkPayment(){},bridge,donuts_info:prices,window:{vk_params:{vk_client:'ok'},bank:{_refreshBalanceAfterPurchase(){polls++;}}}};
  if(useRuntime)context.window.platformRuntime=rt.create({bridge,launchParams:{vk_client:'ok'}});
  vm.runInNewContext(iapSource+';this.buy=startPurchase',context);
  for(const product of products){current=product;await context.buy('item'+product.id,product.price,product.name);}
  const before=polls;cancelled=true;current=products[0];await context.buy('item0',7,'Cancelled');cancelled=false;assert.equal(polls,before);
 }
 assert.equal(calls,66);assert.equal(polls,64);
 console.log('OK official SDK + signed site=OK POST: 32 real catalog prices, native identity, runtime/fallback and cancellation checked without DB writes');
})().catch(e=>{console.error(e);process.exitCode=1});
