import {installTelegramBackdrop} from './modules/telegram-layout.js';
import {loginTelegramTest} from './modules/telegram-login.js';
import {createTelegramRuntime} from './modules/telegram-runtime.js';
import TelegramServer from './modules/telegram-server.js';
import {showTelegramWelcome} from './modules/telegram-welcome.js';
import {openTelegramFriends} from './modules/telegram-friends-ui.js';
import {installTelegramPayments} from './modules/telegram-payments.js';
import {installTelegramDeveloper} from './modules/telegram-developer.js';
import starsCatalog from '../../server/json/telegram_stars.json';

installTelegramBackdrop();
(async()=>{
    const app=window.Telegram && window.Telegram.WebApp;
    const inviteCode=new URL(window.location.href).searchParams.get('friend')||'';
    const rewardCode=new URL(window.location.href).searchParams.get('reward')||'';
    const session=await loginTelegramTest({webApp:app,endpoint:new URL('./server/telegram-login.php',window.location.href).href,inviteCode,rewardCode});
    window.__telegramRuntime=createTelegramRuntime(session,app);
    window.__telegramServer=new TelegramServer(session,new URL('./server',window.location.href).href);
    window.openTelegramFriends=openTelegramFriends;
    installTelegramPayments(app,starsCatalog,session.environment==='prod'||session.owner_diagnostics===true);
    // Unmigrated UI may still read bridge globals; do not load or call VK SDK.
    const unsupported=()=>Promise.reject(new Error('VK API недоступно в Telegram.'));
    window.vkBridge={send:unsupported,sendPromise:unsupported,subscribe:()=>{},supports:()=>false};
    window.bridge=window.vkBridge;
    await showTelegramWelcome(app);
    await import('./index.js');
    // Owner diagnostics must not delay the game bundle or the preloader.
    window.onPreloaderHidden(() => {
        installTelegramDeveloper(session.roles||[],session.owner_diagnostics===true)
            .catch(error=>console.warn('[telegram] Не удалось открыть диагностику.',error.message));
    });
})().catch(error=>{
    const message=document.createElement('div');
    message.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#171713;color:#eee;display:grid;place-items:center;font:18px Arial;text-align:center;padding:24px';
    message.textContent=error instanceof Error?error.message:'Не удалось войти. Откройте игру заново через @pripyat_game_test_bot.';
    document.body.appendChild(message);
});
