/**
 * Test: батч 24.09.2026 (по прямому указанию — "сделай затемнение вкладки Двор, когда
 * заходишь на какую-либо игру", уточнение после скриншота "кнопки справа просвечивают").
 *
 * Разбор показал: только у покера (dvor-poker-screen.js) была тёмная подложка (darkBg,
 * 0x000000/0.6, во весь канвас) — она нужна там, т.к. фон покера сознательно меньше канваса.
 * У остальных 3 игр её не было, а у двух (рулетка — bg.y=15 без компенсации, блэкджек —
 * win.y=-8 сдвигает контейнер, bg покрывает только часть) реально оставались непокрытые
 * полоски по краям. Добавлена та же подложка во все 4 экрана Двора — гарантированно тёмный
 * фон независимо от точного покрытия конкретной картинки.
 *
 * Run: node tests/dvor-games-consistent-darkbg-coverage.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const FILES = [
    ['dvor-poker-screen.js',     '_client/src/game/dvor/dvor-poker-screen.js',     1280, 720],
    ['dvor-roulette-screen.js',  '_client/src/game/dvor/dvor-roulette-screen.js',  1280, 720],
    ['dvor-dice-screen.js',      '_client/src/game/dvor/dvor-dice-screen.js',      1280, 720],
    ['dvor-blackjack.js',        '_client/src/game/dvor/dvor-blackjack.js',        1280, 728],
];

for (const [name, rel, w, h] of FILES) {
    console.log(`\nTest: ${name} — тёмная подложка (0x000000/0.6) во весь канвас (${w}x${h}) присутствует`);
    const src = fs.readFileSync(path.join(root, rel), 'utf-8');
    const re = new RegExp(
        `const darkBg = new PIXI\\.Graphics\\(\\);[\\s\\S]{0,20}darkBg\\.beginFill\\(0x000000, 0\\.6\\);[\\s\\S]{0,20}darkBg\\.drawRect\\(0, 0, ${w}, ${h}\\);`
    );
    assert(re.test(src), `${name}: darkBg найден с корректными размерами ${w}x${h}`);
    assert(/win\.addChild\(darkBg\);/.test(src), `${name}: darkBg реально добавлен в win`);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
