/**
 * Test: 26.09.2026, по прямому указанию (10 точных координат из редактора позиций) —
 *
 * 1) Подсветка выигранной комбинации в покере (dvor-poker-screen.js._pokerShowComboHighlight)
 *    раньше вычислялась формулой (база 160 + шаг 36 + офсет -53) — приближение, уже дважды
 *    расходившееся с реальной картинкой таблицы. Заменена на явную карту {x,y} по каждой из
 *    10 комбинаций (все x:1032, w:257, h:37 — только y отличается по строке).
 *
 * 2) Коды ошибок 67-69 (зарики) и 79-83 (покер) реально используются в dice.php/poker.php
 *    (недостаточно поинтов/фишек/тушёнки, нет активного броска/раздачи, лимиты исчерпаны),
 *    но отсутствовали в errors.json — игрок видел бессмысленное "Ошибка 79" вместо
 *    "Недостаточно фишек для покера". Добавлены человекочитаемые тексты.
 *
 * Run: node tests/poker-combo-highlight-exact-positions-and-error-codes.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const screenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker-screen.js'), 'utf-8');
const errors = JSON.parse(fs.readFileSync(path.join(root, 'server', 'json', 'errors.json'), 'utf-8'));

console.log('\nTest 1: dvor-poker-screen.js — явная карта позиций подсветки комбинаций (10 строк)');
{
    const expected = {
        high_card: 431, pair: 401, two_pair: 369, three_of_a_kind: 338,
        straight: 308, flush: 277, full_house: 241, four_of_a_kind: 207,
        straight_flush: 171, royal_flush: 135,
    };
    for(const [key, y] of Object.entries(expected)){
        const re = new RegExp(key + ':\\s*\\{ x: 1032, y: ' + y + ' \\}');
        assert(re.test(screenSrc), key + ': x:1032, y:' + y);
    }
    assert(/const COMBO_ROW_W = 257, COMBO_ROW_H = 37;/.test(screenSrc), 'единый размер рамки подсветки 257×37 для всех строк');
    assert(!/COMBO_ROW_ORDER/.test(screenSrc), 'старая формула на основе COMBO_ROW_ORDER/шага убрана целиком');
    assert(/h\.position\.set\(pos\.x, pos\.y\);/.test(screenSrc), 'позиция рамки ставится напрямую из карты, без вычисления cx/cy');
}

console.log('\nTest 2: errors.json — недостающие коды казино получили понятный текст');
{
    const byCode = {};
    errors.forEach(e => { byCode[e.code] = e.text; });
    assert(byCode[67] === 'Недостаточно красных поинтов', 'код 67 (dice.php — недостаточно красных поинтов)');
    assert(byCode[68] === 'Нет активного броска — сначала нажми БРОСИТЬ', 'код 68 (dice.php — нет активного броска)');
    assert(byCode[69] === 'Заряды переброса кончились', 'код 69 (dice.php — заряды переброса кончились)');
    assert(byCode[79] === 'Недостаточно фишек для покера', 'код 79 (poker.php — недостаточно фишек)');
    assert(byCode[80] === 'Дневной лимит игр за тушёнку исчерпан', 'код 80 (poker.php — дневной лимит за тушёнку)');
    assert(byCode[81] === 'Недостаточно тушёнки', 'код 81 (poker.php — недостаточно тушёнки)');
    assert(byCode[82] === 'Нет активной раздачи — сначала нажми РАЗДАТЬ', 'код 82 (poker.php — нет активной раздачи)');
    assert(byCode[83] === 'Доступные смены карт закончились', 'код 83 (poker.php — смены карт закончились)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
