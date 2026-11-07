const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('_client/src/modules/telegram-layout.js','utf8').replace(/export /g,'');const ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);
for(const [w,h] of [[1920,1080],[1280,720],[1024,768],[3840,2160]]){const v={w,h,left:12,top:8};const r=ctx.telegramGameViewport(v);assert(r.w<=1120);assert(Math.abs(r.w/r.h-16/9)<1e-10);assert(r.left>=v.left&&r.top>=v.top);assert(r.left+r.w<=v.left+w);}
const phone={w:390,h:844,left:0,top:0};assert.strictEqual(ctx.telegramGameViewport(phone,true),phone);console.log('Telegram layout: geometry passed');

let injected;ctx.document={createElement:()=>({}),head:{appendChild:s=>injected=s.textContent}};ctx.installTelegramBackdrop();assert(injected.includes('rgba(0,0,0,.78)'));
