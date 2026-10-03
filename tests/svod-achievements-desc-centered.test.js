/**
 * Test: батч 22.09.2026 (по прямому указанию — "добавил блок для текста, текст внутри
 * центрирует, там должен находиться текст, что нужно сделать игроку для выполнения
 * достижения") — descTxt в карточке "Мои достижения" центрируется по ширине карточки, а не
 * лево-выровнен от x=120 как раньше.
 *
 * 22.09.2026 (повторный батч того же дня, по прямому указанию — "центрируй его относительно
 * прогресс-бара, а не всей ячейки", плюс "уменьшил размер текста"): x пересчитан от
 * PROGRESS_BAR_X/W (DESC_CENTER_X), а не CARD_W/2, добавлен DESC_SCALE=0.965.
 *
 * Run: node tests/svod-achievements-desc-centered.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');

console.log('\nTest 1: descTxt центрирован по горизонтали относительно ширины карточки');
{
    const start = src.indexOf("const descTxt = new PIXI.Text('', {");
    const end   = src.indexOf('card.addChild(descTxt);', start);
    const body  = src.slice(start, end);
    assert(/align:'center'/.test(body), "align:'center' — переносы строк внутри wordWrap тоже центрируются, не только блок целиком");
    assert(/descTxt\.anchor\.set\(0\.5, 0\);/.test(body), 'anchor(0.5,0) — центр по X, верх по Y (было anchor по умолчанию 0,0)');
    assert(/descTxt\.scale\.set\(DESC_SCALE\);/.test(body), 'применён DESC_SCALE (0.965) — "уменьшил размер текста"');
    assert(/descTxt\.x = DESC_CENTER_X; descTxt\.y = DESC_Y;/.test(body),
        'x = центр ПРОГРЕСС-БАРА (DESC_CENTER_X), не центр всей карточки (CARD_W/2) — по прямому указанию');
}

console.log('\nTest 2: DESC_CENTER_X вычислен формулой от PROGRESS_BAR_X/W, не независимым голым числом');
{
    assert(/const DESC_CENTER_X = PROGRESS_BAR_X \+ PROGRESS_BAR_W \/ 2;/.test(src),
        'DESC_CENTER_X = PROGRESS_BAR_X + PROGRESS_BAR_W/2 — остаётся верным, если позиция/ширина бара когда-нибудь ещё изменится');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
