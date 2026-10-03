/**
 * Test: батч 25.09.2026 (по прямому указанию, 2 скриншота) —
 *  1) Попап рюкзака поверх Сидоровича терял нижний ХУД — pushHud('ryukzak', {up:false,
 *     down:false}) прятал оба ХУДа целиком. Теперь просто накладывается сверху, тот же
 *     паттерн, что sidorovich.js уже использует (pushHud('sidorovich', {})).
 *  2) nagrada_ryukzak_birka.png (бирка цены у кнопки ЗАБРАТЬ) рисовалась ПОД кнопкой
 *     ЗАБРАТЬ (добавлена в дерево раньше неё) — теперь добавляется ПОСЛЕ, поверх.
 *
 * Run: node tests/ryukzak-hud-and-birka-zorder.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'ryukzak.js'), 'utf-8');

console.log('\nTest 1: pushHud(\'ryukzak\', {}) — ХУД больше не прячется целиком');
{
    assert(/this\.pushHud\('ryukzak', \{\}\);/.test(src), "pushHud('ryukzak', {}) — оба ХУДа остаются видимыми, как у sidorovich.js");
    assert(!/this\.pushHud\('ryukzak', \{ up: false, down: false \}\);/.test(src), 'старый вызов, прятавший оба ХУДа, убран');
}

console.log('\nTest 2: nagrada_ryukzak_birka.png (и связанные иконка/число) добавлены ПОСЛЕ zabratBtn — рисуются поверх кнопки ЗАБРАТЬ');
{
    const btnIdx  = src.indexOf('win.addChild(zabratBtn);');
    const tagIdx  = src.indexOf("new PIXI.Sprite(PIXI.Texture.from(BASE + 'nagrada_ryukzak_birka.png'));");
    const tagAddIdx = src.indexOf('win.addChild(tushenkaTagSpr);');
    assert(btnIdx !== -1, 'win.addChild(zabratBtn) найден');
    assert(tagIdx !== -1 && tagAddIdx !== -1, 'tushenkaTagSpr создаётся и добавляется в дерево');
    assert(btnIdx < tagIdx && btnIdx < tagAddIdx,
        'zabratBtn добавлен в дерево РАНЬШЕ бирки — бирка (добавлена позже) рисуется поверх кнопки, не под ней');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
