/**
 * Test: 24.10.2026, по прямому указанию — батч правок "Разнарядки" + генерализация богатого
 * тултипа шмотки:
 *
 * 1) Баг "клик по пропущенному дню ничего не открывает" — _failedDaysDesc() игнорировал дни
 *    без явной записи в raznaryadka_data (см. tests/_php_fixtures/raznaryadka-core.php Test 1
 *    для реального PHP-исполнения фикса).
 * 2) Универсальный попап выкупа дня — новые ассеты (фон+2 кнопки, обрезаны от прозрачных
 *    отступов), координаты продиктованы пользователем.
 * 3) Прелоад ассетов "Разнарядки" в game-boot.js.
 * 4) Мелкие правки: позиции 3 иконок наград (+3px вверх), fontSize ВЫПОЛНИ/N ЗАДАНИЙ 16→20,
 *    need/prog обнуляются в ответе сервера до launch_month (скрыт "(0/100)").
 * 5) Dev-панель: шапка "ВЫПОЛНЕНО ЗАДАНИЙ" — новый шрифт (Bebas Neue Pro Bold) и позиция;
 *    кнопка "засеять тестовые данные" (devSeedMonth).
 * 6) Богатый тултип шмотки (имя/бонус/сет/требования) — общий модуль shmot-tooltip.js,
 *    подключён в popups/reward.js (кейс рулетки) и dvor-poker-bag.js (сумка покера), где
 *    раньше была только голая подпись названия или вообще никакой подсказки.
 *
 * Run: node tests/oct24-raznaryadka-buyout-popup-and-tooltip.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const norm = p => fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n');

console.log('\nTest 1: raznaryadka.php — _failedDaysDesc() перебирает ВСЕ дни 1..today-1, не только существующие записи');
{
    const src = norm(path.join(root, 'server/core/controllers/raznaryadka.php'));
    const m = src.match(/private function _failedDaysDesc\(\$data, \$todayDay\)\{[\s\S]*?\n        \}/);
    assert(!!m, '_failedDaysDesc() найден');
    if(m){
        assert(/for\(\$day = 1; \$day < \$todayDay; \$day\+\+\)/.test(m[0]),
            'цикл идёт по всем номерам дней 1..todayDay-1 (не foreach по $data[\'days\'])');
        assert(!/foreach\(\$data\['days'\] \?\? \[\] as \$dayKey/.test(m[0]),
            'старый foreach по существующим записям убран (баг: дни без записи не считались провалом)');
    }
}

console.log('\nTest 2: raznaryadka.php — devSeedMonth() добавлен и в permits');
{
    const src = norm(path.join(root, 'server/core/controllers/raznaryadka.php'));
    assert(/'devSeedMonth'/.test(src), "'devSeedMonth' в \$this->permits");
    assert(/function devSeedMonth\(\)\{/.test(src), 'function devSeedMonth() существует');
    assert(/for\(\$day = 1; \$day < \$today; \$day\+\+\)/.test(src), 'devSeedMonth проходит по всем прошедшим дням');
    assert(/mt_rand\(0, 1\)/.test(src), 'случайный выбор done/pending на каждый день');
}

console.log('\nTest 3: raznaryadka.php — need/prog обнуляются в ответе ДО launch_month (скрыт "(0/100)")');
{
    const src = norm(path.join(root, 'server/core/controllers/raznaryadka.php'));
    assert(/'need'\s*=> \$isPreLaunch \? 0 : intval\(\$todayCfg\['need'\]\),/.test(src), "'need' => 0 при isPreLaunch");
    assert(/'prog'\s*=> \$isPreLaunch \? 0 : intval\(\$data\['days'\]\[strval\(\$today\)\]\['prog'\] \?\? 0\),/.test(src), "'prog' => 0 при isPreLaunch");
}

console.log('\nTest 4: универсальные ассеты попапа — существуют (актив/неактив РАЗНОГО размера, без прозрачных отступов у обоих — проверено PIL getbbox())');
{
    const PNG = require('path').join(root, '_client/development/images');
    const files = ['попап универсальный фон.png', 'попап универсальный кнопка актив.png', 'попап универсальный кнопка неактив.png'];
    files.forEach(f => assert(fs.existsSync(path.join(PNG, f)), `${f} существует в images/`));
}

console.log('\nTest 5: raznaryadka.js — _showBuyoutPopup() заменяет iface._showConfirmPopup в _onDayClick, обе кнопки — общий 2-текстурный компонент (mkUniversalBtn)');
{
    const src = norm(path.join(root, '_client/src/game/shell/overlays/raznaryadka.js'));
    assert(/this\._showBuyoutPopup\(day, cost\);/.test(src), '_onDayClick() вызывает this._showBuyoutPopup(day, cost)');
    assert(!/iface\._showConfirmPopup\('Откатить день/.test(src), 'старый iface._showConfirmPopup() для выкупа убран');
    assert(/_showBuyoutPopup\(day, cost\)\{/.test(src), '_showBuyoutPopup(day, cost) определён');
    assert(/bg\.x = 373; bg\.y = 222;/.test(src), 'фон попапа: x=373, y=222');
    // 24.10.2026 (по прямому указанию — "изначально оба файла неактив, при наведении
    // прозрачность, при нажатии вместо неактив появляется актив"): confirmBtn/cancelBtn больше не
    // два разных статичных спрайта — обе кнопки строятся через mkUniversalBtn() (неактив по
    // умолчанию, anchor 0.5,0.5 на общем BTN_CENTER_Y, подмена на актив на 120мс перед действием).
    assert(/const BTN_INACTIVE = IMG \+ 'попап универсальный кнопка неактив\.png';/.test(src), 'BTN_INACTIVE — файл неактив (стартовая текстура обеих кнопок)');
    assert(/const BTN_ACTIVE = IMG \+ 'попап универсальный кнопка актив\.png';/.test(src), 'BTN_ACTIVE — файл актив (на нажатие)');
    assert(/const BTN_CENTER_Y = 364\.5;/.test(src), 'общий центр Y для обеих кнопок — 364.5');
    assert(/const mkUniversalBtn = \(label, centerX, onAction\) => \{/.test(src), 'mkUniversalBtn(label, centerX, onAction) определён');
    assert(/btn\.anchor\.set\(0\.5, 0\.5\);/.test(src), 'кнопка — anchor(0.5,0.5), чтобы подмена текстуры не сдвигала центр (файлы разного размера)');
    assert(/btn\.texture = PIXI\.Texture\.from\(BTN_ACTIVE\);/.test(src), 'pointerdown подменяет текстуру на актив');
    assert(/setTimeout\(onAction, 120\);/.test(src), 'действие выполняется через 120мс после подмены текстуры (та же задержка, что у confirm.js)');
    assert(/mkUniversalBtn\('ПОДТВЕРДИТЬ', 430 \+ 226 \/ 2, \(\) => \{/.test(src), 'кнопка ПОДТВЕРДИТЬ — центр x=543 (430+226/2)');
    assert(/mkUniversalBtn\('ОТМЕНА', 665 \+ 226 \/ 2, \(\) => \{/.test(src), 'кнопка ОТМЕНА — центр x=778 (665+226/2)');
    assert(/попап универсальный фон\.png/.test(src) && /попап универсальный кнопка актив\.png/.test(src) && /попап универсальный кнопка неактив\.png/.test(src),
        'все 3 файла попапа подключены');
    assert(/txt\.anchor\.set\(0\.5, 0\.5\);/.test(src), 'текст на кнопке центрирован по горизонтали и вертикали (anchor 0.5,0.5)');
}

console.log('\nTest 6: raznaryadka.js — мелкие правки (иконки +3px, fontSize 20, новая шапка Bebas Neue Pro Bold)');
{
    const src = norm(path.join(root, '_client/src/game/shell/overlays/raznaryadka.js'));
    assert(/iconY: 214, icon: 'разнарядка награда рубли\.png'/.test(src), 'рубли: iconY 217->214 (-3px)');
    assert(/iconY: 279, icon: 'разнарядка награда пистолет\.png'/.test(src), 'пистолет: iconY 282->279 (-3px)');
    assert(/iconY: 326, icon: 'разнарядка награда автомат\.png'/.test(src), 'автомат: iconY 329->326 (-3px)');
    assert(/iconY: 388, icon: 'разнарядка награда патроны\.png'/.test(src), 'патроны НЕ трогались (388)');
    assert(/iconY: 456, icon: 'разнарядка награда сундук\.png'/.test(src), 'сундук НЕ трогался (456)');
    assert(/fontSize: 20, fill: GOLD, dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1 \}\);\n            const rowTxt2/.test(src),
        'rowTxt1 ("ВЫПОЛНИ") — fontSize 20 (было 16)');
    assert((src.match(/fontSize: 20, fill: GOLD, dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1 \}\);/g) || []).length >= 2,
        'rowTxt1 и rowTxt2 оба используют fontSize 20');
    // 24.10.2026 (по прямому указанию — "сдвинь влево на 120, подними вверх на 11, уменьши
    // font size на 27"): было fontSize:30, x=580,y=185.
    assert(/fontFamily: 'Bebas Neue Pro Bold', fontSize: 27, fill: GOLD,/.test(src), 'шапка "ВЫПОЛНЕНО ЗАДАНИЙ" — Bebas Neue Pro Bold, 27pt');
    assert(/doneHeaderTxt\.x = 460; doneHeaderTxt\.y = 174;/.test(src), 'шапка позиция x=460, y=174');
}

console.log('\nTest 7: шрифт Bebas Neue Pro Bold подключён (fonts.css + index.html)');
{
    assert(fs.existsSync(path.join(root, '_client/development/fonts/BebasNeueProBold.ttf')), 'BebasNeueProBold.ttf существует');
    assert(/font-family: 'Bebas Neue Pro Bold';/.test(norm(path.join(root, '_client/development/fonts/fonts.css'))),
        '@font-face "Bebas Neue Pro Bold" в fonts.css');
    assert(/font-family: 'Bebas Neue Pro Bold', 'Bebas Neue Pro Bold';/.test(norm(path.join(root, '_client/development/index.html'))),
        'шрифт активирован hidden span в index.html');
}

console.log('\nTest 8: game-boot.js — ассеты "Разнарядки" добавлены в ранний прелоад');
{
    const src = norm(path.join(root, '_client/src/game/game-boot.js'));
    ['разнарядка день 1.png', 'разнарядка день 31.png', 'разнарядка фон.png', 'разнарядка попап рамка.png',
     'задания.png', 'задания hover.png', 'попап универсальный фон.png', 'попап универсальный кнопка актив.png',
     'попап универсальный кнопка неактив.png'].forEach(f => {
        assert(src.includes("'" + f + "'"), `'${f}' в _allGamePngs`);
    });
}

console.log('\nTest 9: dev_panel.js — кнопка "ЗАСЕЯТЬ СЛУЧАЙНО" вызывает raznaryadka.devSeedMonth');
{
    const src = norm(path.join(root, '_client/src/game/shell/overlays/dev_panel.js'));
    assert(/_row\('Прошедшие дни месяца', \[/.test(src), 'строка "Прошедшие дни месяца" добавлена');
    assert(/TS\.php\('raznaryadka\.devSeedMonth', \{\}/.test(src), 'кнопка вызывает raznaryadka.devSeedMonth');
}

console.log('\nTest 10: shmot-tooltip.js — общий модуль богатой карточки шмотки существует и экспортирует buildShmotTooltipCard');
{
    const p = path.join(root, '_client/src/game/shell/shmot-tooltip.js');
    assert(fs.existsSync(p), 'shmot-tooltip.js существует');
    const src = norm(p);
    // 26.10.2026: сигнатура расширена необязательным opts (showRequirements) — для переиспользования
    // в баннере "шанс на шмотку" рюкзака Сидоровича (ryukzak.js), где строки "Требования" не должно
    // быть. Вызов из этого файла (без opts) продолжает работать как раньше — показывает требования.
    assert(/export function buildShmotTooltipCard\(item, opts\)\{/.test(src), 'buildShmotTooltipCard(item, opts) экспортирован');
    assert(/shmot\._setProgress\(item\.set\)/.test(src), 'использует shmot._setProgress() для прогресса сета (тот же метод, что в магазине)');
    assert(/'Требования:'/.test(src), 'строка "Требования:" присутствует (тот же вид, что shmot_shop.js._showShopTip)');
}

console.log('\nTest 11: popups/reward.js — богатая карточка для шмоток с item.shmotItem, фоллбэк на простой тултип без него');
{
    const src = norm(path.join(root, '_client/src/game/shell/popups/reward.js'));
    assert(/import \{ buildShmotTooltipCard \} from '\.\.\/shmot-tooltip\.js';/.test(src), 'импорт buildShmotTooltipCard');
    assert(/if\(shmotItem\)\{/.test(src), '_showNameTip() ветвится на shmotItem (богатая карточка) vs имя (фоллбэк)');
    assert(/_showNameTip\(slotX, ITEM_Y - CARD_H \/ 2 - 10, item\.name, item\.shmotItem\)/.test(src),
        'вызов передаёт item.shmotItem четвёртым аргументом');
}

console.log('\nTest 12: dvor-roulette-buy.js — передаёт shmotItem (полный предмет каталога) в reward.js');
{
    const src = norm(path.join(root, '_client/src/game/dvor/dvor-roulette-buy.js'));
    assert(/rewards\.push\(\{type:'shmot', amount:1, name: shmotItem \? shmotItem\.name : 'Элемент шмотки', shmotItem\}\);/.test(src),
        'rewards.push() включает shmotItem (не только name)');
}

console.log('\nTest 13: dvor-poker-bag.js — добавлен hover-тултип шмотки (раньше не было вообще никакого)');
{
    const src = norm(path.join(root, '_client/src/game/dvor/dvor-poker-bag.js'));
    assert(/import \{ buildShmotTooltipCard \} from '\.\.\/shell\/shmot-tooltip\.js';/.test(src), 'импорт buildShmotTooltipCard');
    assert(/const shmotItem = \(shmotItemId !== null && shmotItemId !== undefined && window\.shmot\)/.test(src),
        'ищет полный предмет каталога по shmotItemId (параметр раньше не использовался вообще)');
    assert(/tatuHit\.on\('pointerover', \(\) => \{ tatuTip\.visible = true; \}\);/.test(src),
        'hit-зона наведения на число/надпись тату показывает карточку');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
