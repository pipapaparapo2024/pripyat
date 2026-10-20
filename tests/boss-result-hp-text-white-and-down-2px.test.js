/**
 * Test: 17.10.2026, по прямому указанию — "количество хп у боссов по попапу результата с
 * боссом, поражение или победа, опусти вниз на 2 пикселя и сделай белым шрифтом".
 *
 * Применяется к ОБЕИМ веткам boss_result.js:
 *  - isWin:false (поражение) — hpTxt: y 415→417, fill #1a1208 (тёмный) → #ffffff (белый).
 *  - isWin:true (победа) — hpBarTxt: y PORTRAIT_POS.y+HP_BAR_OFFSET.y → +2 сверху того же
 *    выражения. Цвет уже был #ffffff (см. 22.09.2026, текст поверх красной полоски портрета) —
 *    вторая часть указания здесь уже выполнена раньше, проверяем, что осталась белой.
 *
 * 19.10.2026 (по прямому указанию, снято редактором позиций — "x:437,y:414,w:114,h:16" bbox
 * top-left, переведено в якорь-центр x:494,y:422 на ОБЕИХ страницах; hpBarTxt теперь тоже
 * захардкожен на эти координаты вместо формулы PORTRAIT_POS+HP_BAR_OFFSET): позиции обеих
 * веток обновлены — цвет/белизна по-прежнему в силе, их продолжает проверять Test 1/2 ниже.
 *
 * Run: node tests/boss-result-hp-text-white-and-down-2px.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const content = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');

console.log('\nTest 1: поражение (isWin:false) — hpTxt белым, координаты x:494,y:422 (19.10.2026)');
{
    const idx = content.indexOf("if(!isWin){");
    const endIdx = content.indexOf('} else {', idx);
    const block = content.slice(idx, endIdx !== -1 ? endIdx : idx + 900);
    assert(/fill: '#ffffff'/.test(block), 'hpTxt — fill белый (#ffffff), не тёмный #1a1208');
    assert(!/#1a1208/.test(block), 'старый тёмный цвет (#1a1208) больше не используется в этой ветке');
    assert(/hpTxt\.x = 494; hpTxt\.y = 422;/.test(block), 'hpTxt — x:494,y:422 (19.10.2026, редактор позиций)');
}

console.log('\nTest 2: победа (isWin:true) — hpBarTxt остаётся белым, те же координаты x:494,y:422');
{
    const idx = content.indexOf('} else {');
    const block = content.slice(idx, idx + 1200);
    assert(/fill: '#ffffff'/.test(block), 'hpBarTxt — fill белый (не менялся, уже был белым)');
    assert(/hpBarTxt\.x = 494; hpBarTxt\.y = 422;/.test(block),
        'hpBarTxt — x:494,y:422 (19.10.2026: захардкожено вместо формулы PORTRAIT_POS+HP_BAR_OFFSET)');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
