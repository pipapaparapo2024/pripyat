/**
 * Test: 09.10.2026, живой репорт — попытка купить что-либо на ОК показывает "Покупки на этой
 * площадке временно недоступны", но присланный console-лог обрывается ДО момента клика по
 * покупке (видны только логи загрузки Launcher'а ОК, не наши собственные [iap.*] логи) — то
 * есть реальная причина отказа (невалидный priceOk? FAPI.init() не удался? исключение в
 * FAPI.UI.showPayment?) осталась неизвестна по присланным данным.
 *
 * Правило №8 (подробное логирование) — добавлены диагностические console.log/console.error на
 * каждом шаге _initFapi()/_startOkPurchase(), чтобы при следующей попытке в реальной сессии ОК
 * было видно, на чём именно ломается: состояние window.FAPI/window.FAPI.UI ДО инициализации,
 * сырой ответ FAPI.Util.getRequestParameters(), полный err-объект из FAPI.init(), и аргументы
 * непосредственно перед вызовом FAPI.UI.showPayment().
 *
 * Run: node tests/iap-ok-fapi-diagnostic-logging.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'iap.js'), 'utf-8');

console.log('\nTest 1: _initFapi() логирует состояние window.FAPI/window.FAPI.UI ДО попытки инициализации');
{
    const start = src.indexOf('function _initFapi(){');
    const end = src.indexOf('\nfunction _okUnavailable', start);
    const body = src.slice(start, end);
    assert(/console\.log\('\[iap\._initFapi\] состояние перед инициализацией/.test(body),
        'диагностический лог состояния window.FAPI присутствует ДО создания промиса инициализации');
    assert(/typeof window\.FAPI/.test(body) && /Object\.keys\(window\.FAPI\)/.test(body),
        'лог включает typeof window.FAPI и список его ключей (а не просто true/false)');
    assert(/window\.FAPI\.UI/.test(body) && /Object\.keys\(window\.FAPI\.UI/.test(body),
        'лог включает отдельно наличие и ключи window.FAPI.UI — именно его метод showPayment реально вызывается');
}

console.log('\nTest 2: FAPI.Util.getRequestParameters() логируется целиком (не просто warn при отсутствии полей)');
{
    assert(/console\.log\('\[iap\._initFapi\] FAPI\.Util\.getRequestParameters\(\) вернул:', JSON\.stringify\(rParams\)\);/.test(src),
        'сырой rParams логируется ВСЕГДА, не только в ветке отказа — видно даже когда поля формально присутствуют, но содержат неожиданное');
}

console.log('\nTest 3: FAPI.init() error-колбэк логирует err целиком, не только факт ошибки');
{
    assert(/console\.error\('\[iap\._initFapi\] FAPI\.init вернул ошибку \| err:', JSON\.stringify\(err\), '\| err целиком:', err\);/.test(src),
        'err сериализуется через JSON.stringify И передаётся целиком — объект ошибки мог бы потеряться при одной лишь строковой интерполяции');
}

console.log('\nTest 4: исключение при вызове FAPI.init() логирует message И stack (не просто объект e)');
{
    assert(/console\.error\('\[iap\._initFapi\] исключение при инициализации FAPI \| message:', e\.message, '\| stack:', e\.stack\);/.test(src),
        'e.message и e.stack логируются раздельно — явно читаемая причина и трассировка');
}

console.log('\nTest 5: аргументы FAPI.UI.showPayment() логируются непосредственно перед вызовом (успешный путь тоже инструментирован, не только ошибки)');
{
    const start = src.indexOf('function _startOkPurchase(itemId, priceOk, label){');
    const end = src.indexOf('\n// Единая точка входа', start);
    const body = src.slice(start, end);
    assert(/console\.log\('\[iap\._startOkPurchase\] зову FAPI\.UI\.showPayment/.test(body),
        'лог непосредственно перед вызовом FAPI.UI.showPayment() присутствует');
    assert(/typeof FAPI\.UI\.showPayment/.test(body),
        'лог включает typeof FAPI.UI.showPayment — если Launcher ОК не реализует этот метод (только эмулирует часть SDK), это будет видно СРАЗУ ("undefined"), а не как позже проглоченное исключение');
}

console.log('\nTest 6: уже инициализированный Launcher ОК не блокируется повторной проверкой launch-параметров');
{
    const start = src.indexOf('function _initFapi(){');
    const end = src.indexOf('\nfunction _okUnavailable', start);
    const body = src.slice(start, end);
    assert(/FAPI\.UI\.showPayment уже доступен/.test(body),
        'при доступном FAPI.UI.showPayment используется готовая инициализация Launcher ОК');
    assert(/resolve\(true\);\s*return;/.test(body),
        'готовый UI-метод немедленно разрешает покупку, не требуя api_server/apiconnection повторно');
}

console.log('\nTest 7: результат FAPI-платежа ОК логируется через глобальный API_callback');
{
    assert(/function _installOkPaymentCallback\(\)/.test(src), 'установлен отдельный обработчик API_callback');
    assert(/window\.API_callback = function\(method, result, data\)/.test(src), 'API_callback получает method/result/data по контракту FAPI');
    assert(/_installOkPaymentCallback\(\);\s*FAPI\.UI\.showPayment/.test(src), 'обработчик результата ставится до показа диалога оплаты');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
