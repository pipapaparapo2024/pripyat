/**
 * Test: 26.09.2026 (аудит перед модерацией VK, пункт "платежи — деньги списались, а награда
 * задвоилась") — bank.js.successDonat() для тушёнки/монет/сигарет (item0-23) раньше сам
 * прибавлял valyuta ЛОКАЛЬНО (udata['stew']/['coins']/['cigarettes'] += count) ПАРАЛЛЕЛЬНО с
 * серверным вебхуком (universal_pay.php.start(), case 'order_status_change'), который
 * начисляет то же самое количество независимо, читая те же donuts.json. Два
 * несинхронизированных источника правды для одного платежа — итоговый баланс мог задвоиться
 * (клиент прибавил локально, сервер прибавил в БД, ближайший автосейв отправил уже удвоенное
 * клиентское значение поверх уже увеличенного серверного).
 *
 * Фикс: клиент больше не считает валюту сам для этих трёх веток — только запрашивает у
 * сервера актуальный баланс через users.get() (с небольшой задержкой, т.к. вебхук VK — это
 * отдельный от VKWebAppShowOrderBoxResult запрос, может прийти чуть позже) и применяет
 * пришедший udata как есть — единственным источником начисления остаётся universal_pay.php.
 *
 * Run: node tests/moderation-bank-double-credit-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const bankJs = read('_client/src/game/bank.js');

console.log('\nTest 1: successDonat() больше не прибавляет stew/coins/cigarettes локально');
{
    const start = bankJs.indexOf('successDonat(){');
    const end   = bankJs.indexOf('\n\t_refreshBalanceAfterPurchase(', start);
    const body  = bankJs.slice(start, end);

    assert(!/udata\['stew'\] = parseInt\(udata\['stew'\]\) \+ count/.test(body), "локальное 'udata[\\'stew\\'] += count' удалено из ветки ТУШЕНКА");
    assert(!/udata\['coins'\] = parseInt\(udata\['coins'\]\) \+ count/.test(body), "локальное 'udata[\\'coins\\'] += count' удалено из ветки МОНЕТЫ");
    assert(!/udata\['cigarettes'\] = parseInt\(udata\['cigarettes'\]\) \+ count/.test(body), "локальное 'udata[\\'cigarettes\\'] += count' удалено из ветки СИГАРЕТЫ");
}

console.log('\nTest 2: все три ветки (stew/coins/cigarettes) вызывают _refreshBalanceAfterPurchase с правильным именем валюты');
{
    // 26.09.2026: добавлен второй аргумент expectedCount (защита от ложноположительной
    // проверки при параллельной трате той же валюты, см. bank-balance-refresh-retry-race-fix).
    assert(/this\._refreshBalanceAfterPurchase\('stew', count\);/.test(bankJs), "ветка ТУШЕНКА вызывает _refreshBalanceAfterPurchase('stew', count)");
    assert(/this\._refreshBalanceAfterPurchase\('coins', count\);/.test(bankJs), "ветка МОНЕТЫ вызывает _refreshBalanceAfterPurchase('coins', count)");
    assert(/this\._refreshBalanceAfterPurchase\('cigarettes', count\);/.test(bankJs), "ветка СИГАРЕТЫ вызывает _refreshBalanceAfterPurchase('cigarettes', count)");
}

console.log('\nTest 3: _refreshBalanceAfterPurchase() запрашивает users.get() и применяет ответ через wrapPlayerData (тот же путь, что и обычный вход в игру)');
{
    const start = bankJs.indexOf('_refreshBalanceAfterPurchase(currency, expectedCount){');
    const end   = bankJs.indexOf('\n\thideBank()', start);
    const body  = bankJs.slice(start, end);

    assert(start !== -1, '_refreshBalanceAfterPurchase() определён');
    assert(/TS\.php\('users\.get', \{uid: vk_params\['vk_user_id'\], users: 'skip'\}/.test(body), 'запрос идёт тем же методом/сигнатурой, что preloader.js.onGetUserInfo()');
    assert(/window\.udata = window\.wrapPlayerData\(e\.udata\);/.test(body), 'ответ применяется через wrapPlayerData — тот же канонический путь загрузки полного состояния игрока');
    assert(/setTimeout\(/.test(body), 'запрос отложен (setTimeout) — даёт вебхуку VK время долететь до сервера раньше повторного чтения');
}

console.log('\nTest 4: dice_points/energy (item24-29, item100-107) НЕ тронуты — они вне запроса пользователя и/или не имеют серверного пути начисления (universal_pay.php не обрабатывает item24-35)');
{
    assert(/udata\['dice_points'\] = \(parseInt\(udata\['dice_points'\] \|\| 0\) \+ gained\)\.toString\(\);/.test(bankJs),
        'ветка ПОИНТЫ ЗАРИКИ по-прежнему начисляется локально (сервер её не обрабатывает — universal_pay.php.loadResponses() не включает item24-35)');
    assert(/if\(window\.TIMERS\) TIMERS\.addEnergy\(gained\);/.test(bankJs), 'ветка ЭНЕРГИЯ не тронута (вне запрошенного изменения)');
}

console.log('\nTest 5: achievements._checkAll() для stew/coins/cigarettes теперь вызывается ПОСЛЕ применения свежего баланса, а не сразу (баланс ещё не обновлён локально)');
{
    const refreshStart = bankJs.indexOf('_refreshBalanceAfterPurchase(currency, expectedCount){');
    const refreshEnd   = bankJs.indexOf('\n\thideBank()', refreshStart);
    const refreshBody  = bankJs.slice(refreshStart, refreshEnd);
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(refreshBody), '_checkAll() вызывается внутри колбэка users.get (после применения актуального баланса)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
