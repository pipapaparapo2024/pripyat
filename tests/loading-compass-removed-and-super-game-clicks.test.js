/**
 * Test: баги/правки, найденные 24.09.2026 по живому репорту.
 *
 * 1) "убери с загрузки компас, он не нужен" — картинка компаса со крутящейся стрелкой поверх
 *    чёрного экрана #_clo убрана из index.html (сам #_clo остаётся плоским чёрным оверлеем —
 *    он всё ещё нужен, см. большой коммент 22.09.2026 про "фон просвечивает во время загрузки").
 *    Заодно компас.png/стрелка компаса.png убраны из раннего PNG-прелоада (game-boot.js) — они
 *    нигде больше не используются, преждевременная загрузка была бы бессмысленной тратой трафика.
 *
 * 25.09.2026: пункты про hit-зону стаканчиков и pushHud игры "Стаканчики" (super_game.js)
 * убраны из этого файла — сам модуль super_game.js физически удалён как мёртвый код (см.
 * tests/super-game-cups-and-ball.test.js, который теперь проверяет именно удаление). Этот файл
 * оставлен только для актуальной части про компас на загрузке.
 *
 * Run: node tests/loading-compass-removed-and-super-game-clicks.test.js
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

const html    = readSrc('_client/development/index.html');
const bootSrc = readSrc('_client/src/game/game-boot.js');

console.log('\nTest: компас убран из #_clo в index.html, сам оверлей остался');
{
    const cloStart = html.indexOf('id="_clo"');
    assert(cloStart !== -1, '#_clo найден в index.html');
    const cloTag = html.slice(cloStart - 10, html.indexOf('</div>', cloStart) + 6);
    assert(!/компас\.png/.test(cloTag), 'компас.png больше не встроен внутрь #_clo');
    assert(!/стрелка компаса\.png/.test(cloTag), 'стрелка компаса.png больше не встроена внутрь #_clo');
    assert(!/_cloarrow/.test(html), 'неиспользуемая анимация _cloarrow тоже убрана');
    assert(/display:none;background:#000/.test(cloTag), '#_clo остаётся плоским чёрным оверлеем (не убран целиком)');
    assert(/id="_loader_ui"/.test(html), 'прогресс-бар/подсказки загрузки (_loader_ui) не тронуты — остались');
}

console.log('\nTest: компас.png/стрелка компаса.png убраны из раннего PNG-прелоада (game-boot.js)');
{
    assert(!/'компас\.png'/.test(bootSrc), "'компас.png' убран из window._allGamePngs");
    assert(!/'стрелка компаса\.png'/.test(bootSrc), "'стрелка компаса.png' убран из window._allGamePngs");
    assert(/'стрелка вправо\.png'/.test(bootSrc), "'стрелка вправо.png' (другой файл, используется не только компасом) — остался");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
