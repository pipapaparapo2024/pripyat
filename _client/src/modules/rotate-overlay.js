/** ⚠️ 03.10.2026: БОЛЬШЕ НЕ ИСПОЛЬЗУЕТСЯ — index.js заменил этот экран на настоящий
 * форс-поворот канваса (CSS transform + свой mapPositionToPoint под клики), см.
 * modules/forced-landscape.js. Файл оставлен на диске на случай отката, но из index.js
 * install/setRotateOverlay() больше не вызываются.
 *
 * ── Историческая версия комментария (28.09.2026 — почему раньше был именно такой экран) ──
 * Экран "поверните устройство" — блокер №1 адаптива под мобильные (см. CLAUDE.md,
 * раздел "Адаптив под мобильные", пункт "Не сделано" -> вариант A, 28.09.2026).
 *
 * Игра нарисована как логический прямоугольник 1280×720 (16:9) и вписывается в экран
 * letterbox'ом с сохранением пропорций (index.js.resize). На портретном телефоне это даёт
 * узкую полосу поперёк экрана (например 393×221 на 393×852) — игра занимает четверть экрана.
 * Правки увеличенных зон нажатия/свайпов не лечат саму полосу — единственное решение
 * продуктового уровня: попросить игрока повернуть телефон. Полный вертикальный редизайн
 * (131+91 вхождений 1280/720 по 95 файлам + новый портретный арт) — отдельная, кратно более
 * дорогая задача, здесь не делается.
 *
 * CSS-поворот канваса на 90° тогда казался неподходящим (баг с кликами 18.09.2026): PIXI
 * InteractionManager считает координаты нажатий через getBoundingClientRect и повёрнутый CSS
 * не учитывает линейно — вся кликабельность съезжает. 03.10.2026 эта проблема решена не отказом
 * от поворота, а собственной реализацией mapPositionToPoint, которая правильно обращает именно
 * поворот (а не просто линейно масштабирует) — см. modules/forced-landscape.js.
 */
export function installRotateOverlay(){
    if(document.getElementById('_rotateOverlay')) return;
    const el = document.createElement('div');
    el.id = '_rotateOverlay';
    el.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;'
        + 'z-index:10000;background:#0a0a0a;color:#e8e0d0;'
        + 'flex-direction:column;align-items:center;justify-content:center;'
        + 'font-family:Arial,sans-serif;text-align:center;padding:24px;box-sizing:border-box;';
    el.innerHTML = '<div style="width:64px;height:64px;margin-bottom:20px;'
        + 'animation:_rotateOverlaySpin 1.6s ease-in-out infinite;">'
        + '<svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="#e8e0d0" stroke-width="1.5">'
        + '<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>'
        + '</svg></div>'
        + '<div style="font-size:18px;line-height:1.4;max-width:320px;">Поверните устройство,'
        + '<br>чтобы играть</div>';
    const style = document.createElement('style');
    style.textContent = '@keyframes _rotateOverlaySpin{'
        + '0%,20%{transform:rotate(0deg)}50%,70%{transform:rotate(-90deg)}100%{transform:rotate(-90deg)}}';
    document.head.appendChild(style);
    document.body.appendChild(el);
}

export function setRotateOverlay(show){
    const el = document.getElementById('_rotateOverlay');
    if(el) el.style.display = show ? 'flex' : 'none';
}
