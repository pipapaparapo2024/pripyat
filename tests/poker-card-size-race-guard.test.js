/**
 * Test: защита от "гонки" при асинхронной обрезке карты покера по содержимому.
 *
 * getTrimmedCardTexture() (dvor-poker-card-trim.js) читает пиксели картинки через
 * canvas — это происходит не мгновенно (ждём загрузки текстуры + сканирование).
 * Если за это время карта в данном слоте успела смениться (быстрый повторный swap),
 * коллбэк не должен применить устаревший результат к уже другой карте.
 *
 * Фикс:
 *  1) applySize() выставляется СРАЗУ (best-effort), не дожидаясь обрезки — карта не
 *     остаётся пустой, пока считаются пиксели.
 *  2) Каждый вызов _updatePokerCardVisual метит спрайт своим "поколением" (_pokerGen).
 *     Коллбэк getTrimmedCardTexture() перед применением сверяет поколение — если оно
 *     изменилось (эта же карта в слоте успела смениться), результат отбрасывается.
 *
 * Run: node tests/poker-card-size-race-guard.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const screenSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-poker-screen.js'), 'utf-8'
);
const trimSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-poker-card-trim.js'), 'utf-8'
);

// ── Test 1: dvor-poker-screen.js подключает и использует getTrimmedCardTexture ──
console.log('\nTest 1: _updatePokerCardVisual использует getTrimmedCardTexture из отдельного модуля');
{
    assert(/import \{ getTrimmedCardTexture \} from '\.\/dvor-poker-card-trim\.js';/.test(screenSrc),
        'импорт getTrimmedCardTexture есть');
    const m = screenSrc.match(/proto\._updatePokerCardVisual = function\(idx\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_updatePokerCardVisual найден');
    if (m) {
        const body = m[1];
        assert(/const myGen = \(spr\._pokerGen = \(spr\._pokerGen \|\| 0\) \+ 1\);/.test(body),
            'каждый вызов метит спрайт новым поколением (myGen)');
        assert(/spr\.texture = tex;\s*\n\s*applySize\(\);/.test(body),
            'best-effort: текстура и размер применяются сразу, не дожидаясь обрезки');
        assert(/getTrimmedCardTexture\(tex, \(trimmedTex\) => \{/.test(body),
            'обрезка запрашивается асинхронно через getTrimmedCardTexture');
        assert(/if\(spr\._pokerGen !== myGen\) return; \/\/ карта сменилась, пока считали обрезку/.test(body),
            'коллбэк обрезки проверяет поколение перед применением (защита от гонки)');
    }
}

// ── Test 2: applySize сам по себе тоже сверяет поколение ─────────────────────
console.log('\nTest 2: applySize() внутри тоже проверяет поколение (используется дважды — сразу и после обрезки)');
{
    const m = screenSrc.match(/const applySize = \(\) => \{([\s\S]*?)\n\s{12}\};/);
    assert(!!m, 'applySize найден');
    if (m) {
        assert(/if\(spr\._pokerGen !== myGen\) return;/.test(m[1]), 'applySize проверяет spr._pokerGen === myGen');
    }
}

// ── Test 3: dvor-poker-card-trim.js кэширует результат по URL и ждёт загрузки ──
console.log('\nTest 3: getTrimmedCardTexture кэширует по url и ждёт загрузки текстуры перед сканированием');
{
    assert(/export function getTrimmedCardTexture\(tex, onReady\)\{/.test(trimSrc), 'функция экспортирована');
    assert(/if\(_trimCache\.has\(url\)\)\{/.test(trimSrc), 'проверяет кэш перед повторным сканированием пикселей');
    assert(/if\(tex\.baseTexture\.valid\) _finish\(\);/.test(trimSrc) &&
           /tex\.baseTexture\.once\('loaded', _finish\);/.test(trimSrc),
        'сканирует сразу если текстура уже валидна, иначе ждёт \'loaded\'');
    assert(/tex\.baseTexture\.once\('error', \(\) => \{ _trimCache\.set\(url, null\); onReady\(tex\); \}\);/.test(trimSrc),
        'при ошибке загрузки откатывается на исходную (необрезанную) текстуру, не падает');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
