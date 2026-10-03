/** Принудительный ландшафт на портретном мобильном (03.10.2026, по прямому указанию —
 * "сделай так, чтобы сама игра разворачивала разрешение в горизонтальном положении на
 * мобильной версии, а не через кнопки поворотного окна").
 *
 * 28.09.2026 этот путь уже пробовали и откатили (см. СТАРЫЙ комментарий в rotate-overlay.js):
 * CSS-поворот canvas на 90° ломал координаты кликов PIXI InteractionManager, потому что он
 * считает позицию через getBoundingClientRect() + линейный scale по X/Y, ничего не зная о
 * повороте — под transform:rotate() экранные X/Y перестают совпадать по смыслу с локальными
 * X/Y канваса (после поворота экранная горизонталь соответствует локальной ВЕРТИКАЛИ канваса,
 * не горизонтали). Раньше это просто не чинили — прятали канвас и просили повернуть физически.
 *
 * Здесь — настоящий фикс: свой mapPositionToPoint, который сначала переводит точку в
 * нормализованные 0..1 координаты внутри экранного bounding box (уже отражающего поворот —
 * getBoundingClientRect() ДЛЯ ПОВЁРНУТОГО элемента корректно даёт его axis-aligned bbox), а
 * затем обращает сам поворот аналитически (см. вывод формул в комментариях ниже), а не линейно
 * масштабирует как для неповёрнутого канваса.
 */

// Направление поворота. CSS rotate(90deg) — ПО ЧАСОВОЙ стрелке на экране (y вниз).
// Если после включения физически покажется, что поворачивать телефон удобнее в другую
// сторону — поменять здесь на -90 и ничего больше трогать не нужно (формулы ниже сами учтут).
export const ROTATE_DEG = 90;

// Подгонка 1280×720 в ДОСТУПНОЕ пространство, ресурс которого для альбомной раскладки —
// вертикальный размер портретного экрана (vp.h), а "высота" — его узкая ширина (vp.w).
// Та же формула fit-by-aspect, что и обычный (неповёрнутый) resize() в index.js, просто с
// заранее переставленными местами шириной/высотой на входе.
export function fitRotatedSize(vp){
    const ratio = 1280 / 720;
    let w = vp.h, h = vp.w; // доступное пространство ПОСЛЕ мысленного поворота на 90°
    if(w / h > ratio){ w = h * ratio; } else { h = w / ratio; }
    return { w, h }; // это СВОЙ (неповёрнутый) CSS-размер canvas — после transform:rotate()
                      // на экране он займёт area h×w (оси визуально меняются местами)
}

// Применяет позицию/размер/поворот к канвасу — канвас центрируется в видимой области,
// задаётся его СОБСТВЕННЫЙ (до поворота) CSS-размер, а transform крутит его вокруг центра.
export function applyRotatedCanvasStyle(canv, vp){
    const { w, h } = fitRotatedSize(vp);
    const centerX = vp.left + vp.w / 2;
    const centerY = vp.top + vp.h / 2;
    canv.style.width  = w + 'px';
    canv.style.height = h + 'px';
    canv.style.left   = (centerX - w / 2) + 'px';
    canv.style.top    = (centerY - h / 2) + 'px';
    canv.style.transformOrigin = 'center center';
    canv.style.transform = 'rotate(' + ROTATE_DEG + 'deg)';
    return { w, h };
}

export function clearRotatedCanvasStyle(canv){
    canv.style.transform = '';
    canv.style.transformOrigin = '';
}

// Свой mapPositionToPoint для PIXI 6 InteractionManager — заменяет штатный на время, пока
// канвас повёрнут. Вывод формул (θ = ROTATE_DEG, экранные координаты y-вниз, поворот вокруг
// центра своего же bounding box):
//   relX = (x - rect.left) / rect.width   — 0..1 вдоль экранной горизонтали bbox
//   relY = (y - rect.top)  / rect.height  — 0..1 вдоль экранной вертикали bbox
//   θ=+90 (по часовой): u = relY,     v = 1 - relX
//   θ=-90 (против часовой): u = 1 - relY, v = relX
// где (u,v) — доля вдоль СОБСТВЕННЫХ (неповёрнутых) ширины/высоты канваса, т.е. u*1280/v*720 —
// готовые координаты в логической системе сцены PIXI (сцена всегда 1280×720 независимо от
// renderer.resolution — делить на resolution, в отличие от штатной реализации, не нужно).
export function mapPositionToPointRotated(canv){
    return function(point, x, y){
        const rect = canv.getBoundingClientRect();
        if(!rect.width || !rect.height){ point.x = 0; point.y = 0; return; }
        const relX = (x - rect.left) / rect.width;
        const relY = (y - rect.top) / rect.height;
        let u, v;
        if(ROTATE_DEG === 90){ u = relY; v = 1 - relX; }
        else { u = 1 - relY; v = relX; }
        point.x = u * 1280;
        point.y = v * 720;
    };
}
