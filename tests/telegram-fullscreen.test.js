const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('_client/src/modules/telegram-welcome.js','utf8');
const fn=src.slice(src.indexOf('export function requestTelegramDesktopFullscreen'),src.indexOf('export function showTelegramWelcome')).replace('export ','');
const c={};vm.createContext(c);vm.runInContext(fn,c);
for(const platform of ['tdesktop','macos','web','weba','webk']){
    let calls=0;assert(c.requestTelegramDesktopFullscreen({platform,requestFullscreen:()=>calls++,isVersionAtLeast:v=>v==='8.0'}));assert.equal(calls,1);
}
let mobileCalls=0;assert.equal(c.requestTelegramDesktopFullscreen({platform:'android',requestFullscreen:()=>mobileCalls++}),false);assert.equal(mobileCalls,0);
assert.equal(c.requestTelegramDesktopFullscreen({platform:'tdesktop'}),false);
assert.equal(c.requestTelegramDesktopFullscreen({platform:'tdesktop',isVersionAtLeast:()=>false,requestFullscreen(){throw new Error('must not call');}}),false);
assert.equal(c.requestTelegramDesktopFullscreen({platform:'tdesktop',requestFullscreen(){throw new Error('UNSUPPORTED');}}),false);
console.log('Telegram fullscreen: desktop/web, mobile exclusion, old SDK and unsupported client handled');
