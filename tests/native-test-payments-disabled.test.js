const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('_client/src/modules/iap.js','utf8');
const fn=source.slice(source.indexOf('export function startPurchase(')).replace('export function','function');
let shown=0,calls=0;const context={Promise,window:{__nativeTestPaymentsDisabled:true,iface:{_showRewardPopup(){shown++}}},isOk(){calls++;throw new Error('SDK must not run')},_startVkPurchase(){calls++},_startOkPurchase(){calls++}};
vm.createContext(context);vm.runInContext(fn,context);
(async()=>{
 assert.equal(await context.startPurchase('item0',1,'test'),false);assert.equal(shown,1);assert.equal(calls,0);
 context.window.__nativeTestVkPaymentsEnabled=true;context.isOk=()=>false;context._startVkPurchase=()=>{calls++;return 'vk-test'};
 assert.equal(context.startPurchase('item0',1,'test'),'vk-test');assert.equal(calls,1);
 context.isOk=()=>true;assert.equal(await context.startPurchase('item0',1,'test'),false);assert.equal(calls,1);
 console.log('Native TEST: общий запрет, отдельное включение VK и сохранение запрета OK проверены');
})().catch(e=>{console.error(e);process.exit(1)});
