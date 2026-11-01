const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={};vm.runInNewContext(fs.readFileSync('_client/src/modules/ok-payment-diagnostics.js','utf8').replace('export function','function')+';this.log=logOkPayment',ctx);
const lines=[],scope={ok_payment_safe_diagnostics:false,console:{log:(...args)=>lines.push(args)}};
ctx.log('buy-click',{item:8,price:7},scope);assert.equal(lines.length,0,'VK produces no new logs');
scope.ok_payment_safe_diagnostics=true;
ctx.log('buy-click',{item:8,price:7,token:'secret',sign:'secret',uid:123,result:'token=secret',fapi:true},scope);
assert.equal(lines.length,1);const output=JSON.stringify(lines);assert(!output.includes('secret'));assert(!output.includes('uid'));assert(output.includes('buy-click'));assert.equal(lines[0][1].item,8);
console.log('Safe OK diagnostics: VK silent, allowlist enforced, tokens/signatures/user IDs excluded');
for(const [data,category,code] of [['cancel','cancel',undefined],['{"error_code":104,"token":"SECRET_VALUE","error_msg":"SECRET_VALUE"}','unknown',104],[{error_data:{error_code:12,sign:'SECRET_VALUE'},error_type:'access_denied'},'access_denied',12],['SECRET_VALUE','unknown',undefined],[{code:587256562321,uid:587256562321},'unknown',undefined],[null,'unknown',undefined]]){
    ctx.log('callback',{method:'showPayment',result:'error',callbackData:data},scope);
    const record=lines.at(-1)[1];assert.equal(record.category,category);assert.equal(record.errorCode,code);assert(!JSON.stringify(record).includes('SECRET_VALUE'));assert(!JSON.stringify(record).includes('587256562321'));
}
const calls=[];const vkScope={isOk:()=>false,window:{},console:{log(){}},bridge:{send:(...args)=>calls.push(args)},logOkPayment:()=>{throw new Error('VK must not enter OK diagnostics');}};
vm.runInNewContext(fs.readFileSync('_client/src/modules/iap.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function')+';this.buy=startPurchase',vkScope);
vkScope.buy('item8',7,'Товар');assert.equal(calls.length,1);assert.equal(calls[0][0],'VKWebAppShowOrderBox');assert.equal(calls[0][1].item,'item8');assert.equal(calls[0][1].type,'item');
console.log('VK purchase still dispatches the original Bridge method without OK SDK or diagnostics');
