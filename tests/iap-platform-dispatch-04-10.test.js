/**
 * Test: 05.10.2026, модерация ОК п.5 ("платежи не работают") — финальная версия после разбора
 * РЕАЛЬНОГО консольного лога живой сессии в ОК. Таблица совместимости apiok.ru ("VKWebAppShowOrderBox
 * — не поддерживается на ОК"), на которой строился предыдущий дизайн (отдельная ОК-ветка через
 * прямой FAPI.UI.showPayment()), оказалась неверной для кросспостинг-приложений: живой лог
 * показал "[VK MINI APP] Launcher v. 0.1.136" с handlers:-списком, явно включающим
 * VKWebAppShowOrderBox — площадка ОК сама перехватывает этот VK Bridge-вызов и обслуживает его
 * (тот же Launcher уже прозрачно обслуживал VKWebAppGetAuthToken/VKWebAppStorageGet/Set, которые
 * этот проект и раньше вызывал одинаково для VK и ОК без проблем).
 *
 * 05.10.2026 (стале-пин, не регрессия — переход от "ОК через отдельный FAPI-путь" к "ОК и VK
 * идентичны"): modules/iap.js.startPurchase() больше НЕ ветвится по платформе — тест ниже
 * проверяет, что referrer (vk.com/ok.ru/odnoklassniki.ru/неизвестный) не влияет на поведение
 * покупки вообще, она всегда идёт через bridge.send('VKWebAppShowOrderBox', ...).
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

const iapSrc = read('_client/src/modules/iap.js')
    .replace(/^export (async function|function)/gm, '$1')
    .replace(/^import .*$/gm, '');

function makeCtx({ bridgeCalls }){
    const ctx = { console };
    ctx.bridge = { send: (method, params) => bridgeCalls.push({ method, params }) };
    ctx.window = { bridge: ctx.bridge };
    vm.createContext(ctx);
    vm.runInContext(iapSrc, ctx);
    return ctx;
}

function run(){
    const scenarios = [
        { label: 'VK (vk.com)', },
        { label: 'ОК (ok.ru)', },
        { label: 'ОК (odnoklassniki.ru)', },
        { label: 'неизвестный/прямой заход', },
    ];

    scenarios.forEach(({ label }) => {
        console.log(`\nТест: ${label} — startPurchase() одинаково вызывает VKWebAppShowOrderBox (платформа больше не проверяется в iap.js)`);
        const bridgeCalls = [];
        const ctx = makeCtx({ bridgeCalls });
        ctx.startPurchase('item5');
        assert(bridgeCalls.length === 1, 'bridge.send вызван ровно один раз, синхронно');
        assert(bridgeCalls[0].method === 'VKWebAppShowOrderBox', 'метод — VKWebAppShowOrderBox');
        assert(bridgeCalls[0].params.item === 'item5', 'передан правильный item id');
    });

    console.log('\nТест: лишние аргументы (priceOk/label, нужные старым вызовам из bank.js/energy_buy.js) не ломают вызов');
    {
        const bridgeCalls = [];
        const ctx = makeCtx({ bridgeCalls });
        ctx.startPurchase('item107', 3500, '3500 энергии');
        assert(bridgeCalls.length === 1, 'лишние аргументы просто игнорируются, вызов проходит');
        assert(bridgeCalls[0].params.item === 'item107', 'item id передан верно даже с доп. аргументами');
    }

    console.log(`\n${'─'.repeat(50)}`);
    if (failed === 0) console.log(`✅ All ${passed} tests passed`);
    else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
}

run();
