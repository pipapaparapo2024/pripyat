/**
 * Test: попап валюты (ранее bank.atm, ТУШЕНКА/МОНЕТЫ/СУХАРИ) перекрывал нижний HUD, если
 * открывался кликом по иконке валюты в HUD — bank.init() сам добавляет popup в layer2_mc, но
 * НЕ поднимает HUD поверх себя. sidorovich.js (другая точка входа) всегда явно вызывал
 * iface.restoreHud() сразу после bank.init() — оттуда и взялось разное поведение между двумя
 * путями открытия одного и того же попапа.
 *
 * 18.10.2026 (баг найден по прямому указанию — "в магазине всё ещё сигареты, старые ассеты на
 * месте", подтверждено снимком редактора позиций: клик на "+"/иконку валюты в HUD вёл на объект
 * из interface_elements_atlas_1.png 879×491 — это bank_bg, СТАРОЕ окно банка, а не новый попап
 * покупки сухарей): легаси-обработчик клика ПРЯМО на старых FLA-объектах val_stew/val_coins/
 * val_cigarettes (interface-panels.js, CURRENCY_INFO-блок) пережил замену верхнего HUD на новый
 * виджет (interface-top-currency.js, 17.10.2026) — _buildTopCurrencyWidget() прячет старые
 * объекты (visible=false, interactive=false), но initButtons() выполняется ПОСЛЕ upInit() и
 * заново звал setButton(...) → interactive=true, перехватывая клики мимо нового виджета.
 * Для val_cigarettes это напрямую звало bank.init('cigarettes') — старое окно банка на вкладке
 * сигарет (даже label в коде так и остался 'Сигареты'). Блок удалён целиком — Test 1 проверяет,
 * что он НЕ вернётся.
 *
 * 18.10.2026 (ТОТ ЖЕ БАГ-КЛАСС, повторный проход по прямому указанию — "пройдись по всему
 * проекту где есть покупка, FLA → обычные изображения"): нашёлся ВТОРОЙ лазейный путь на то же
 * старое FLA-окно банка — хитбокс `up.butt_bank` в initButtons() (interface-panels.js) вызывал
 * bank.init() напрямую, его interactive принудительно включал _addHoverGlow()→setButton(). Он
 * не был "живым" багом только благодаря порядку вызовов (_buildTopCurrencyWidget() вызывается
 * ПОЗЖЕ и выключает interactive обратно) — но оставался миной на будущее, а главное: konservaHit
 * /boxHit (Сидорович) и btnRubPlus/iconStew/shopBtn (верхний HUD) до этой правки ВСЕ ЕЩЁ звали
 * bank.init('stew')/bank.init('coins')/bank.init() напрямую — то есть покупка консервов и
 * рублей реально открывала старое FLA-окно (убедились, что это так, а не только теоретический
 * риск). Все точки входа переведены на новый 3-вкладочный попап
 * (interface-currency-purchase.js, iface._openCurrencyPurchasePopup(tab)) — Test 2/3/4 это
 * проверяют.
 *
 * Run: node tests/bank-currency-hud-restore.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const panelsSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'interface', 'interface-panels.js'), 'utf-8'
);
const topCurSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'interface', 'interface-top-currency.js'), 'utf-8'
);
const sidSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'sidorovich.js'), 'utf-8'
);
const currPurchSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'interface', 'interface-currency-purchase.js'), 'utf-8'
);

console.log('\nTest 1: легаси-обработчик клика на старых val_stew/val_coins/val_cigarettes УДАЛЁН');
{
    // Регексы ниже ищут реальные ВЫЗОВЫ в коде (с точными сигнатурами старых мест), а не
    // просто подстроку "CURRENCY_INFO"/"bank.init(" — такая подстрока легитимно встречается в
    // пояснительных комментариях об истории бага (см. докблок выше) и давала бы ложный FAIL.
    assert(!/const CURRENCY_INFO = \{/.test(panelsSrc), 'объявление CURRENCY_INFO больше не встречается в interface-panels.js');
    assert(!/\['val_stew', 'val_coins', 'val_cigarettes'\]\.forEach/.test(panelsSrc),
        'цикл по старым FLA-объектам val_* убран');
}

console.log('\nTest 2: легаси-хитбокс butt_bank (второй путь на старое FLA-окно) УДАЛЁН');
{
    assert(!/this\.up\.butt_bank/.test(panelsSrc), 'initButtons() больше не ссылается на this.up.butt_bank');
    assert(!/\n\s*bank\.init\(\);/.test(panelsSrc), 'реального вызова bank.init(); (как отдельного оператора) больше нет в interface-panels.js');
}

console.log('\nTest 3: верхний HUD (рубли/верхняя строка/нижняя строка/магазин) — все 4 клика ведут в НОВЫЙ попап, не в bank.init()');
{
    // 18.10.2026 (по прямому указанию — "смысл стрелки не тот, сухари должны оставаться
    // сверху после клика"): iconStew/btnSuhPlus переименованы в iconPrimary/btnSecondaryPlus —
    // покупка верхней строки теперь ведёт в this._topCurPinned (а не захардкожено в 'stew'),
    // нижняя строка — в otherKey(this._topCurPinned) (а не захардкожено в 'cigarettes').
    assert(!/if\(window\.bank\) bank\.init\(/.test(topCurSrc), 'interface-top-currency.js больше не вызывает bank.init() нигде (реальный код, не комментарии)');
    // 20.10.2026 (по прямому указанию — "правая плашка, где просто плюс, пусть будет сухари"):
    // статичная правая плашка (переменные сохранили старое имя btnRubPlus) теперь показывает
    // сухари, не рубли — её "+" ведёт во вкладку 'cigarettes'.
    assert(/btnRubPlus\.on\('pointerdown', \(\) => \{[\s\S]{0,120}_openCurrencyPurchasePopup\('cigarettes'\)/.test(topCurSrc),
        'правая статичная плашка "+" → _openCurrencyPurchasePopup(\'cigarettes\')');
    // 20.10.2026 (рефакторинг — плашка верхней строки тоже стала интерактивной, см.
    // oct20-batch2-...test.js Test 2c): клик иконки и клик плашки используют общий
    // обработчик _openPrimaryPurchase вместо инлайновой стрелочной функции.
    assert(/const _openPrimaryPurchase = \(\) => \{[\s\S]{0,120}_openCurrencyPurchasePopup\(this\._topCurPinned\)/.test(topCurSrc),
        '_openPrimaryPurchase → _openCurrencyPurchasePopup(this._topCurPinned)');
    assert(/iconPrimary\.on\('pointerdown', _openPrimaryPurchase\);/.test(topCurSrc),
        'иконка верхней строки вызывает _openPrimaryPurchase');
    assert(/platePrimary\.on\('pointerdown', _openPrimaryPurchase\);/.test(topCurSrc),
        'плашка верхней строки тоже вызывает _openPrimaryPurchase');
    assert(/btnSecondaryPlus\.on\('pointerdown', \(\) => \{[\s\S]{0,120}_openCurrencyPurchasePopup\(otherKey\(this\._topCurPinned\)\)/.test(topCurSrc),
        'нижняя строка "+" → _openCurrencyPurchasePopup(otherKey(this._topCurPinned))');
    assert(/shopBtn\.on\('pointerdown', \(\) => \{[\s\S]{0,120}_openCurrencyPurchasePopup\('stew'\)/.test(topCurSrc),
        'кнопка "магазин" → _openCurrencyPurchasePopup(\'stew\')');
}

console.log('\nTest 4: Сидорович (консервы/банка/сухари) — все 3 хит-зоны ведут в НОВЫЙ попап, не в bank.init()');
{
    assert(!/window\.bank && typeof bank\.init/.test(sidSrc), 'sidorovich.js больше не вызывает bank.init() нигде (реальный код, не комментарии)');
    // 18.10.2026 (по прямому указанию — "не нужно делать отдельный хитбокс, наведение должно
    // работать прямо на файле"): konservaHit/boxHit/sigHit (отдельные Graphics-зоны) убраны,
    // обработчики теперь висят прямо на idle-спрайтах (konservaIdle/bankaIdle/sigShelf) — см.
    // sidorovich-hitboxes-removed-direct-sprite-hover.test.js для полной проверки.
    assert(/konservaIdle\.on\('pointerdown', \(\)=>\{[\s\S]{0,120}_openCurrencyPurchasePopup\('stew'\)/.test(sidSrc),
        'консервы → _openCurrencyPurchasePopup(\'stew\')');
    assert(/bankaIdle\.on\('pointerdown', \(\)=>\{[\s\S]{0,120}_openCurrencyPurchasePopup\('coins'\)/.test(sidSrc),
        'банка монет → _openCurrencyPurchasePopup(\'coins\')');
    assert(/sigShelf\.on\('pointerdown', \(\)=>\{[\s\S]{0,120}_openCurrencyPurchasePopup\('cigarettes'\)/.test(sidSrc),
        'сухари → _openCurrencyPurchasePopup(\'cigarettes\')');
}

console.log('\nTest 5: interface-currency-purchase.js — попап реально поддерживает 3 вкладки с правильными item-смещениями');
{
    assert(/export function attachCurrencyPurchase\(proto\)/.test(currPurchSrc), 'экспортирует attachCurrencyPurchase');
    assert(/proto\._openCurrencyPurchasePopup = function\(tab\)/.test(currPurchSrc), '_openCurrencyPurchasePopup(tab) определён');
    assert(/key: 'stew'/.test(currPurchSrc) && /key: 'coins'/.test(currPurchSrc) && /key: 'cigarettes'/.test(currPurchSrc),
        'все 3 вкладки (stew/coins/cigarettes) объявлены');
    assert(/itemBase = \{ stew: 0, coins: stewLen, cigarettes: stewLen \+ coinsLen \}/.test(currPurchSrc),
        'item-смещения совпадают со схемой VK item-номеров (AGENTS.md): stew 0-7, coins 8-15, сухари 16-23');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
