/**
 * Test: 26.09.2026, по прямому репорту со скриншотом консоли — "платёж проходит (VK
 * подтвердил), но награда не начисляется" — на деле сервер ЧЕСТНО начислял (подтверждено
 * логами universal_pay.php: item=15, field=coins, after=20003), но клиентский
 * _refreshBalanceAfterPurchase() опрашивал баланс ОДИН раз через фиксированные 1500мс — вебхук
 * VK (отдельный, асинхронный сервер-серверный запрос от VK) иногда долетал позже этой
 * единственной попытки, и клиент показывал старый баланс, хотя сервер уже всё начислил.
 *
 * Фикс: несколько попыток опроса баланса с нарастающей задержкой (1.5с/3с/5с/8с),
 * останавливаемся, как только валюта реально изменилась — не полагаемся на одну попытку.
 *
 * Run: node tests/bank-balance-refresh-retry-race-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bank.js'), 'utf-8');

console.log('\nTest 1: _refreshBalanceAfterPurchase() делает несколько попыток, а не одну');
{
    const start = src.indexOf('_refreshBalanceAfterPurchase(currency, expectedCount){');
    const end   = src.indexOf('\n\thideBank()', start);
    const body  = src.slice(start, end);

    assert(/const delays = \[1500, 3000, 5000, 8000\];/.test(body), 'массив задержек для повторных попыток объявлен (4 попытки)');
    assert(/const attempt = \(attemptIdx\) => \{/.test(body), 'логика вынесена в рекурсивную функцию attempt(), не единственный setTimeout');
    // 26.09.2026 (повторный репорт — "то выдаёт, то не выдаёт"): "изменился хоть на что-то"
    // было ложноположительным при параллельной трате той же валюты — теперь требуем реального
    // роста минимум на expectedCount, см. tests/purchase-balance-refresh-expected-amount.test.js
    assert(/const changed = \(after - before\) >= expectedCount;/.test(body),
        'проверяет, вырос ли баланс минимум на ожидаемую сумму — не просто "изменился хоть на что-то" (защита от гонки с параллельной тратой той же валюты)');
    assert(/if\(!changed && attemptIdx \+ 1 < delays\.length\)\{/.test(body), 'если баланс не изменился и попытки не исчерпаны — планирует следующую');
    assert(/setTimeout\(\(\) => attempt\(attemptIdx \+ 1\), delays\[attemptIdx \+ 1\]\);/.test(body), 'следующая попытка идёт с СЛЕДУЮЩЕЙ (нарастающей) задержкой из массива');
    assert(/setTimeout\(\(\) => attempt\(0\), delays\[0\]\);/.test(body), 'первая попытка стартует после первой задержки (1500мс — не мгновенно)');
}

console.log('\nTest 2: если баланс так и не изменился после всех попыток — это логируется как реальная проблема, не молчит');
{
    const start = src.indexOf('_refreshBalanceAfterPurchase(currency, expectedCount){');
    const end   = src.indexOf('\n\thideBank()', start);
    const body  = src.slice(start, end);
    // 26.09.2026: структура ветки изменилась (добавлен _finish() для снятия
    // suspendPlayerSave — см. bank-purchase-save-suspend-overwrite-fix.test.js), но сама
    // проверка "не изменилось — залогировать ошибку" осталась, просто внутри общего else.
    assert(/if\(!changed\) console\.error\(/.test(body),
        'финальная неудача (все попытки исчерпаны, баланс не изменился) логируется через console.error');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
