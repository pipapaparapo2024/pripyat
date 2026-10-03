/**
 * Test: 03.10.2026 — modules/forced-landscape.js, настоящая проверка геометрии поворота (не
 * просто grep по тексту файла). Раньше (18.09/28.09.2026) CSS-поворот канваса отклонялся именно
 * потому, что PIXI InteractionManager линейно масштабирует экранные X/Y через
 * getBoundingClientRect(), ничего не зная о повороте — клики съезжали. Новый
 * mapPositionToPointRotated() должен АНАЛИТИЧЕСКИ обращать поворот. Проверяем round-trip:
 * берём точку в ЛОКАЛЬНЫХ координатах (неповёрнутого) канваса → считаем, где она окажется на
 * экране ПОСЛЕ поворота (прямое преобразование, та же матрица поворота, что применяет браузер
 * для CSS transform:rotate()) → скармливаем экранную точку обратно в mapPositionToPointRotated()
 * → должны получить ИСХОДНУЮ точку (в логических координатах сцены 1280×720).
 *
 * Run: node tests/forced-landscape-rotation-math-roundtrip.test.js
 */

const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}
function approx(a, b, eps, msg){
    assert(Math.abs(a - b) < eps, msg + ' (got ' + a.toFixed(3) + ', expected ' + b.toFixed(3) + ')');
}

const root = path.join(__dirname, '..');
const srcRaw = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'forced-landscape.js'), 'utf-8');

// Загружаем модуль в sandbox, снимая ESM export — тот же приём, что в
// boss-rating-audio-regressions.test.js (см. AGENTS.md, таблица тестовых стилей).
function loadModule(rotateDeg){
    const src = srcRaw
        .replace('export const ROTATE_DEG = 90;', 'const ROTATE_DEG = ' + rotateDeg + ';')
        .replace(/export function/g, 'function');
    const ctx = { console: { log(){}, warn(){}, error(){} } };
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    return ctx;
}

// Прямое преобразование — то же, что физически делает браузер для CSS transform:rotate(θ)
// вокруг центра элемента, в экранных координатах (y вниз): для точки (dx,dy) относительно
// центра экранное смещение (screen_dx, screen_dy) = (dx·cosθ − dy·sinθ, dx·sinθ + dy·cosθ).
function forwardRotate(lx, ly, w, h, centerX, centerY, deg){
    const rad = deg * Math.PI / 180;
    const dx = lx - w / 2, dy = ly - h / 2;
    const sdx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const sdy = dx * Math.sin(rad) + dy * Math.cos(rad);
    return { x: centerX + sdx, y: centerY + sdy };
}

function runRoundTrip(deg){
    console.log('\nRound-trip при ROTATE_DEG=' + deg + ':');
    const ctx = loadModule(deg);

    const w = 700, h = 394; // типичный "собственный" (неповёрнутый) CSS-размер канваса
    const centerX = 500, centerY = 800; // где центр канваса физически на экране
    // После поворота ±90° bbox: width=h, height=w (оси свопятся) — см. вывод формул в самом
    // модуле. Координаты левого верхнего угла bbox считаются из центра и новых half-extent.
    const rectLeft = centerX - h / 2, rectTop = centerY - w / 2;
    const fakeCanv = {
        getBoundingClientRect(){ return { left: rectLeft, top: rectTop, width: h, height: w }; }
    };
    const mapFn = ctx.mapPositionToPointRotated(fakeCanv);

    // Несколько характерных точек в ЛОКАЛЬНЫХ координатах канваса (до поворота): углы и центр.
    const samples = [
        { lx: 0,     ly: 0,     label: 'верхний левый угол' },
        { lx: w,     ly: 0,     label: 'верхний правый угол' },
        { lx: 0,     ly: h,     label: 'нижний левый угол' },
        { lx: w,     ly: h,     label: 'нижний правый угол' },
        { lx: w / 2, ly: h / 2, label: 'центр' },
        { lx: w * 0.25, ly: h * 0.75, label: 'произвольная внутренняя точка' },
    ];

    samples.forEach(({ lx, ly, label }) => {
        const screen = forwardRotate(lx, ly, w, h, centerX, centerY, deg);
        const point = {};
        mapFn(point, screen.x, screen.y);
        const expectedX = (lx / w) * 1280;
        const expectedY = (ly / h) * 720;
        approx(point.x, expectedX, 0.5, label + ': point.x после round-trip совпадает с исходным (×1280/w)');
        approx(point.y, expectedY, 0.5, label + ': point.y после round-trip совпадает с исходным (×720/h)');
    });
}

runRoundTrip(90);
runRoundTrip(-90);

console.log('\nTest: fitRotatedSize — подгонка 1280×720 в доступное пространство со свопнутыми осями');
{
    const ctx = loadModule(90);
    // Узкий портретный экран 393×852 (iPhone-подобный) — доступное пространство ПОСЛЕ мысленного
    // поворота: "ширина" = 852 (vp.h), "высота" = 393 (vp.w). ratio=1280/720≈1.778.
    // 852/393≈2.168 > 1.778 ⇒ лимитирует высота: h=393, w=393*1.778≈698.67.
    const { w, h } = ctx.fitRotatedSize({ w: 393, h: 852 });
    approx(h, 393, 0.5, 'h = доступная "высота" (vp.w) целиком — экран заполняется по ширине ПОСЛЕ поворота');
    approx(w, 393 * (1280 / 720), 0.5, 'w посчитан через сохранение соотношения сторон 1280:720');
    assert(w < 852, 'итоговый w (неповёрнутая ширина канваса) вписывается в доступные vp.h без обрезки');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
