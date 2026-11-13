// Telegram TEST: общая область игры и прилоудера.
export function telegramGameViewport(vp, mobile = false) {
    if (mobile || vp.w < 1000 || vp.h < 600) return vp;
    const w = Math.min(vp.w * 0.95, vp.h * 16 / 9);
    const h = w * 9 / 16;
    return {...vp, w, h, left: vp.left + (vp.w-w)/2, top: vp.top + (vp.h-h)/2};
}
export function installTelegramBackdrop() {
    const style = document.createElement('style');
    style.textContent = 'body{background:#000!important;isolation:isolate}body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(rgba(0,0,0,.78),rgba(0,0,0,.78)),url("./images/maintenance-background.jpg?v=2") center/cover no-repeat;}';
    document.head.appendChild(style);
}
