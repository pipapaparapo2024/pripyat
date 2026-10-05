/**
 * Test: 05.10.2026, модерация ОК п.5 ("платежи не работают") — ФИНАЛЬНАЯ версия после ДВУХ живых
 * тестов за один день. Полная цепочка решений (см. tests/ok-pay-callback-fapi-real-exec-05-10.
 * test.js Test 5 и tests/ok-price-display-wired-05-10.test.js Test 7 для подробностей):
 * 1) Прямой FAPI.UI.showPayment() для ОК — первая версия.
 * 2) Упрощено до общего VKWebAppShowOrderBox для VK и ОК (живой лог показал "VK Mini App
 *    Launcher" площадки, перехватывающий этот вызов) — живой ТЕСТ этой версии показал реальную
 *    поломку: цена "null OK" (VKWebAppShowOrderBox не передаёт цену, Launcher не нашёл её в
 *    своём каталоге).
 * 3) Прямой FAPI.UI.showPayment() с ЯВНОЙ ценой (priceOk) возвращён для ОК — у этого пути нет
 *    зависимости от каталога цен площадки. VK остаётся на VKWebAppShowOrderBox (годами работал).
 *
 * Run: node tests/iap-platform-dispatch-04-10.test.js
 */
const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const platformSrc = read('_client/src/modules/platform.js')
    .replace(/^export (function|const)/gm, '$1')
    .replace(/^import .*$/gm, '');

const iapSrc = read('_client/src/modules/iap.js')
    .replace(/^export (async function|function)/gm, '$1')
    .replace(/^import .*$/gm, '');

function makeCtx({ referrer = '', notifyCalls, bridgeCalls }){
    const ctx = {
        document: { referrer },
        window: { location: { ancestorOrigins: undefined } },
        console,
    };
    ctx.window.location = ctx.window.location;
    ctx.bridge = { send: (method, params) => bridgeCalls.push({ method, params }) };
    ctx.window.bridge = ctx.bridge;
    ctx.notify = { showResult: (opts, kind) => notifyCalls.push({ opts, kind }) };
    ctx.window.notify = ctx.notify;
    // window.FAPI сознательно НЕ определён — этот минимальный харнесс не грузит реальный
    // fapi5.js, поэтому _initFapi() должно само это обнаружить и мягко деградировать, не упасть.
    // Живые тесты в реальной ОК (см. докблок файла) подтвердили, что FAPI реально загружается и
    // инициализируется в бою — здесь проверяется именно путь честной деградации на случай, если
    // SDK всё же не пробросится.
    vm.createContext(ctx);
    vm.runInContext(platformSrc, ctx);
    vm.runInContext(iapSrc, ctx);
    return ctx;
}

async function flushMicrotasks(){
    for(let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0));
}

async function run(){
    console.log('\nTest 1: VK (referrer vk.com) — startPurchase() зовёт bridge.send(VKWebAppShowOrderBox), СИНХРОННО');
    {
        const bridgeCalls = [];
        const notifyCalls = [];
        const ctx = makeCtx({ referrer: 'https://vk.com/app123', bridgeCalls, notifyCalls });
        ctx.startPurchase('item5', 100);
        assert(bridgeCalls.length === 1, 'bridge.send вызван ровно один раз, сразу (VK-ветка синхронная)');
        assert(bridgeCalls[0].method === 'VKWebAppShowOrderBox', 'метод — VKWebAppShowOrderBox');
        assert(bridgeCalls[0].params.item === 'item5', 'передан правильный item id');
        assert(notifyCalls.length === 0, 'никакого сообщения "недоступно" для VK не показано');
    }

    console.log('\nTest 2: ОК (referrer ok.ru), FAPI недоступен в сессии — startPurchase() НЕ зовёт VK Bridge, честно сообщает о недоступности (после ожидания промиса _initFapi())');
    {
        const bridgeCalls = [];
        const notifyCalls = [];
        const ctx = makeCtx({ referrer: 'https://ok.ru/game/123', bridgeCalls, notifyCalls });
        ctx.startPurchase('item5', 100);
        assert(notifyCalls.length === 0, 'сразу после вызова сообщение ЕЩЁ не показано — решение асинхронное (ждёт _initFapi())');
        await flushMicrotasks();
        assert(bridgeCalls.length === 0, 'VKWebAppShowOrderBox НЕ вызван (у него нет цены для ОК — см. докблок файла)');
        assert(notifyCalls.length === 1, 'после разрешения промиса игрок получает сообщение (не тихий провал)');
        assert(/недоступн/i.test(notifyCalls[0].opts.text), 'сообщение объясняет, что покупка недоступна, а не выглядит как успех');
        assert(notifyCalls[0].kind === 0, 'сообщение показано как ошибка/предупреждение (kind=0), не как успех (kind=1)');
    }

    console.log('\nTest 3: ОК (referrer odnoklassniki.ru, второй домен площадки) — то же самое поведение');
    {
        const bridgeCalls = [];
        const notifyCalls = [];
        const ctx = makeCtx({ referrer: 'https://odnoklassniki.ru/game/123', bridgeCalls, notifyCalls });
        ctx.startPurchase('item100', 20);
        await flushMicrotasks();
        assert(bridgeCalls.length === 0, 'VKWebAppShowOrderBox не вызван и для alias-домена odnoklassniki.ru');
        assert(notifyCalls.length === 1, 'сообщение о недоступности показано');
    }

    console.log('\nTest 4: неоднозначный/прямой referrer (не ok.ru/odnoklassniki.ru) — безопасный дефолт VK, покупка работает как раньше');
    {
        const bridgeCalls = [];
        const notifyCalls = [];
        const ctx = makeCtx({ referrer: '', bridgeCalls, notifyCalls });
        ctx.startPurchase('item5', 100);
        assert(bridgeCalls.length === 1, 'без явного сигнала ОК — считается VK (безопасный фолбэк для подавляющего большинства игроков)');
        assert(bridgeCalls[0].method === 'VKWebAppShowOrderBox', 'покупка идёт как обычно, не блокируется неопределённостью платформы');
    }

    console.log(`\n${'─'.repeat(50)}`);
    if (failed === 0) console.log(`✅ All ${passed} tests passed`);
    else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
}

run().catch(e => { console.error('❌ Необработанная ошибка теста:', e); process.exit(1); });
