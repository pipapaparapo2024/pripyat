/**
 * Test: 05.10.2026, по прямому указанию — "давай сделаем через FAPI UI Show Payment... посмотрим
 * что скажет модерация". Реальное исполнение OkPayCallback (server/ok_pay_callback.php) через
 * локальный PHP — подпись/каталог товаров/санитизация transaction_id/идемпотентный ключ, не
 * просто grep по тексту файла.
 *
 * Поток целиком (обновлено 05.10.2026 после живого лога ОК — см. Test 5 ниже): игрок жмёт
 * "Купить" → modules/iap.js.startPurchase() зовёт bridge.send('VKWebAppShowOrderBox', ...),
 * тот же вызов, что и на VK → ОК-овский "VK Mini App Launcher" сам перехватывает его и
 * показывает своё окно оплаты → игрок подтверждает → ОК шлёт подписанный GET на
 * server/ok_pay_callback.php → сервер проверяет подпись (OkPayCallback::checkSig(), тот же
 * md5(sorted_params+secret), что у VK-webhook) и начисляет товар.
 *
 * Секрет для проверки подписи — общий с VK (registry.php['api_secret']), отдельного секрета
 * ОК не существует для кросспостинг-приложений (см. Test 8 ниже).
 *
 * Run: node tests/ok-pay-callback-fapi-real-exec-05-10.test.js
 */
const fs   = require('fs');
const path = require('path');
const { findPhpBin } = require('./_php_bin.js');
const { execFileSync } = require('child_process');

