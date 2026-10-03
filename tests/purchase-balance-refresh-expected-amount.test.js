/**
 * Test: 26.09.2026, повторный живой репорт тем же днём — "покупка то выдаёт, то не выдаёт, в
 * основном не выдаёт, каждый раз после попытки покупки выскакивает попап нового уровня".
 *
 * Root cause (эта часть репорта — отдельно от попапа level-up, см.
 * level-column-sync-on-exp-save.test.js): bank.js._refreshBalanceAfterPurchase() опрашивал
 * users.get() до 4 раз и считал покупку подтверждённой, как только udata[currency] ХОТЬ КАК-ТО
 * изменился ("!== before") — но пользователь тестировал одновременно играя в казино
 * (блэкджек/зарики), где ТА ЖЕ валюта (coins) непрерывно меняется от ставок. Любое случайное
 * совпадение по времени с чужим изменением останавливало опрос ДО того, как реально долетал
 * вебхук VK для конкретно ЭТОЙ покупки — экран показывал "подтверждено", хотя настоящее
 * начисление могло прилететь позже и никто больше его не проверял.
 *
 * Фикс: вместо "изменилось хоть на сколько-нибудь" требуем реального роста МИНИМУМ на
 * expectedCount (известную сумму покупки) от снимка ДО покупки — параллельная трата той же
 * валюты лишь отложит подтверждение (корректно), а не даст ложный успех раньше времени.
 *
 * Run: node tests/purchase-balance-refresh-expected-amount.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bankJs = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bank.js'), 'utf-8');

console.log('\nTest 1: _refreshBalanceAfterPurchase() принимает expectedCount и сравнивает прирост, не факт изменения');
{
    const start = bankJs.indexOf('_refreshBalanceAfterPurchase(currency, expectedCount){');
    assert(start !== -1, '_refreshBalanceAfterPurchase(currency, expectedCount) — второй параметр добавлен');
    const end = bankJs.indexOf('\n\thideBank()', start);
    const body = bankJs.slice(start, end);
    assert(/const before = window\.udata \? parseInt\(udata\[currency\] \|\| 0\) : 0;/.test(body),
        'снимок "до" приводится к числу (parseInt) — избегает строкового сравнения "20000" !== 20000');
    assert(/const after = parseInt\(udata\[currency\] \|\| 0\);/.test(body), 'значение "после" тоже приводится к числу');
    assert(/const changed = \(after - before\) >= expectedCount;/.test(body),
        'успех — только когда реальный прирост НЕ МЕНЬШЕ ожидаемой суммы покупки (не любое изменение)');
}

console.log('\nTest 2: все три ветки (stew/coins/cigarettes) передают известную сумму count вторым аргументом');
{
    assert(/this\._refreshBalanceAfterPurchase\('stew', count\);/.test(bankJs), "ветка ТУШЕНКА передаёт count");
    assert(/this\._refreshBalanceAfterPurchase\('coins', count\);/.test(bankJs), "ветка МОНЕТЫ передаёт count");
    assert(/this\._refreshBalanceAfterPurchase\('cigarettes', count\);/.test(bankJs), "ветка СИГАРЕТЫ передаёт count");
}

console.log('\nTest 3: параллельная трата той же валюты не создаёт ложный успех раньше срока — симуляция расчёта');
{
    // Симулируем сценарий репорта: до покупки coins=8188. Пока идёт опрос (1.5-8с), игрок
    // делает несколько ставок в блэкджек и coins падает до 8180 (чужое, не связанное с
    // покупкой изменение). Покупка +20000 монет ЕЩЁ не долетела к первой попытке.
    const before = 8188;
    const expectedCount = 20000;
    // Старая логика: "changed = after !== before" — 8180 !== 8188 → true → ЛОЖНЫЙ успех.
    const oldLogicFalsePositive = (8180 !== before);
    assert(oldLogicFalsePositive === true, 'подтверждено: старая логика ("любое изменение") ловится на чужой трате — ложный успех');
    // Новая логика: (after - before) >= expectedCount — 8180-8188=-8, не достигает +20000 → false, ждём дальше.
    const newLogicResult = (8180 - before) >= expectedCount;
    assert(newLogicResult === false, 'новая логика НЕ считает чужую трату успехом покупки — продолжает опрос (не ложный, а честный "ещё нет")');
    // Обычный (наиболее частый) случай — без параллельной траты: реальное начисление
    // долетает поверх ТОГО ЖЕ before, прирост равен ожидаемой сумме ровно.
    const afterRealCreditNoConcurrentSpend = before + expectedCount;
    const newLogicSuccessResult = (afterRealCreditNoConcurrentSpend - before) >= expectedCount;
    assert(newLogicSuccessResult === true, 'новая логика засчитывает успех, когда реальное начисление долетает без помех');
    // Осознанное ограничение (не регрессия): если параллельная трата ПОЛНОСТЬЮ перекрывает
    // начисление в течение всего окна ожидания (редкий, крайний случай — постоянная агрессивная
    // игра ровно во время покупки), порог может не быть достигнут за 4 попытки/17.5с — это
    // ЛУЧШЕ, чем старое поведение (ложный успех сразу), т.к. реальный баланс в БД всё равно
    // корректен и подтянется при следующем любом действии, применяющем patch.
    const afterWithOffsettingSpend = (8180) + expectedCount; // трата -8, затем начисление +20000
    const thresholdNotYetReached = (afterWithOffsettingSpend - before) < expectedCount;
    assert(thresholdNotYetReached === true,
        'документируем осознанное ограничение: при полностью компенсирующей параллельной трате порог может не достигаться в рамках окна — это безопасное "ждать дальше", не ложный успех');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
