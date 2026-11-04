const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('_client/src/modules/iap.js','utf8');const fn=source.slice(source.indexOf('export function startPurchase(')).replace('export function','function');
let calls=0,popups=0;const ctx={Promise,isOk:()=>false,window:{__closedNativeProd:true,__nativeProdPayments:{vk:false,ok:false},iface:{_showRewardPopup(){popups++}}},_startVkPurchase(){calls++;return 'vk'},_startOkPurchase(){calls++;return 'ok'}};
vm.createContext(ctx);vm.runInContext(fn,ctx);
(async()=>{
 assert.equal(await ctx.startPurchase('item0',1,'test'),false);assert.equal(calls,0);
 ctx.isOk=()=>true;assert.equal(await ctx.startPurchase('item0',1,'test'),false);assert.equal(calls,0);assert.equal(popups,2);
 ctx.window.__nativeProdPayments.vk=true;ctx.isOk=()=>false;assert.equal(ctx.startPurchase('item0',1,'test'),'vk');assert.equal(calls,1);
 ctx.isOk=()=>true;assert.equal(await ctx.startPurchase('item0',1,'test'),false);assert.equal(calls,1);
 ctx.window.__nativeProdPayments.ok=true;assert.equal(ctx.startPurchase('item0',7,'test'),'ok');assert.equal(calls,2);
 ctx.window.__nativeProdPayments.vk=false;assert.equal(ctx.startPurchase('item0',7,'test'),'ok');assert.equal(calls,3);
 console.log('Закрытый PROD: кнопки обеих оплат выключены по умолчанию, VK не открывает OK');
})().catch(e=>{console.error(e);process.exit(1)});
