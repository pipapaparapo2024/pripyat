/**
 * Test: 26.09.2026, КРИТИЧЕСКИЙ репорт — "платежи на тушёнку/сигареты/рубли проходят, но
 * награда не начисляется" (реальные деньги списывались, а начислялось не то).
 *
 * Причина, подтверждена живыми логами universal_pay.php (после добавленного этой же сессией
 * логирования): VK присылает item_id как "item107" (со строковым префиксом "item"), а код
 * order_status_change/order_status_change_test делал `intval($_POST['item_id'])` НАПРЯМУЮ —
 * intval("item107") в PHP равен 0 (парсинг останавливается на первом нечисловом символе), а
 * item_id=0 — это ПЕРВАЯ пачка тушёнки (4 шт). В логах видно: purchases item107 (энергия),
 * item15 (монеты), item7 (тушёнка), item106 (энергия) — ВСЕ логировались как "item=0,
 * field=stew, count=4", т.е. ЛЮБАЯ покупка тихо превращалась в "начислить 4 тушёнки".
 *
 * Фикс: тот же приём, что уже используется в get_item (explode('item', ...)), но через
 * end() — устойчиво и к строке С префиксом ("item107"→107), и БЕЗ него ("107"→107).
 *
 * Run: node tests/universal-pay-item-id-parsing-critical-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'server', 'universal_pay.php'), 'utf-8');

function checkBranch(caseName){
    console.log(`\nTest: ${caseName} — item_id парсится устойчиво к префиксу "item"`);
    const caseStart = src.indexOf(`case '${caseName}':`);
    assert(caseStart !== -1, `ветка case '${caseName}' найдена`);
    const nextBreak = src.indexOf('break;', caseStart);
    const body = src.slice(caseStart, nextBreak);

    assert(!/\$item = intval\(\$_POST\['item_id'\]\);/.test(body),
        'старый прямой intval($_POST[\'item_id\']) убран (был всегда 0 на строке вида "item107")');
    assert(/\$itemIdParts = explode\('item', strval\(\$_POST\['item_id'\] \?\? ''\)\);/.test(body),
        'item_id сначала разбивается по подстроке "item"');
    assert(/\$item = intval\(end\(\$itemIdParts\)\);/.test(body),
        'берётся последний фрагмент через end() — работает и с префиксом, и без него');
}

checkBranch('order_status_change_test');
checkBranch('order_status_change');

console.log('\nTest: сам парсинг даёт правильный результат для реальных форматов VK');
{
    // Эмулируем PHP explode+end+intval логику на JS-эквиваленте той же строки, чтобы
    // формально проверить арифметику фикса (не просто наличие кода, а его корректность).
    function parseItemId(raw){
        const parts = String(raw).split('item');
        return parseInt(parts[parts.length - 1], 10) || 0;
    }
    assert(parseItemId('item107') === 107, '"item107" → 107 (был бы 0 через голый intval)');
    assert(parseItemId('item0') === 0, '"item0" → 0 (первая пачка тушёнки — легитимный кейс, не путать с багом)');
    assert(parseItemId('item15') === 15, '"item15" → 15');
    assert(parseItemId('7') === 7, 'формат без префикса ("7") тоже парсится верно — устойчивость на случай другого формата VK');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
