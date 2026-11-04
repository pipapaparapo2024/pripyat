import texts from '../../../server/json/telegram_bot.json';

export function requestTelegramDesktopFullscreen(app){
    if(!['tdesktop','macos','web','weba','webk'].includes(app.platform)) return false;
    if(typeof app.requestFullscreen!=='function' || (typeof app.isVersionAtLeast==='function' && !app.isVersionAtLeast('8.0')))return false;
    try{
        const result=app.requestFullscreen();
        if(result && typeof result.catch==='function')result.catch(()=>{});
        return true;
    }catch(_){return false;}
}

export function showTelegramWelcome(app){
    app.ready();app.expand();
    return new Promise(resolve=>{
        const overlay=document.createElement('div');
        overlay.id='telegram-welcome';
        overlay.style.cssText='position:fixed;inset:0;z-index:100001;overflow:auto;background:#141510;color:#eee8dc;font:16px/1.5 Arial,sans-serif;padding:24px;box-sizing:border-box;display:flex;align-items:center;justify-content:center';
        const panel=document.createElement('div');panel.style.cssText='max-width:1000px;max-height:100%;overflow:auto;display:flex;flex-wrap:wrap;gap:24px;align-items:center';
        const image=document.createElement('img');image.src='./images/telegram-welcome.jpg';image.alt='Припять';image.style.cssText='width:min(100%,360px);max-height:65vh;object-fit:contain;border-radius:8px;flex:1 1 240px;min-width:0';
        const content=document.createElement('div');content.style.cssText='flex:1 1 300px';
        const title=document.createElement('h1');title.textContent='Добро пожаловать в «Припять»';title.style.cssText='font-size:26px;color:#dbb46a;line-height:1.2';
        const text=document.createElement('div');text.textContent=texts.welcome;text.style.whiteSpace='pre-line';
        const enter=document.createElement('button');enter.dataset.tgEnter='';enter.textContent='Войти в Зону';enter.style.cssText='margin-top:22px;padding:14px 25px;border:1px solid #c8a566;border-radius:6px;background:#77562c;color:#fff;font:bold 17px Arial;cursor:pointer';
        enter.addEventListener('click',()=>{requestTelegramDesktopFullscreen(app);overlay.remove();resolve();},{once:true});
        content.append(title,text,enter);panel.append(image,content);overlay.append(panel);document.body.append(overlay);
    });
}
