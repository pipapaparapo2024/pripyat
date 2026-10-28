/**
 * Test: 28.10.2026, по прямому указанию — "шрифты и вообще любые файлы загружаются в самом
 * начале когда идёт прелоадер, посмотри что не так, исправь". Разбор показал: index.html давно
 * триггерит РАННЮЮ загрузку всех @font-face через скрытые span'ы (font_preload, ПРАВИЛО №11
 * AGENTS.md) — но ничто в game-boot.js раньше НЕ ЖДАЛО их реальной загрузки перед показом игры
 * (window._showGame() гейтился только на PNG-текстурах _allGamePngs). Это был корень целого
 * класса точечных багов, уже чиненных по отдельности (game2048-top-popup.js,
 * interface-currency-purchase.js, raznaryadka.js, svod-zanachki.js — см. modules/font-ready.js и
 * tests/font-ready-redraw-race-fix.test.js) — PIXI печёт canvas текста сразу по запросу, не
 * дожидаясь реальной загрузки шрифта, если экран строится раньше, чем шрифт догрузился.
 *
 * Фикс: _showGame() теперь гейтится ДВУМЯ флагами — _pngsReady И _fontsReady (через
 * document.fonts.ready), тем же паттерном, что уже использует _finishLoading() для
 * _gameShown/_bgAllLoaded (см. game-boot-compass-waits-bg-modules.test.js). Точечные фиксы на
 * отдельных экранах НЕ убраны — остаются защитой для динамического текста, создаваемого ПОСЛЕ
 * старта игры (когда этот прелоадер уже не актуален) и на случай будущей регрессии общего guard'а.
 *
 * Run: node tests/game-boot-waits-fonts-ready-before-show.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bootSrc = fs.readFileSync(path.join(root, '_client/src/game/game-boot.js'), 'utf-8');

console.log('\nTest 1: document.fonts.ready реально ожидается (Font Loading API), с .catch() на случай отклонения промиса');
{
    assert(/document\.fonts\.ready\.then\(\(\) => \{/.test(bootSrc), 'document.fonts.ready.then(...) присутствует');
    assert(/_fontsReady = true;/.test(bootSrc), 'внутри .then() выставляется _fontsReady = true');
    assert(/\}\)\.catch\(\(e\) => \{/.test(bootSrc), '.catch() обязателен — отклонённый промис не должен навсегда блокировать игру');
}

console.log('\nTest 2: защитный таймаут 5с — если document.fonts.ready никогда не резолвится (баг окружения), игра всё равно откроется');
{
    const start = bootSrc.indexOf("document.fonts.ready.then");
    const end = bootSrc.indexOf('} else {', start);
    const body = bootSrc.slice(start, end);
    assert(/setTimeout\(\(\) => \{\s*\n\s*if\(_fontsReady\) return;/.test(body),
        'таймаут проверяет _fontsReady перед принудительным продолжением — не задваивает вызов, если ready уже отработал раньше');
    assert(/_fontsReady = true;\s*\n\s*_tryShowGame\(\);\s*\n\s*\}, 5000\);/.test(body),
        'таймаут — ровно 5000мс, после которого _fontsReady форсируется true и _tryShowGame() вызывается');
}

console.log('\nTest 3: окружение без Font Loading API (document.fonts отсутствует) не блокирует игру — _fontsReady сразу true');
{
    assert(/\} else \{\s*\n\s*_fontsReady = true; \/\/ Font Loading API недоступен в этом окружении — не блокируем игру\s*\n\s*\}/.test(bootSrc),
        'else-ветка (Font Loading API недоступен) сразу выставляет _fontsReady = true, без ожидания');
}

console.log('\nTest 4: _showGame() вызывается ТОЛЬКО через _tryShowGame(), которая требует ОБА флага (_pngsReady И _fontsReady)');
{
    assert(/const _tryShowGame = \(\) => \{ if\(_pngsReady && _fontsReady\) _showGame\(\); \};/.test(bootSrc),
        '_tryShowGame() — единая точка входа, AND-условие по обоим флагам (не OR — иначе шрифты не блокировали бы готовые PNG)');
    // Во всём блоке PNG+шрифтов "_showGame();" должен встречаться РОВНО один раз — внутри самой
    // _tryShowGame(). Если найдётся больше одного — значит где-то остался обходной прямой вызов.
    const pngAndFontsSection = bootSrc.slice(bootSrc.indexOf('let _pngsReady = false;'), bootSrc.indexOf('const _bgModules = ['));
    const showGameCallCount = (pngAndFontsSection.match(/_showGame\(\);/g) || []).length;
    assert(showGameCallCount === 1, `в блоке PNG+шрифтов ровно один вызов "_showGame();" — внутри _tryShowGame() (найдено: ${showGameCallCount})`);
}

console.log('\nTest 5: _markDone() (завершение PNG-прелоада) выставляет _pngsReady = true и зовёт _tryShowGame(), не _showGame() напрямую');
{
    const start = bootSrc.indexOf('const _markDone = (fname, status) => {');
    const end = bootSrc.indexOf('\n        };', start);
    const body = bootSrc.slice(start, end);
    assert(!!body && start !== -1, '_markDone() найден');
    assert(/if\(_done >= _total\)\{ _pngsReady = true; _tryShowGame\(\); \}/.test(body),
        'по завершении всех PNG — _pngsReady=true и _tryShowGame() (не прямой _showGame())');
}

console.log('\nTest 6: ветка _total===0 (нет PNG для загрузки) тоже идёт через _pngsReady/_tryShowGame, не в обход ожидания шрифтов');
{
    assert(/if\(_total === 0\)\{ _pngsReady = true; _tryShowGame\(\); return; \}/.test(bootSrc),
        'edge-case "ноль текстур в _allGamePngs" всё равно уважает флаг шрифтов — раньше такая ветка звала _showGame() напрямую, в обход любых будущих гейтов');
}

console.log('\nTest 7: ожидание шрифтов стартует ДО начала PNG-прелоада (параллельно, не последовательно) — не добавляет задержку поверх существующей загрузки');
{
    const fontsIdx = bootSrc.indexOf('document.fonts.ready.then');
    const pollLoaderIdx = bootSrc.indexOf('setTimeout(_pollLoader, 200);');
    assert(fontsIdx !== -1 && pollLoaderIdx !== -1 && fontsIdx < pollLoaderIdx,
        'document.fonts.ready подписка идёт РАНЬШЕ старта PNG-прелоада по тексту файла — оба процесса идут параллельно, суммарное время ограничено более медленным из двух, не суммой');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
