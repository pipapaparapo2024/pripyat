/**
 * Test: 05.10.2026, модерация ОК п.4 ("цена не в валюте площадки"). donuts.json/
 * energy_packs.json теперь содержат price_ok рядом с VK-ценой (price/votes) — bank.js и
 * energy_buy.js должны реально использовать его на площадке ОК, а не только название валюты
 * ("ОК"/"ОКа"/"ОКов", которое уже было подключено раньше через currencyNames()).
 *
 * Run: node tests/ok-price-display-wired-05-10.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf-8');

console.log('\nTest 1: donuts.json содержит price_ok для всех трёх категорий, суммы совпадают с тем, что продиктовал пользователь');
{
    const donuts = JSON.parse(read('server/json/donuts.json'));
    const expected = {
        stew:       [7, 20, 42, 140, 350, 700, 3500, 7000],
        coins:      [7, 14, 20, 35, 210, 700, 3500, 7000],
        cigarettes: [7, 14, 20, 28, 35, 70, 350, 700],
    };
    for (const key of Object.keys(expected)) {
        assert(Array.isArray(donuts[key].price_ok), `${key}.price_ok — массив`);
        assert(JSON.stringify(donuts[key].price_ok) === JSON.stringify(expected[key]), `${key}.price_ok совпадает с продиктованным прайсом`);
        assert(donuts[key].price_ok.length === donuts[key].price.length, `${key}: price_ok и price (VK) — одинаковая длина (те же 8 пакетов)`);
        assert(donuts[key].price_ok.length === donuts[key].default.length, `${key}: price_ok и default (количество товара) — одинаковая длина`);
    }
}

console.log('\nTest 2: energy_packs.json содержит price_ok для всех 8 пакетов, суммы совпадают с продиктованными');
{
    const packs = JSON.parse(read('_client/src/data/energy_packs.json'));
    const expected = [20, 49, 70, 140, 280, 420, 595, 840];
    assert(packs.length === 8, 'ровно 8 пакетов энергии');
    packs.forEach((p, i) => {
        assert(p.price_ok === expected[i], `пакет ${i} (${p.energy} энергии): price_ok=${expected[i]}, получено ${p.price_ok}`);
    });
}

console.log('\nTest 3: bank.js._displayPrice() реально ветвится по платформе (ОК — price_ok напрямую, VK — price/7 как раньше)');
{
    const bankSrc = read('_client/src/game/bank.js');
    assert(/import \{ isOk \} from '\.\.\/modules\/platform\.js';/.test(bankSrc), 'bank.js импортирует isOk()');
    assert(/_displayPrice\(name, i\)\{/.test(bankSrc), '_displayPrice() определён');
    const start = bankSrc.indexOf('_displayPrice(name, i){');
    const end = bankSrc.indexOf('\n\t}', start);
    const body = bankSrc.slice(start, end);
    assert(/isOk\(\) \? donuts_info\[name\]\['price_ok'\]\[i\] : donuts_info\[name\]\['price'\]\[i\] \/ 7/.test(body),
        '_displayPrice() возвращает price_ok напрямую для ОК, price/7 для VK (без изменений в формуле VK)');
}

console.log('\nTest 4: bank.js.genSlots() реально использует _displayPrice() для текста цены (не захардкоженную VK-формулу напрямую)');
{
    const bankSrc = read('_client/src/game/bank.js');
    const start = bankSrc.indexOf('genSlots(name){');
    const end = bankSrc.indexOf('\n\t}', start);
    const body = bankSrc.slice(start, end);
    assert(/const price = this\._displayPrice\(name, i\);/.test(body), 'price_txt строится через _displayPrice()');
    assert(/price_txt\.text = price \+ ' ' \+ helper\.numberEnd\(price, 'votes'\);/.test(body), 'текст цены использует вычисленный price (платформо-зависимый), не price/7 напрямую');
}

console.log('\nTest 5: bank.js.genSlots() запускает покупку через общий startPurchase() (modules/iap.js), не напрямую bridge.send');
{
    const bankSrc = read('_client/src/game/bank.js');
    assert(/import \{ startPurchase \} from '\.\.\/modules\/iap\.js';/.test(bankSrc), 'bank.js импортирует startPurchase()');
    const start = bankSrc.indexOf('genSlots(name){');
    const end = bankSrc.indexOf('\n\t}', start);
    const body = bankSrc.slice(start, end);
    // 05.10.2026 (стале-пин, не регрессия — "давай сделаем через FAPI UI Show Payment": startPurchase()
    // получил 3-й опциональный аргумент label, нужный ОК-ветке для окна FAPI.UI.showPayment).
    assert(/startPurchase\('item' \+ this\.set_donut\.toString\(\), price, count \+ ' ' \+ helper\.numberEnd\(count, name\)\);/.test(body), 'клик по слоту вызывает startPurchase(), не bridge.send(VKWebAppShowOrderBox) напрямую');
    assert(!/bridge\.send\("VKWebAppShowOrderBox"/.test(body), 'прямой вызов VKWebAppShowOrderBox убран из genSlots() (теперь внутри iap.js, только для VK-ветки)');
}

console.log('\nTest 6: energy_buy.js — покупка энергии и на VK, и на ОК идёт через startPurchase() с price_ok, карточки видны на обеих платформах');
{
    const src = read('_client/src/game/shell/popups/energy_buy.js');
    assert(/import \{ isOk \} from '\.\.\/\.\.\/\.\.\/modules\/platform\.js';/.test(src), 'energy_buy.js импортирует isOk()');
    assert(/import \{ startPurchase \} from '\.\.\/\.\.\/\.\.\/modules\/iap\.js';/.test(src), 'energy_buy.js импортирует startPurchase()');
    // 05.10.2026 (стале-пин, не регрессия — "давай сделаем через FAPI UI Show Payment"):
    // 3-й аргумент label добавлен для окна FAPI.UI.showPayment на ОК; "Вариант А" (полное
    // скрытие карточек на ОК, тестировавшееся отдельным файлом ok-hide-purchases-scenario-a-
    // 05-10.test.js тем же днём) отменён в пользу реальной попытки оплаты — карточки снова
    // строятся на обеих платформах, плашка цены в ОКах на ОК вернулась.
    assert(/startPurchase\('item' \+ \(100 \+ i\), opt\.price_ok, opt\.energy \+ ' энергии'\);/.test(src), 'клик по карточке энергии вызывает startPurchase() с itemId/price_ok/label');
    const handlerStart = src.indexOf("slot.on('pointerdown'");
    const handlerEnd = src.indexOf('});', handlerStart);
    const handlerBody = src.slice(handlerStart, handlerEnd);
    assert(!/bridge\.send\('VKWebAppShowOrderBox'/.test(handlerBody), 'прямой вызов VKWebAppShowOrderBox убран из самого обработчика клика (комментарий выше его не считает)');
    // 09.10.2026 (стале-пин, не регрессия — см. tests/energy-buy-unified-cards-platform-price-
    // text.test.js для полной истории): карточки энергии заменены на унифицированный art без
    // цены вообще (для ЛЮБОЙ площадки, не только VK) — текст цены теперь рисуется безусловно,
    // не только внутри if(isOk()){...}, платформа влияет лишь на то, ЧТО именно показывать
    // (price_ok или votes).
    assert(/const price = isOk\(\) \? opt\.price_ok : opt\.votes;/.test(src), 'цена вычисляется по площадке — ОК показывает price_ok, VK показывает votes (раньше VK брал цену из самой картинки)');
    assert(/price \+ ' ' \+ helper\.numberEnd\(price, 'votes'\)/.test(src),
        'текст цены строится из вычисленного price (платформо-зависимого), не захардкожен на opt.price_ok — см. tests/ok-pay-callback-fapi-real-exec-05-10.test.js');
}

console.log('\nTest 7: modules/iap.js — ВОЗВРАЩЁН прямой FAPI.UI.showPayment() для ОК (05.10.2026, живой тест показал "item за null OK": VKWebAppShowOrderBox не передаёт цену, Launcher ОК не нашёл её в своём каталоге — у FAPI.UI.showPayment() цена явный параметр, каталог не нужен)');
{
    const src = read('_client/src/modules/iap.js');
    assert(/export function startPurchase\(itemId, priceOk, label\)\{/.test(src), 'startPurchase() снова принимает priceOk/label — нужны для явной передачи цены в FAPI');
    assert(/if\(isOk\(\)\) return _startOkPurchase\(itemId, priceOk, label\);/.test(src), 'ОК снова ветвится отдельно — VKWebAppShowOrderBox для ОК не годится (нет цены)');
    assert(/bridge\.send\('VKWebAppShowOrderBox', \{ type: 'item', item: itemId \}\);/.test(src), 'VK по-прежнему на VKWebAppShowOrderBox (у VK цена настроена в его собственном кабинете, путь годами работал)');
    assert(/FAPI\.UI\.showPayment\(name, desc, numericId, priceOk, null, null, 'ok', 'true', null\);/.test(src), 'ОК вызывает FAPI.UI.showPayment() с ЯВНОЙ ценой (priceOk) — не зависит от каталога цен площадки');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
