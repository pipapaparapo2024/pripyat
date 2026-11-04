const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');const {findPhpBin}=require('./_php_bin.js');
process.stdout.write(execFileSync(findPhpBin(),['tests/_php_fixtures/ok-payment746.php'],{encoding:'utf8'}));
const src=fs.readFileSync('_client/src/modules/iap.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
(async()=>{
 for(const ok of [true,false]){
    const calls=[];let direct=0;
    const ctx={console:{log(){},warn(){},error(){}},window:{vk_params:{vk_client:ok?'ok':'vk'},FAPI:{initialized:false,UI:{showPayment(){direct++;throw Error('Uninitialised SDK');}}}},FAPI:null,isOk:()=>ok,logOkPayment(){},donuts_info:JSON.parse(fs.readFileSync('server/json/donuts.json','utf8')),bridge:{send:(method,params)=>{calls.push({method,params});return Promise.resolve({success:true});}}};
    vm.runInNewContext(src+';this.buy=startPurchase',ctx);
    await ctx.buy('item8',7,'Рубли'); assert.equal(direct,0);assert.equal(calls.length,1);assert.equal(calls[0].method,'VKWebAppShowOrderBox');assert.equal(calls[0].params.item,ok?'ok_item8':'item8');assert.equal(calls[0].params.type,'item');assert.equal(calls[0].params.price,undefined);
 }
 const entries=[],scope={ok_payment_safe_diagnostics:true,console:{log:(...x)=>entries.push(x)}};
 const ctx={};vm.runInNewContext(fs.readFileSync('_client/src/modules/ok-payment-diagnostics.js','utf8').replace('export function','function')+';this.log=logOkPayment',ctx);
 ctx.log('callback',{callbackData:{error_code:-1,error_message:'UI methods are available only for apps running on OK portal',token:'PRIVATE_TOKEN'}},scope);
 assert.equal(entries[0][1].reason,'sdk_not_initialized');assert(!JSON.stringify(scope.ok_payment_safe_history).includes('PRIVATE_TOKEN'));
 console.log('OK launcher avoids uninitialised FAPI stub; VK dispatch unchanged; safe error history passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
