import {createSiteRuntime} from './modules/site-runtime.js';
import SiteServer from './modules/site-server.js';
import {openSiteFriends} from './modules/site-friends-ui.js';
import siteRubCatalog from '../../server/json/site_prices.json';
import {installSitePayments} from './modules/site-payments.js';
(async()=>{
 const status=await fetch('/auth/status',{cache:'no-store'}).then(r=>r.json());
 if(!status.authenticated)throw new Error('Сначала войдите на сайт.');
 const r=await fetch('/auth/bootstrap',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:status.csrf,...Object.fromEntries([...new URLSearchParams(location.search)].filter(([k])=>['reward','platform'].includes(k)))})});
 const session=await r.json();
 if(!r.ok||!['site','vk','ok'].includes(session.platform)||!['test','prod'].includes(session.environment)||!/^[1-9][0-9]{0,9}$/.test(session.player_id)||!(session.platform==='site'?/^[a-f0-9]{64}$/:/^[a-f0-9]{32}$/).test(session.token)||!/^[a-f0-9]{32}$/.test(session.req_key))throw new Error('Не удалось подтвердить вход.');
 window.__siteRuntime=createSiteRuntime(session);window.__siteServer=new SiteServer(session,location.origin+'/server');
 if(session.platform!=='site'){window.__siteRuntime=Object.freeze({...window.__siteRuntime,platform:session.platform});window.__siteServer.scriptURL=location.origin+'/server/social-api.php';}
 window.openSiteFriends=openSiteFriends;
 window.siteRubCatalog=siteRubCatalog;
 installSitePayments(session.payments_enabled===true,session.platform+'-'+session.player_id+'-'+(session.payment_mode==='live'?'live':'test'));
 if(typeof BroadcastChannel==='function'){
  const channel=new BroadcastChannel('pripyat-website-'+session.platform+'-player-'+session.player_id);
  channel.onmessage=event=>{
   if(event.data!=='new-game-session')return;
   window.onboarding?._stopNarration?.();window.PIXI?.sound?.stopAll?.();window.PIXI?.sound?.muteAll?.();
   const notice=document.createElement('div');notice.textContent='Игра открыта в другой вкладке. Продолжайте там или обновите эту страницу.';
   notice.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#171d1d;color:#eee;font:20px Arial;text-align:center';document.body.append(notice);
  };
  channel.postMessage('new-game-session');window.addEventListener('pagehide',()=>channel.close(),{once:true});
 }
 const unavailable=()=>Promise.reject(new Error('Функция недоступна на сайте.'));
 window.vkBridge={send:unavailable,sendPromise:unavailable,subscribe(){},supports:()=>false};window.bridge=window.vkBridge;
 await import('./index.js');
 if(window.onPreloaderHidden)window.onPreloaderHidden(()=>window.__siteCheckPayment?.());
})().catch(error=>{
 const box=document.createElement('div');box.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#171b1c;color:#eee;display:grid;place-content:center;padding:24px;font:18px Arial';
 const p=document.createElement('p');p.textContent=error.message;const a=document.createElement('a');a.href='/account/';a.textContent='Вернуться ко входу';a.style.color='#d9c598';box.append(p,a);document.body.append(box);
});
