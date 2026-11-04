const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const index=fs.readFileSync('_client/src/index.js','utf8');
const bootstrap=index.slice(index.indexOf('const _nativeConsole ='),index.indexOf('window.session_hash ='));
const logger=fs.readFileSync('_client/src/modules/ok-payment-diagnostics.js','utf8').replace('export function','function');
const policy=fs.readFileSync('_client/src/modules/client-diagnostics-policy.js','utf8').replace(/export /g,'');
for(const ok of [true,false])for(const debug of [true,false])for(const uid of ['42','1113977365','382448269','438953352','184138040',null]){
 const lines=[];const c={};for(const name of ['log','warn','error','info','debug'])c[name]=(...args)=>lines.push(args);
 const window={debug_mode:debug,location:{search:'?'+new URLSearchParams({...uid?{vk_user_id:uid}:{},...ok?{vk_client:'ok'}:{}}),ancestorOrigins:[]},console:c};
 const ctx={window,document:{referrer:ok?'https://ok.ru/game/fixture':'https://vk.com/appfixture'},console:c,URLSearchParams,isOk:()=>ok};
 vm.runInNewContext(policy+';installClientConsolePrivacy(window,console);'+bootstrap+logger+';this.log=logOkPayment',ctx);
 ctx.log('buy-click',{item:2,price:42,token:'PRIVATE',sign:'PRIVATE'},window);
 const dev=false;assert.equal(window.ok_payment_safe_diagnostics,false);
 if(ok&&!dev){c.log('[iap.API_callback]','PRIVATE');assert.equal(lines.length,0);assert.equal(window.ok_payment_safe_history,undefined);}
 if(ok&&dev){assert.ok(lines.some(x=>x[1]?.stage==='buy-click'));assert(!JSON.stringify(lines).includes('PRIVATE'));}
 if(!ok)assert.equal(window.ok_payment_safe_history,undefined);
 if(!ok){const before=lines.length;c.log('[owner-console-probe]');assert.equal(lines.length-before,uid==='382448269'?1:0,'Owner-only console must work independently of debug_mode');}
}
console.log('OK diagnostics/history closed; VK console limited to the selected account');
