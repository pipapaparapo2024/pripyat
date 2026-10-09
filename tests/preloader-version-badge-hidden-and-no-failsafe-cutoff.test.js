/**
 * Test: батч 27.09.2026 (по прямому указанию, со скриншотом — тёмный экран прелоадера, поверх
 * него в правом верхнем углу видна красная плашка "v508"; плюс "анимация прелоадера играет
 * пару раз и после этого гаснет — появляется чёрный экран, хотя данные могут ещё грузиться").
 *
 * Баг 1: плашка версии (index.js) создавалась и показывалась СРАЗУ при старте скрипта, пряталась
 * через фиксированные 15с от старта — почти всегда попадает на этап прелоадера (реальная
 * загрузка часто дольше 15с). Теперь плашка создаётся скрытой (display:none) и показывается
 * только когда прелоадер реально скрыт — сигнал даёт window._onPreloaderHidden(), вызываемый из
 * preloader-visual.js._remove().
 *
 * Баг 2: 30-секундный "аварийный" таймер в preloader-visual.js раньше ПРИНУДИТЕЛЬНО вызывал
 * _remove() независимо от готовности игры — на медленной сети реальная загрузка легко
 * превышает 30с, а короткий ролик успевал отыграть цикл несколько раз ("пара раз") до этого
 * момента, после чего таймер обрывал видео ДО готовности игры → чёрный экран посреди загрузки.
 * Теперь таймер только логирует диагностику, не убирает прелоадер.
 *
 * 08.10.2026 (по прямому указанию — "замени прелоадер на новый, не зацикливай старый"): видео
 * (preloader.mp4) заменено на Spine-анимацию — цикл 'ended' заменён на Spine-событие 'complete',
 * window._preloaderVideoReady() переименован в window._preloaderVisualReady(). Поведение
 * (не убирать раньше реальной готовности игры, таймер только диагностирует) не изменилось, см.
 * также preloader-video-loops-until-game-ready.test.js.
 *
 * Run: node tests/preloader-version-badge-hidden-and-no-failsafe-cutoff.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const indexSrc     = readSrc('_client/src/index.js');
const preloaderSrc = readSrc('_client/src/modules/preloader-visual.js');

console.log('\nTest 1: index.js — плашка версии создаётся скрытой, а не видимой сразу');
{
    const m = indexSrc.match(/const d = document\.createElement\('div'\);[\s\S]*?document\.body\.appendChild\(d\);/);
    assert(!!m, 'блок создания плашки версии найден');
    const block = m ? m[0] : '';
    assert(/display:none/.test(block), 'КРИТИЧНО: плашка версии создаётся с display:none — не видна сразу при старте скрипта');
}

console.log('\nTest 2: index.js — плашка версии показывается только по сигналу window._onPreloaderHidden()');
{
    const m = indexSrc.match(/window\._onPreloaderHidden = \(\) => \{([\s\S]*?)\n    \};/);
    assert(!!m, 'window._onPreloaderHidden определён');
    const body = m ? m[1] : '';
    assert(/d\.style\.display = 'block';/.test(body), 'показывает плашку (display:block) только внутри колбэка готовности');
    assert(/setTimeout\(\(\)=>\{ d\.style\.display='none'; \}, 15000\);/.test(body),
        'автоскрытие через 15с сохранено, но теперь отсчитывается от момента скрытия прелоадера, а не от старта скрипта');
}

console.log('\nTest 3: preloader-visual.js — _remove() уведомляет index.js через window._onPreloaderHidden()');
{
    const m = preloaderSrc.match(/function _remove\(\)\{([\s\S]*?)\n    \}/);
    assert(!!m, '_remove() найдена');
    const body = m ? m[1] : '';
    assert(/window\._onPreloaderHidden === 'function'/.test(body) && /window\._onPreloaderHidden\(\);/.test(body),
        'КРИТИЧНО: _remove() вызывает window._onPreloaderHidden(), если он определён — иначе плашка версии никогда не появится');
}

console.log('\nTest 4: preloader-visual.js — 30-секундный диагностический таймер БОЛЬШЕ НЕ обрывает цикл принудительно');
{
    const m = preloaderSrc.match(/const _failsafeTid = setTimeout\(\(\) => \{([\s\S]*?)\n    \}, 30000\);/);
    assert(!!m, 'таймер на 30000мс найден');
    const body = m ? m[1] : '';
    assert(!/_remove\(\);/.test(body), 'КРИТИЧНО: таймер больше не вызывает _remove() — прелоадер не гаснет раньше реальной готовности данных');
    assert(/console\.warn/.test(body), 'таймер оставляет диагностику в консоли вместо принудительного скрытия');
}

// 08.10.2026 (тем же днём, ВТОРОЙ Spine-экспорт — см. preloader-visual-remove-on-ready.test.js):
// ожидание 'complete' (границы цикла) само оказалось багом ("анимация не закончится — прелоадер
// держится бесконечно при любой заминке Spine-рантайма") — убрано, window._preloaderVisualReady()
// теперь убирает прелоадер НАПРЯМУЮ, без ожидания границы цикла. window._onPreloaderHidden() (см.
// Test 3 выше) от этого не зависит — вызывается из _remove() независимо от того, КТО её позвал.
console.log("\nTest 5: preloader-visual.js — ожидание границы цикла (Spine 'complete') убрано, прелоадер убирается сразу по сигналу готовности");
{
    assert(!/complete: \(\) => \{/.test(preloaderSrc),
        "обработчик 'complete' у state.addListener убран — реальное удаление больше не ждёт границы цикла");
    assert(/window\._preloaderVisualReady = \(\) => \{ _remove\(\); \};/.test(preloaderSrc),
        'window._preloaderVisualReady() вызывает _remove() сразу, без промежуточного _gameDone/ожидания цикла');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
