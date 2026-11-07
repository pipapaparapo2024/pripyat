/**
 * Test: 22.10.2026, репорт от тестера (Владимир Хикаев, тестовое VK-приложение) — "висит
 * загрузка", в консоли необработанный "Uncaught TypeError: notify.lib.notify_result is not
 * a constructor", брошенный из глубины цепочки pixi-sound._onComplete → animate.min.js (ДО
 * того, как module_control.js успел вызвать window.notify.setup(PIXI.animate) для FLA-
 * библиотеки "notify" — см. content/animate/notify/notify.js, window.notify.lib заполняется
 * только внутри setup()). Корень гонки — внутри стороннего скомпилированного
 * pixi-legacy/animate.min.js, точечно не чинится в своём коде (ПРАВИЛО №2).
 *
 * Ранняя диагностика остаётся, но длительная загрузка сама по себе
 * не должна показывать окно ошибки или предлагать перезагрузку.
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

console.log('\nTest 2: долгая загрузка не показывает окно ошибки');
{
    assert(!/\}, 50000\);/.test(preloaderVisualSrc), 'нет таймера ошибки через 50с');
    assert(!preloaderVisualSrc.includes('_preloader_stuck_overlay'), 'нет DOM-окна зависшей загрузки');
    assert(!preloaderVisualSrc.includes('location.reload()'), 'визуальный загрузчик не предлагает перезапуск');
}

console.log('\nTest 3: preloader-visual.js — существующий 30-секундный информационный таймер НЕ тронут (по дизайну не прерывает показ)');
{
    assert(/const _failsafeTid = setTimeout\(\(\) => \{/.test(preloaderVisualSrc), '_failsafeTid остался');
    assert(/загрузка идёт дольше 30с — анимация продолжает крутиться в цикле, ждём реальной готовности игры \(не убираем прелоадер по таймеру\)/.test(preloaderVisualSrc),
        'исходный текст 30-секундного предупреждения не изменён');
    assert(/\}, 30000\);/.test(preloaderVisualSrc), 'порог 30с не изменён');
}

console.log('\nTest 4: при скрытии прелоадера диагностический таймер очищается');
{
    const match = preloaderVisualSrc.match(/function _remove\(\)\{([\s\S]*?)\n    \}/);
    assert(!!match && /clearTimeout\(_failsafeTid\);/.test(match[1]),
        'диагностический таймер не срабатывает после завершения загрузки');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
