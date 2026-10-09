/**
 * Test: батч 22.09.2026 — баг "компас загрузки появляется на секунду и пропадает, должен быть
 * до конца загрузки игры" (репорт пользователя), + следующим шагом та же дата — "стоит ли
 * сделать загрузку не последовательной, а параллельной?" (по прямому указанию — да, сделано).
 *
 * Причина исходного бага: window.endLoadGame() (game-boot.js) прятал компас (#_clo) и вызывал
 * window._preloaderVisualReady() сразу после готовности ТОЛЬКО FLA interface/home + текстур
 * _allGamePngs — это происходит очень быстро (текстуры прогреваются заранее early-preload'ом).
 * Реальные игровые модули (_bgModules — 16 шт.: notify/bosses/zone/vassilich/weapons/shmot/
 * gangs/dvor/base/habar/top/svod/zadaniya/battlepass/hapuga/bot) в этот момент ЕЩЁ ДАЖЕ НЕ
 * НАЧИНАЛИ грузиться (стартуют только через 4с). Видео доигрывало ролик, показывало компас как
 * fallback — и тут же гасилось этим преждевременным сигналом "готово".
 *
 * Фикс (первый батч): скрытие компаса/прогресс-бара и вызов window._preloaderVisualReady()
 * вынесены в отдельную _finishLoading(), которая срабатывает только когда ОБА флага истинны —
 * _gameShown (лёгкая часть) И _bgAllLoaded (весь _bgModules реально догружен).
 *
 * Фикс (второй батч, этот файл): _bgModules раньше грузились ПОСЛЕДОВАТЕЛЬНО, один за другим,
 * с паузой 300мс между каждым — чисто искусственные паузы добавляли ~4.5с к времени, которое
 * теперь напрямую видно игроку как "компас всё ещё висит". Переведено на ПАРАЛЛЕЛЬНУЮ загрузку
 * (все 16 модулей стартуют одновременно через modules.checkFlags(), _bgAllLoaded выставляется,
 * когда пришли ВСЕ колбэки) — общее время ограничено самым медленным ОДНИМ модулем, а не суммой
 * всех. Попутно (первый батч) поднят аварийный таймаут в preloader-visual.js с 9с до 30с.
 *
 * Run: node tests/game-boot-compass-waits-bg-modules.test.js
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

const bootSrc = readSrc('_client/src/game/game-boot.js');

console.log('\nTest 1: _showGame() больше НЕ прячет компас/прогресс-бар напрямую в своём setTimeout — только вызывает _finishLoading()');
{
    const start = bootSrc.indexOf('const _showGame = () => {');
    const end   = bootSrc.indexOf('\n        };', start);
    const body  = bootSrc.slice(start, end);
    assert(!!body, '_showGame() найден');
    assert(/setTimeout\(_finishLoading, 300\);/.test(body), '_showGame() ставит только setTimeout(_finishLoading, 300) — не прячет #_clo напрямую');
    assert(!/_clo\.style\.display = 'none';/.test(body), 'внутри _showGame() больше нет прямого "_clo.style.display = \'none\'"');
}

console.log('\nTest 2: _finishLoading() гейтится ОБОИМИ флагами — _gameShown И _bgAllLoaded — и только тогда реально прячет компас/прогресс-бар и зовёт _preloaderVisualReady()');
{
    const start = bootSrc.indexOf('const _finishLoading = () => {');
    const end   = bootSrc.indexOf('\n        };', start);
    const body  = bootSrc.slice(start, end);
    assert(!!body && start !== -1, '_finishLoading() найден');
    assert(/if\(_loadingFinished \|\| !_gameShown \|\| !_bgAllLoaded\) return;/.test(body),
        '_finishLoading() выходит, если хотя бы одно условие (готовность/фоновые модули/уже выполнено) не выполнено');
    assert(/_clo\.style\.display = 'none';/.test(body), 'после прохождения гейта прячет компас');
    assert(/_ui\.style\.display = 'none';/.test(body), 'после прохождения гейта прячет прогресс-бар (#_loader_ui)');
    assert(/window\._preloaderVisualReady\(\);/.test(body), 'после прохождения гейта вызывает window._preloaderVisualReady()');
}

console.log('\nTest 3: _bgModules грузятся ПАРАЛЛЕЛЬНО (forEach, все 16 стартуют разом), не последовательно');
{
    const start = bootSrc.indexOf('let _bgDoneCount = 0;');
    const end   = bootSrc.indexOf('\n    };', start);
    const body  = bootSrc.slice(start, end);
    assert(!!body && start !== -1, 'блок параллельной загрузки (_bgDoneCount/_bgModuleDone) найден');
    assert(/_bgModules\.forEach\(name => \{/.test(body), '_bgModules.forEach — все элементы обрабатываются в одном проходе, не по одному через рекурсивный setTimeout');
    assert(!/const _bgNext = /.test(bootSrc), 'старой последовательной _bgNext() (рекурсивный setTimeout-обход) в файле больше нет');
    assert(!/setTimeout\(_bgNext, 300\)/.test(bootSrc), 'искусственной паузы 300мс между модулями (часть последовательного дизайна) не осталось');
}

console.log('\nTest 4: _bgModuleDone() считает завершения и по достижении _bgModules.length выставляет _bgAllLoaded=true + зовёт _finishLoading()');
{
    const start = bootSrc.indexOf('const _bgModuleDone = (name) => {');
    const end   = bootSrc.indexOf('\n        };', start);
    const body  = bootSrc.slice(start, end);
    assert(!!body && start !== -1, '_bgModuleDone() найден');
    assert(/_bgDoneCount\+\+;/.test(body), 'каждый вызов увеличивает счётчик завершённых модулей');
    assert(/if\(_bgDoneCount >= _bgModules\.length\)\{/.test(body), 'проверяет, что ВСЕ модули (по счётчику, не по порядку) завершены');
    assert(/_bgAllLoaded = true;/.test(body), 'по достижении — выставляет _bgAllLoaded = true');
    assert(/_finishLoading\(\);/.test(body), 'и сразу зовёт _finishLoading() (гейт сам решит, готова ли остальная часть)');
}

console.log('\nTest 5: каждый модуль в цикле — либо уже загружен (пропуск через _bgModuleDone), либо checkFlags([name], ...) с колбэком на _bgModuleDone; ошибка одного модуля не блокирует остальные (try/catch тоже зовёт _bgModuleDone)');
{
    const start = bootSrc.indexOf('_bgModules.forEach(name => {');
    const end   = bootSrc.indexOf('\n            });', start);
    const body  = bootSrc.slice(start, end);
    assert(!!body && start !== -1, 'тело forEach найдено');
    assert(/if\(modules\.flags\[name\]\)\{ _bgModuleDone\(name\); return; \}/.test(body),
        'уже загруженный модуль сразу засчитывается (не блокирует счётчик, ожидая несуществующий колбэк)');
    assert(/modules\.checkFlags\(\[name\], \(\) => _bgModuleDone\(name\)\);/.test(body),
        'модуль грузится через checkFlags(), колбэк ведёт напрямую в _bgModuleDone — без промежуточного setTimeout');
    assert(/catch\(e\)\{[\s\S]*?_bgModuleDone\(name\);/.test(body),
        'catch-ветка тоже зовёт _bgModuleDone(name) — единичная ошибка не вешает весь счётчик навсегда (иначе _bgAllLoaded никогда не станет true)');
}

console.log('\nTest 6: аварийный таймаут в preloader-visual.js поднят до 30с (с прежних 9с — недостаточно для честной цепочки полной загрузки)');
{
    const preloaderSrc = readSrc('_client/src/modules/preloader-visual.js');
    assert(/\}, 30000\);/.test(preloaderSrc), 'аварийный таймаут — 30000мс');
    assert(!/\}, 9000\);/.test(preloaderSrc), 'старого значения 9000мс не осталось');
}

console.log('\nTest 7: sanity — _bgModules по-прежнему содержит все 16 игровых модулей (список не случайно урезан этой правкой)');
{
    const EXPECTED = ['notify','bosses','zone','vassilich','weapons','shmot','gangs','dvor','base','habar','top','svod','zadaniya','battlepass','hapuga','bot'];
    const m = bootSrc.match(/const _bgModules = \[([\s\S]*?)\];/);
    assert(!!m, '_bgModules массив найден');
    const listed = m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];
    assert(listed.length === EXPECTED.length, `_bgModules содержит ${EXPECTED.length} модулей, получили ${listed.length}`);
    for (const name of EXPECTED) assert(listed.includes(name), `_bgModules содержит "${name}"`);
}

console.log('\nTest 8: стартовая пауза 4000мс перед запуском партии сохранена (не трогали — даёт видео/текстурам приоритет первых секунд)');
{
    assert(/setTimeout\(\(\) => \{\s*\n\s*console\.log\('\[game-boot\] запускаю параллельную загрузку'/.test(bootSrc),
        'параллельный запуск партии по-прежнему обёрнут в setTimeout(..., ...)');
    assert(/\}, 4000\);\s*\n\s*\};\s*\n/.test(bootSrc), 'значение задержки — 4000мс, как и было');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
