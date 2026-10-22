/**
 * Test: 22.10.2026, репорт от тестера (Владимир Хикаев, тестовое VK-приложение) — "висит
 * загрузка", в консоли необработанный "Uncaught TypeError: notify.lib.notify_result is not
 * a constructor", брошенный из глубины цепочки pixi-sound._onComplete → animate.min.js (ДО
 * того, как module_control.js успел вызвать window.notify.setup(PIXI.animate) для FLA-
 * библиотеки "notify" — см. content/animate/notify/notify.js, window.notify.lib заполняется
 * только внутри setup()). Корень гонки — внутри стороннего скомпилированного
 * pixi-legacy/animate.min.js, точечно не чинится в своём коде (ПРАВИЛО №2).
 *
 * Фикс — два независимых, не связанных с PIXI/notify куска:
 * 1) index.js: глобальный window.addEventListener('error', ...) — гарантирует, что подобная
 *    ошибка попадёт в консоль с понятным тегом и контекстом, а не потеряется.
 * 2) preloader-visual.js: ВТОРОЙ таймер (50с, длиннее уже существующего чисто
 *    информационного 30-секундного) — крайний резерв: если игра так и не стала готова,
 *    показывает поверх Spine-анимации явное сообщение с кнопкой перезагрузки, собранное на
 *    чистом DOM (без PIXI/notify — та часть, что может быть как раз сломана в этот момент).
 *    Существующий 30-секундный таймер остаётся БЕЗ изменений (по дизайну не прерывает показ).
 *
 * Run: node tests/oct22-preloader-stuck-failsafe-and-global-error-log.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const indexSrc = readSrc('_client/src/index.js');
const preloaderVisualSrc = readSrc('_client/src/modules/preloader-visual.js');

console.log('\nTest 1: index.js — глобальный логгер необработанных ошибок установлен рано, до остального бута');
{
    assert(/window\.addEventListener\('error', \(e\) => \{/.test(indexSrc),
        'window.addEventListener(\'error\', ...) зарегистрирован');
    assert(/\[index\.js:uncaught\]/.test(indexSrc), 'лог помечен тегом [index.js:uncaught] (ПРАВИЛО №8)');
    // Регистрация должна стоять РАНЬШЕ startPreloaderVisual() (строка 242 на момент фикса) —
    // иначе ошибки на самом раннем этапе загрузки не попадут в лог.
    const errListenerIdx = indexSrc.indexOf("window.addEventListener('error'");
    const startVisualIdx = indexSrc.indexOf('startPreloaderVisual();');
    assert(errListenerIdx !== -1 && startVisualIdx !== -1 && errListenerIdx < startVisualIdx,
        'логгер ошибок регистрируется раньше startPreloaderVisual() — ловит ошибки с самого начала бута');
}

console.log('\nTest 2: preloader-visual.js — крайний резервный таймер (50с) с DOM-оверлеем "Перезагрузить"');
{
    assert(/const _hardFailTid = setTimeout\(\(\) => \{/.test(preloaderVisualSrc), 'второй таймер объявлен');
    assert(/\}, 50000\);/.test(preloaderVisualSrc), 'порог — 50с (длиннее существующего информационного 30с)');
    assert(/if\(_removed\) return;/.test(preloaderVisualSrc), 'таймер проверяет _removed — не сработает, если игра уже загрузилась');
    assert(/overlay\.id = '_preloader_stuck_overlay';/.test(preloaderVisualSrc), 'оверлей создаётся с уникальным id');
    assert(/Не удалось загрузить игру\. Попробуйте перезагрузить страницу\./.test(preloaderVisualSrc),
        'показывается понятное сообщение игроку');
    assert(/btn\.onclick = \(\) => location\.reload\(\);/.test(preloaderVisualSrc),
        'кнопка реально перезагружает страницу (location.reload)');
}

console.log('\nTest 3: preloader-visual.js — существующий 30-секундный информационный таймер НЕ тронут (по дизайну не прерывает показ)');
{
    assert(/const _failsafeTid = setTimeout\(\(\) => \{/.test(preloaderVisualSrc), '_failsafeTid остался');
    assert(/загрузка идёт дольше 30с — анимация продолжает крутиться в цикле, ждём реальной готовности игры \(не убираем прелоадер по таймеру\)/.test(preloaderVisualSrc),
        'исходный текст 30-секундного предупреждения не изменён');
    assert(/\}, 30000\);/.test(preloaderVisualSrc), 'порог 30с не изменён');
}

console.log('\nTest 4: preloader-visual.js — оба таймера и DOM-оверлей корректно чистятся в _remove()');
{
    const m = preloaderVisualSrc.match(/function _remove\(\)\{([\s\S]*?)\n    \}/);
    assert(!!m, '_remove() найден');
    if(m){
        const body = m[1];
        assert(/clearTimeout\(_failsafeTid\);/.test(body), '_failsafeTid очищается');
        assert(/clearTimeout\(_hardFailTid\);/.test(body), '_hardFailTid очищается — не покажет оверлей, если игра успела загрузиться после 50с');
        assert(/document\.getElementById\('_preloader_stuck_overlay'\)/.test(body),
            'оверлей (если уже успел показаться) снимается при реальном скрытии прелоадера');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
