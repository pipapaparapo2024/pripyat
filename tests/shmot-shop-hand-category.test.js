/**
 * Test: у категории «Рука» (cat 6: мачете/бита/серп и т.д. в руке персонажа) не было
 * отдельной вкладки в магазине одежды — вещи этой категории временно показывались под
 * вкладкой «Торс» (костыль, т.к. иконки для отдельной вкладки не было). Пользователь
 * добавил недостающий ассет («магазин вещей группа руки.png») — теперь у категории
 * есть своя полноценная вкладка, костыль-объединение с «Торс» убран.
 *
 * Run: node tests/shmot-shop-hand-category.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), 'utf-8'
);

console.log('\nTest 1: CATS содержит отдельную вкладку "Рука" (cat: 6)');
{
    const m = src.match(/const CATS = \[([\s\S]*?)\];/);
    assert(!!m, 'CATS найден');
    if (m) {
        assert(/\{ file: 'магазин вещей группа руки\.png',\s*cat: 6,\s*(?:x: -?[\d.]+,\s*)?y: [\d.]+ \},/.test(m[1]),
            'новая вкладка "Рука" (cat 6) добавлена с собственной иконкой');
    }
}

console.log('\nTest 2: костыль-объединение категории "Рука" с "Торс" в фильтре сетки убран');
{
    const m = src.match(/proto\._shopRefresh = function\(preserveScroll = false\)\{([\s\S]*?)const MIN_CELLS/);
    assert(!!m, '_shopRefresh найден');
    if (m) {
        const body = m[1];
        assert(!/catFilter/.test(body), 'переменная catFilter (костыль под cat 1/6) больше не используется');
        assert(/i\.cat === this\._shopCat/.test(body), 'фильтр по прямому совпадению категории — у "Рука" теперь своя вкладка, объединение не нужно');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
