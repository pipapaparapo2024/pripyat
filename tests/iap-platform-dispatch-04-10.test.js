/**
 * Test: 05.10.2026, модерация ОК п.5 ("платежи не работают") — bank.js/energy_buy.js раньше
 * ВСЕГДА вызывали VKWebAppShowOrderBox (VK Pay), которую площадка ОК не поддерживает. Общий
 * модуль modules/iap.js разводит платформы: VK — поведение не изменилось (прямой bridge.send,
 * синхронно), ОК — пытается реальный FAPI.UI.showPayment() (см. tests/ok-pay-callback-fapi-
 * real-exec-05-10.test.js для деталей этой попытки), с защитной деградацией в то же честное
 * сообщение "недоступно", если FAPI недоступен в сессии.
 *
 * 05.10.2026 (стале-пин, не регрессия — переход от "ОК всегда честно недоступно" к "ОК сначала
 * пробует FAPI"): _startOkPurchase() стала АСИНХРОННОЙ (ждёт промис _initFapi() перед решением,
 * что делать) — в этом минимальном vm-окружении window.FAPI никогда не определён, поэтому
 * _initFapi() всегда резолвится в false, и тесты ниже всё ещё проверяют ИМЕННО путь деградации
 * (тот же честный текст, что был раньше), просто теперь нужно дождаться микротаска после вызова
 * startPurchase() перед проверкой notifyCalls/bridgeCalls.
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
    vm.createContext(ctx);
    // platform.js сначала (iap.js импортирует isOk из него — после удаления import нужно
    // склеить оба исходника в один скрипт, чтобы imports резолвились как обычные вызовы функций
    // в общем контексте).
    vm.runInContext(platformSrc, ctx);
    vm.runInContext(iapSrc, ctx);
    return ctx;
}

// Промис внутри _startOkPurchase резолвится асинхронно (даже когда FAPI сразу недоступен) —
// даём событийному циклу несколько тиков, прежде чем проверять результат.
async function flushMicrotasks(){
    for(let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0));
}

async function run(){
    console.log('\nTest 1: VK (referrer vk.com) — startPurchase() зовёт bridge.send(VKWebAppShowOrderBox) как раньше, СИНХРОННО');
    {
        const bridgeCalls = [];
        const notifyCalls = [];
        const ctx = makeCtx({ referrer: 'https://vk.com/app123', bridgeCalls, notifyCalls });
        ctx.startPurchase('item5', 100);
        assert(bridgeCalls.length === 1, 'bridge.send вызван ровно один раз, сразу (VK-ветка осталась синхронной)');
        assert(bridgeCalls[0].method === 'VKWebAppShowOrderBox', 'метод — VKWebAppShowOrderBox (как раньше, без изменений для VK)');
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
        assert(bridgeCalls.length === 0, 'VKWebAppShowOrderBox НЕ вызван (ОК его не поддерживает — вызов был бы бессмысленным)');
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
