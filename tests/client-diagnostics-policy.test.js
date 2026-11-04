const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('_client/src/modules/client-diagnostics-policy.js','utf8').replace(/export /g,'');
const ctx={URLSearchParams};vm.createContext(ctx);vm.runInContext(source,ctx);
for(const uid of ['', '438953352','184138040','3824482690']){
 const win={location:{search:'?vk_user_id='+uid,hostname:'test-pripyat-game.ru'}};
 let calls=0;const output={log(){calls++},warn(){calls++},error(){calls++},info(){calls++},debug(){calls++}};
 ctx.installClientConsolePrivacy(win,output);
 for(const key of Object.keys(output))output[key]('private');
 assert.equal(calls,0,'Other players must not receive diagnostics');
}
const win={location:{search:'?vk_user_id=382448269'}};let calls=0;
const output={log(){calls++}};ctx.installClientConsolePrivacy(win,output);output.log('dev');assert.equal(calls,1);
win.location.search='?vk_user_id=184138040';output.log('private');assert.equal(calls,1);
assert.equal(ctx.canViewClientDiagnostics({location:{search:'?vk_user_id=382448269&vk_client=ok'}}),false);
assert.equal(ctx.canViewClientDiagnostics({__telegramRuntime:{getRoles:()=>['developer']}}),true);
assert.equal(ctx.canViewClientDiagnostics({__telegramRuntime:{getRoles:()=>[]}}),false);
const entry=fs.readFileSync('_client/src/index.js','utf8');
assert(entry.indexOf('installClientConsolePrivacy(window, console)')<entry.indexOf("console.log('%c"),'Gate precedes startup banner');
console.log('Диагностика: точный VK ID, запрет другим игрокам, ранний запуск, роли Telegram проверены');