let passed = 0, failed = 0;
function assertRegex(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf-8');

const phpBin = findPhpBin();
if (phpBin) {
    const fixture = path.join(__dirname, '_php_fixtures', 'ok-pay-callback-core.php');
    let stdout;
    try {
        stdout = execFileSync(phpBin, ['-d', 'display_errors=stderr', fixture], { encoding: 'utf-8', timeout: 15000 });
    } catch (e) {
        console.error('❌ PHP-скрипт упал (фатальная ошибка):');
        console.error(e.stderr || e.message);
        process.exit(1);
    }
    stdout.trim().split('\n').forEach(line => {
        if (line.startsWith('PASS:')) { console.log('  ✅', line.slice(6)); passed++; }
        else if (line.startsWith('FAIL:')) { console.error('  ❌ FAIL:', line.slice(6)); failed++; }
        else if (line.startsWith('===')) console.log('\n' + line.replace(/=== | ===/g, ''));
        else if (line.trim()) console.log('  ', line);
    });
} else {
    console.log('⚠️  PHP не найден локально — реальное исполнение OkPayCallback пропущено (см. tests/_php_bin.js), ниже только текстовые проверки.');
}

console.log('\nTest 2: исполняемая часть ok_pay_callback.php — секрет берётся из api_secret (общий с VK), не из отдельного ok_api_secret');
{
    // 05.10.2026 (стале-пин, не регрессия — уточнение по прямому вопросу пользователя "можно ли
    // найти application_secret_key, если кабинета ОК отдельно нет"): проверено дословной цитатой
    // apiok.ru/apps/vk — "Секретный ключ остаётся идентичным приложению в ВКонтакте". Отдельного
    // ok_api_secret не существует и не заводится — fail-closed-заглушка (ждать несуществующий
    // ключ) убрана, используется уже имеющийся $registry['api_secret'].
    const src = read('server/ok_pay_callback.php');
    assertRegex(/\$secret = \$registry\['api_secret'\];/.test(src), 'читает секрет из уже существующего api_secret (общий с VK-webhook), не из отдельного ok_api_secret');
    assertRegex(!/\$registry\['ok_api_secret'\]/.test(src), 'отдельный ok_api_secret НЕ читается как исполняемый код (строка может остаться только в поясняющем комментарии истории решения)');
}

console.log('\nTest 3: исполняемая часть — формат ответа ОК (голое true / {error_code,...}), не формат VK');
{
    const src = read('server/ok_pay_callback.php');
    assertRegex(/function respondOk\(\)\{\s*\n\s*\/\/[^\n]*\n\s*echo 'true';\s*\n\s*exit;/.test(src),
        'успех — голое echo \'true\' (строка "true", не JSON-объект {"response":...} как у VK)');
    assertRegex(/function respondError\(\$code, \$msg\)\{\s*\n\s*echo json_encode\(\['error_code' => \$code, 'error_msg' => \$msg, 'error_data' => null\]\);/.test(src),
        'отказ — {error_code,error_msg,error_data:null}, формат ОК из apiok.ru, не формат VK');
}

console.log('\nTest 4: исполняемая часть — идемпотентность (повторный transaction_id не начисляет дважды)');
{
    const src = read('server/ok_pay_callback.php');
    assertRegex(/\$transaction = \$registry\['udb'\]->getData\('trans', \['\*'\], "tid='" \. \$tid \. "'"\);/.test(src),
        'проверяет существующую транзакцию по tid (с префиксом ok_) перед начислением');
    const idx = src.indexOf("if(!isset(\$transaction['error'])){");
    const body = src.slice(idx, src.indexOf('}', idx) + 1);
    assertRegex(/respondOk\(\);/.test(body), 'уже обработанный transaction_id отвечает успехом (идемпотентно), но без повторного начисления');
}

console.log('\nTest 5: modules/iap.js — 05.10.2026 (живой консольный лог ОК): прямой вызов FAPI.init()/FAPI.UI.showPayment() убран, покупка идёт через VKWebAppShowOrderBox для обеих площадок');
{
    // Живой лог сессии внутри реальной ОК показал "[VK MINI APP] Launcher v. 0.1.136" с
    // handlers:-списком, явно включающим VKWebAppShowOrderBox — площадка сама перехватывает этот
    // VK Bridge-вызов и транслирует его в FAPI внутри себя. Таблица совместимости apiok.ru,
    // на которую опирались раньше ("VKWebAppShowOrderBox — не поддерживается"), для
    // кросспостинг-приложений оказалась неверной/устаревшей. См. tests/ok-price-display-wired-
    // 05-10.test.js Test 7 — там же проверено итоговое содержимое startPurchase().
    const src = read('_client/src/modules/iap.js');
    assertRegex(!/FAPI\.init\(/.test(src), 'FAPI.init() больше не вызывается из клиентского кода');
    assertRegex(!/FAPI\.UI\.showPayment\(name/.test(src), 'FAPI.UI.showPayment(name,...) больше не вызывается из клиентского кода (в докблоке остаётся только упоминание в прозе истории решения)');
    assertRegex(!/_okUnavailable/.test(src), 'честная заглушка "недоступно" убрана — покупка больше не деградирует отдельно для ОК');
}

console.log('\nTest 7: index.html — подключён скрипт FAPI SDK, VK-путь не задет');
{
    const src = read('_client/development/index.html');
    assertRegex(/<script type="text\/javascript" src="\/\/api\.ok\.ru\/js\/fapi5\.js" defer="defer"><\/script>/.test(src),
        'FAPI SDK подключён тем тегом, что указан в документации apiok.ru/dev/sdk/js/init');
}

console.log('\nTest 8: registry.php — отдельный ok_api_secret НЕ заводится (уточнение по вопросу пользователя, дословная цитата apiok.ru)');
{
    const src = read('server/core/models/registry.php');
    assertRegex(!/\$registry\['ok_api_secret'\]/.test(src) && !/'ok_api_secret'=>/.test(src),
        'отдельный ok_api_secret не заводится в $vars — секрет кросспостинг-приложения совпадает с VK (api_secret)');
    assertRegex(/Секретный ключ остаётся идентичным[\s\S]{0,20}приложению в ВКонтакте/.test(src),
        'комментарий содержит дословную цитату apiok.ru, объясняющую, почему отдельный ключ не нужен');
}

console.log('\nTest 9: bank.js/energy_buy.js — покупки на ОК снова видимы (не Вариант А), ведут в startPurchase() с label');
{
    const bankSrc = read('_client/src/game/bank.js');
    assertRegex(!/_showOkUnavailable/.test(bankSrc), 'старый Вариант А (скрытие слотов) убран из bank.js — решение пересмотрено в пользу реальной попытки FAPI');
    assertRegex(/startPurchase\('item' \+ this\.set_donut\.toString\(\), price, count \+ ' ' \+ helper\.numberEnd\(count, name\)\);/.test(bankSrc),
        'genSlots() передаёт читаемый label (для окна оплаты ОК) третьим аргументом в startPurchase()');

    const energySrc = read('_client/src/game/shell/popups/energy_buy.js');
    assertRegex(!/Покупки на этой платформе\\nвременно недоступны/.test(energySrc), 'старое сообщение-заглушка убрано из energy_buy.js — карточки снова кликабельны на ОК');
    assertRegex(/startPurchase\('item' \+ \(100 \+ i\), opt\.price_ok, opt\.energy \+ ' энергии'\);/.test(energySrc),
        'карточка энергии передаёт label в startPurchase()');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed${phpBin ? ' (включая реальное исполнение PHP ' + phpBin + ')' : ''}`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
