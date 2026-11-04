import {createTelegramRuntime} from './modules/telegram-runtime.js';
import TelegramServer from './modules/telegram-server.js';
import {openTelegramFriends} from './modules/telegram-friends-ui.js';
import {installTelegramDeveloper} from './modules/telegram-developer.js';

(async()=>{
    const status=await fetch('/auth/status',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json());
    if(!status.authenticated)throw new Error('Сначала войдите на сайт через Telegram.');
    const response=await fetch('/auth/bootstrap',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:status.csrf})});
    const session=await response.json();
    if(!response.ok||session.platform!=='telegram'||session.environment!=='test'||!/^[1-9][0-9]{0,9}$/.test(session.player_id)||Number(session.player_id)>2147483647||!/^[a-f0-9]{64}$/.test(session.token)||!/^[a-f0-9]{32}$/.test(session.req_key))throw new Error('Не удалось подтвердить вход. Вернитесь на главную и войдите заново.');
    // Explicit standalone website host. No Telegram SDK, native invoice, or fake initData.
    const host={ready(){},expand(){},onEvent(){}};
    window.__telegramRuntime=createTelegramRuntime(session,host);
    window.__telegramServer=new TelegramServer(session,window.location.origin+'/server');
    window.openTelegramFriends=openTelegramFriends;
    window.__telegramPurchase=()=>Promise.reject(new Error('Оплата на сайте пока отключена.'));
    await installTelegramDeveloper(session.roles||[]);
    const unsupported=()=>Promise.reject(new Error('VK API недоступно при входе через Telegram.'));
    window.vkBridge={send:unsupported,sendPromise:unsupported,subscribe(){},supports:()=>false};window.bridge=window.vkBridge;
    await import('./index.js');
})().catch(error=>{
    const box=document.createElement('div');box.style.cssText='position:fixed;inset:0;background:#171b1c;color:#e5dfcd;z-index:2147483647;display:grid;place-content:center;gap:24px;padding:24px;font:18px Arial;text-align:center';
    const message=document.createElement('p');message.textContent=error.message||'Не удалось войти.';
    const link=document.createElement('a');link.href='/';link.textContent='Вернуться на главную';link.style.color='#d9c598';box.append(message,link);document.body.append(box);
});
