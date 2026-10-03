/**
 * Test: 28.09.2026 — блокер №1 адаптива под мобильные ("Не сделано" в AGENTS.md, п.1)
 * закрыт вариантом A: форс-ландшафт + экран "поверните устройство" (канвас прятался, показывался
 * статичный оверлей-заглушка).
 *
 * 03.10.2026 (по прямому указанию — "пусть игра сама разворачивает экран в горизонт, а не через
 * кнопку поворота"): вариант A заменён на настоящий форс-поворот — канвас на портретном мобильном
 * поворачивается через CSS transform:rotate(), подогнанный под доступное пространство с учётом
 * поворота (modules/forced-landscape.js). 18.09/28.09.2026 CSS-поворот не использовался именно
 * из-за бага с кликами (PIXI InteractionManager линейно масштабирует координаты через
 * getBoundingClientRect, ничего не зная о повороте) — теперь решено собственной реализацией
 * mapPositionToPoint, которая аналитически обращает сам поворот.
 *
 * Run: node tests/mobile-force-landscape-rotate-overlay.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf-8');

const forcedLandscape = R('_client', 'src', 'modules', 'forced-landscape.js');
const overlay = R('_client', 'src', 'modules', 'rotate-overlay.js');
const index   = R('_client', 'src', 'index.js');
const claude  = R('AGENTS.md');

console.log('\nTest 1: modules/forced-landscape.js — подгонка размера и позиции повёрнутого канваса');
{
    assert(/export const ROTATE_DEG = 90;/.test(forcedLandscape), 'направление поворота вынесено в константу (по умолчанию 90)');
    assert(/export function fitRotatedSize\(vp\)\{/.test(forcedLandscape), 'fitRotatedSize экспортирована');
    assert(/let w = vp\.h, h = vp\.w;/.test(forcedLandscape),
        'fit считается по ПЕРЕСТАВЛЕННЫМ местами измерениям (альбомная раскладка внутри портретного экрана)');
    assert(/export function applyRotatedCanvasStyle\(canv, vp\)\{/.test(forcedLandscape), 'applyRotatedCanvasStyle экспортирована');
    assert(/canv\.style\.transform = 'rotate\(' \+ ROTATE_DEG \+ 'deg\)';/.test(forcedLandscape),
        'канвас реально поворачивается через CSS transform (а не просто прячется)');
    assert(/canv\.style\.transformOrigin = 'center center';/.test(forcedLandscape),
        'поворот вокруг центра — упрощает математику обратного пересчёта кликов');
    assert(/export function clearRotatedCanvasStyle\(canv\)\{/.test(forcedLandscape), 'есть функция снятия поворота для обычного (ландшафтного) режима');
}

console.log('\nTest 2: modules/forced-landscape.js — свой mapPositionToPoint чинит клики под поворотом');
{
    assert(/export function mapPositionToPointRotated\(canv\)\{/.test(forcedLandscape), 'mapPositionToPointRotated экспортирована (фабрика, принимает canv)');
    assert(/const rect = canv\.getBoundingClientRect\(\);/.test(forcedLandscape), 'берёт реальный bounding box повёрнутого канваса');
    assert(/if\(ROTATE_DEG === 90\)\{ u = relY; v = 1 - relX; \}/.test(forcedLandscape),
        'формула для +90°: обращает поворот (не линейно масштабирует экранные X/Y как есть)');
    assert(/point\.x = u \* 1280;/.test(forcedLandscape) && /point\.y = v \* 720;/.test(forcedLandscape),
        'результат — сразу в логических координатах сцены (1280×720), без зависимости от renderer.resolution');
}

console.log('\nTest 3: index.js — resize() поворачивает канвас вместо того, чтобы прятать его');
{
    assert(/import \{ applyRotatedCanvasStyle, clearRotatedCanvasStyle, mapPositionToPointRotated \} from '\.\/modules\/forced-landscape\.js';/.test(index),
        'модуль форс-ландшафта импортирован в точке входа');
    assert(!/installRotateOverlay\(\);/.test(index), 'installRotateOverlay() больше не вызывается при старте');

    assert(/const needsRotate = window\.isMobile && vp\.portrait;/.test(index),
        'решение о повороте — именно isMobile (не десктоп в узком окне браузера) И portrait');
    assert(/canv\.style\.display = 'block';/.test(index),
        'канвас больше НЕ прячется на портретном мобильном — он поворачивается, а не скрывается');
    assert(/if\(needsRotate\)\{\s*\n\s*\(\{ w, h \} = applyRotatedCanvasStyle\(canv, vp\)\);/.test(index),
        'в режиме needsRotate канвас реально поворачивается через applyRotatedCanvasStyle');
    assert(/clearRotatedCanvasStyle\(canv\);/.test(index),
        'в обычном режиме поворот явно снимается (на случай переключения портрет→ландшафт на лету)');

    assert(/ia\.mapPositionToPoint = mapPositionToPointRotated\(canv\);/.test(index),
        'повёрнутый обработчик кликов устанавливается в interaction.mapPositionToPoint');
    assert(/ia\.mapPositionToPoint = ia\._defaultMapPositionToPoint;/.test(index),
        'штатный обработчик кликов PIXI возвращается обратно, когда поворот не нужен');

    assert(/const ratio = 1280 \/ 720;/.test(index), 'логический размер сцены остался 1280×720 (форс-ландшафт вёрстку не меняет)');
}

console.log('\nTest 4: modules/rotate-overlay.js — оставлен в репозитории, но помечен неиспользуемым');
{
    assert(/БОЛЬШЕ НЕ ИСПОЛЬЗУЕТСЯ/.test(overlay), 'файл явно помечен как неактуальный в заголовке');
    assert(/export function installRotateOverlay/.test(overlay) && /export function setRotateOverlay/.test(overlay),
        'сами функции не удалены (можно откатиться без восстановления файла из истории)');
}

console.log('\nTest 5: AGENTS.md — пункт "Ориентация экрана" отражает замену на форс-поворот');
{
    assert(/03\.10\.2026\s+заменён на настоящий форс-ландшафт/.test(claude.replace(/\s+/g, ' ')),
        'статус в AGENTS.md обновлён: вариант A отмечен как заменённый форс-поворотом');
    assert(/modules\/forced-landscape\.js/.test(claude), 'AGENTS.md ссылается на новый модуль');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
