/**
 * Test: 17.10.2026, по прямому указанию — "текст 'Осталось HP' убери вообще, не нужен".
 * boss_result.js (экран поражения, isWin:false) раньше писал "Осталось HP: X / Y" (текущий
 * остаток / максимум). Убран целиком. Вместо него — только общий (максимальный) HP босса, на
 * новых координатах x:492,y:415,scale:1 с редактора позиций.
 *
 * Run: node tests/boss-result-maxhp-replaces-remaining-hp.test.js
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

console.log('\nTest 1: текста "Осталось HP" больше нет в файле');
{
    assert(!/Осталось HP/.test(content), '"Осталось HP" удалён из попапа результата боя');
}

console.log('\nTest 2: вместо него — maxHp на координатах x:492,y:417 (17.10.2026: y опущен ещё на 2px, было 415)');
{
    const idx = content.indexOf("if(!isWin){");
    const endIdx = content.indexOf('} else {', idx);
    const block = content.slice(idx, endIdx !== -1 ? endIdx : idx + 900);
    assert(/bosses\._fmt\(opts\.maxHp \|\| 0\)/.test(block), 'текст строится из opts.maxHp (общий HP босса), не из hpLeft');
    assert(/hpTxt\.x = 492; hpTxt\.y = 417;/.test(block), 'координаты нового текста x:492 y:417');
    assert(/hpTxt\.scale\.set\(1\.000\)/.test(block), 'scale выставлен явно 1.000 как в координатах редактора');
}

console.log('\nTest 3: экран победы (isWin:true, hpBarTxt) — показывает maxHp как и раньше, позиция/цвет см. отдельный тест');
{
    assert(/hpBarTxt\.x = PORTRAIT_POS\.x \+ HP_BAR_OFFSET\.x;/.test(content), 'hpBarTxt на экране победы не менялся по X');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
