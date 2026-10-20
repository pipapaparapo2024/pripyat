/**
 * Test: батч 18.10.2026 (третий за день, по прямому указанию) — набор мелких UI-фиксов и один
 * содержательный поведенческий кусок (новая логика попапа покупки):
 *
 *  1) interface.js — хитбокс тултипа трека уровня (expHit) расширен под реальный размер
 *     спрайта трека (95,55,261,29) вместо старой плоской полоски (90,50,190,20) — трек был
 *     частично "мёртвой зоной" без тултипа.
 *  2) interface.js — хитбокс никнейма (146,19,152,42), ник центрируется анкером внутри него
 *     вместо прямой интерактивности самого текста (длина ника больше не двигает видимый центр).
 *  3) interface.js — STRAY_SIZES получил третий размер (69×69) — ещё один безымянный остаток
 *     старого FLA-экспорта, который нужно прятать вместе с уже известными двумя.
 *  4) interface-top-currency.js — up.ava переносится в конец списка детей `up` (z-индекс выше
 *     нового виджета валют) — раньше аватар рисовался ПОД новыми плашками.
 *  5) interface-currency-purchase.js — новый общий маркер "активный слот.png" (жёлтый кружок,
 *     x:211, y по категории) + новые per-категория файлы "активное нажатие" вместо старых
 *     "вкладка иконка", позиции вкладок (244, 181/278/379), количество/цена сдвинуты на ±16px.
 *  6) interface-bottom-nav.js — индивидуальные доп. сдвиги вправо: оружейка+12, шмотки+24,
 *     банда+36, босс+48, сидорович+50 (поверх общего +17 от более раннего батча).
 *  7) dvor-blackjack.js — playBtn/doneGfx/priceSpr ещё -20x/+10y (поверх уже применённого -30x);
 *     BJ_ROW_Y.__nonpair 522 → 530.
 *  8) dvor-poker-bag.js — счётчик спичек закрытой сумки: x:309,y:323, fontSize 31→29 (-2px).
 *  9) sidorovich.js — сухари/сухари-актив/хитбокс ещё -6px вверх (поверх уже применённого -32).
 * 10) vassilich.js / sidorovich.js / game-boot.js — yashik_activ.png убран из игры целиком.
 * 11) habar.js / game-boot.js — фон хабара обновлён на новый файл (v2 → v3).
 *
 * Чисто позиционные правки (x/y/scale) без изменения логики — по правилу №10 AGENTS.md тестов
 * не требуют; здесь покрыты ТОЛЬКО те, что проще/надёжнее проверить структурно (новый
 * хитбокс/маркер/порядок детей/удаление ссылки), вперемешку с несколькими числовыми якорями
 * для регресс-защиты (поймать случайную потерю правки).
 *
 * Run: node tests/oct18-batch3-ui-polish-and-active-slot.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const ifaceSrc      = read('_client/src/game/interface.js');
const topCurSrc      = read('_client/src/game/interface/interface-top-currency.js');
const currPurchSrc   = read('_client/src/game/interface/interface-currency-purchase.js');
const bottomNavSrc   = read('_client/src/game/interface/interface-bottom-nav.js');
const bjSrc          = read('_client/src/game/dvor/dvor-blackjack.js');
const pokerBagSrc    = read('_client/src/game/dvor/dvor-poker-bag.js');
const sidSrc         = read('_client/src/game/shell/overlays/sidorovich.js');
const vasSrc         = read('_client/src/game/vassilich.js');
const habarSrc       = read('_client/src/game/habar.js');
const bootSrc        = read('_client/src/game/game-boot.js');

console.log('\n1) interface.js — хитбокс тултипа трека уровня расширен под реальный размер спрайта');
{
    assert(/expHit\.drawRect\(0, 0, 261, 29\)/.test(ifaceSrc), 'expHit покрывает 261×29 (размер lvl_bar_track)');
    // 18.10.2026 (ещё раз тем же днём — "хитбокс для уровня сдвинь влево на 3px"): -3 добавлен.
    assert(/expHit\.x = 95 - 3; expHit\.y = 55;/.test(ifaceSrc), 'expHit стоит на x:92,y:55 (позиция lvl_bar_track, доп. -3)');
}

console.log('\n2) interface.js — хитбокс никнейма + центрирование текста');
{
    assert(/nickHit\.drawRect\(0, 0, 152, 42\)/.test(ifaceSrc), 'nickHit — 152×42');
    // 18.10.2026 (ещё раз тем же днём — "хитбокс для никнейма подними вверх на 1px"): -1 добавлен.
    assert(/nickHit\.x = 146; nickHit\.y = 19 - 1;/.test(ifaceSrc), 'nickHit стоит на x:146,y:18 (доп. -1)');
    assert(/this\.nick_txt\.anchor\.x = 0\.5;/.test(ifaceSrc), 'nick_txt заякорен по центру горизонтально');
    assert(/this\.nick_txt\.x = 146 \+ 152 \/ 2;/.test(ifaceSrc), 'nick_txt.x — центр хитбокса');
    assert(!/this\.nick_txt\.interactive = true;/.test(ifaceSrc), 'nick_txt больше не интерактивен напрямую — кликабельность на nickHit');
}

console.log('\n3) interface.js — STRAY_SIZES учитывает третий безымянный остаток (69×69)');
{
    assert(/\{ w: 69, h: 69 \},/.test(ifaceSrc), 'STRAY_SIZES содержит {w:69,h:69}');
}

console.log('\n4) interface-top-currency.js — аватар переносится в конец (выше нового виджета по z-индексу)');
{
    // 18.10.2026 (ещё раз тем же днём — "хитбокс иконки игрока нужно уметь редактировать"):
    // блок расширен — теперь ещё и ставит _uDraggable, см. секцию ниже.
    assert(/if\(up\.ava\)\{\s*\n\s*up\.addChild\(up\.ava\);/.test(topCurSrc), 'up.ava явно переносится в конец списка детей `up`');
}

console.log('\n5) interface-currency-purchase.js — активный слот + активное нажатие по категориям');
{
    assert(/const ACTIVE_SLOT_X = 211;/.test(currPurchSrc), 'ACTIVE_SLOT_X = 211 (общий x для всех 3 категорий)');
    assert(/activeSlotY: 212,/.test(currPurchSrc) && /activeSlotY: 303,/.test(currPurchSrc) && /activeSlotY: 402,/.test(currPurchSrc),
        'activeSlotY — 212 (тушёнка) / 303 (рубли) / 402 (сухари)');
    assert(/tabY: 181,/.test(currPurchSrc) && /tabY: 278,/.test(currPurchSrc) && /tabY: 379,/.test(currPurchSrc),
        'tabY — 181 (тушёнка) / 278 (рубли) / 379 (сухари)');
    assert(/const TAB_X = 244;/.test(currPurchSrc), 'TAB_X = 244 (было 245)');
    assert(/iconFile: 'попап покупки консервы активное нажатие\.png'/.test(currPurchSrc), 'тушёнка — новый файл "активное нажатие"');
    assert(/iconFile: 'попап покупки рубли активное нажатие\.png'/.test(currPurchSrc), 'рубли — новый файл "активное нажатие"');
    assert(/iconFile: 'попап покупки сухари активное нажатие\.png'/.test(currPurchSrc), 'сухари — новый файл "активное нажатие"');
    assert(/попап покупки активный слот\.png/.test(currPurchSrc), 'общий файл жёлтого маркера подключён');
    // 18.10.2026 (4-е указание тем же днём — "ещё вниз на 5px"): def.activeSlotY + 5.
    assert(/activeSlotSpr\.y = def\.activeSlotY \+ 5;/.test(currPurchSrc), '_switchTab переставляет activeSlotSpr по activeSlotY активной вкладки + 5');
    assert(!/'попап покупки консервы вкладка иконка\.png'/.test(currPurchSrc), 'старое имя файла консервов больше не используется');

    // 18.10.2026 (повторное указание тем же днём — три доп. правки):
    // a) scale 1.03 + доп. (+2,+2) у "активное нажатие", activeSlotSpr ещё (+7,+7);
    assert(/spr\.x = TAB_X \+ 2; spr\.y = t\.tabY \+ 2;/.test(currPurchSrc), 'иконка активной вкладки — доп. +2x/+2y');
    assert(/spr\.scale\.set\(1\.03\);/.test(currPurchSrc), 'иконка активной вкладки — scale 1.03');
    assert(/activeSlotSpr\.x = ACTIVE_SLOT_X \+ 7;/.test(currPurchSrc), 'activeSlotSpr — доп. +7x (+7y через activeSlotY, см. п.5 выше)');

    // b) баг "вкладки не переключаются" — раньше клик висел на visible-зависимом спрайте
    // (невидимые вкладки не хит-тестились), теперь отдельный ВСЕГДА интерактивный хитбокс:
    assert(/hit\.on\('pointerdown', \(\) => _switchTab\(t\.key\)\);/.test(currPurchSrc), 'клик переключения вкладки висит на отдельном hit, не на visible-спрайте');
    assert(!/spr\.on\('pointerdown', \(\) => _switchTab\(t\.key\)\);/.test(currPurchSrc), 'клик больше НЕ висит на самом tabIcons-спрайте (баг: invisible-спрайты не хит-тестятся)');

    // c) направление count/price было перепутано (count ушёл вверх, price вниз — должно быть
    // наоборот) — исправлено и применена новая амплитуда 32px от ИСХОДНЫХ базовых позиций:
    // 18.10.2026 (4-е указание тем же днём — "ещё на 16px, количество вниз, цена вверх"): ±32 → ±48.
    // 19.10.2026 (по прямому указанию, направление ЧАСТИЧНО откатилось — "цена вниз на 33px,
    // количество вверх на 31px"): новые упрощённые абсолютные значения — см.
    // oct19-batch-....test.js за полным покрытием этой правки.
    assert(/countTxt\.y = slot\.y \+ 25;/.test(currPurchSrc), 'количество (countTxt) — slot.y+25 (19.10.2026, было +56)');
    assert(/priceTxt\.y = slot\.y \+ 170;/.test(currPurchSrc), 'цена (priceTxt) — slot.y+170 (19.10.2026, было +137)');
    // 20.10.2026: TXT_STYLE_COUNT/PRICE больше не отдельные литералы с плоским белым fill —
    // переведены на общий TXT_STYLE_BASE (перенос стиля слоя из Photoshop: градиент/обводка/
    // тень, см. tests/currency-purchase-text-style-photoshop-transfer.test.js за полной
    // проверкой) и строятся через Object.assign. Southbank LT 18px и белый (теперь — верхний
    // цвет градиента) по-прежнему сохранены.
    assert(/fontFamily: 'Southbank LT', fontSize: 18,/.test(currPurchSrc), 'базовый стиль — Southbank LT 18px (картинка 2)');
    assert(/fill: \['#ffffff', '#c8c8c8'\],/.test(currPurchSrc), 'заливка — градиент, верхний цвет белый (картинка 2)');
    assert(/const TXT_STYLE_COUNT = Object\.assign\(\{\}, TXT_STYLE_BASE,/.test(currPurchSrc), 'TXT_STYLE_COUNT строится из общего базового стиля');
    assert(/const TXT_STYLE_PRICE = Object\.assign\(\{\}, TXT_STYLE_BASE\);/.test(currPurchSrc), 'TXT_STYLE_PRICE строится из общего базового стиля');
}

console.log('\n6) interface-bottom-nav.js — ЗАМЕНЕНО 18.10.2026 (4-е указание тем же днём): абсолютные координаты из редактора позиций');
{
    // Старая формула "базовое + 17 + индивидуальный сдвиг" полностью заменена точным снимком
    // позиционного редактора для всех 6 кнопок разом — см.
    // oct18-batch5-bottom-nav-absolute-coords-and-ring-avatar.test.js для полной проверки.
    const expected = {
        'нижний худ кнопка сидорович\\.png': { x: 98,   y: 662, scale: '1\\.016' },
        'нижний худ кнопка банда\\.png':     { x: 293,  y: 664, scale: '1\\.066' },
        'нижний худ кнопка боссы\\.png':     { x: 511,  y: 665, scale: '1\\.067' },
        'нижний худ кнопка шмотки\\.png':    { x: 728,  y: 663, scale: '1\\.021' },
        'нижний худ кнопка оружейка\\.png':  { x: 947,  y: 664, scale: '1\\.025' },
        'нижний худ кнопка зона\\.png':      { x: 1163, y: 663, scale: '1\\.031' },
    };
    for (const [file, pos] of Object.entries(expected)) {
        const re = new RegExp(`file: '${file}',\\s*x: ${pos.x},\\s*y: ${pos.y},\\s*scale: ${pos.scale},`);
        assert(re.test(bottomNavSrc), `${file.replace(/\\\\/g,'')} → x:${pos.x},y:${pos.y},scale:${pos.scale}`);
    }
    assert(/spr\.scale\.set\(b\.scale\);/.test(bottomNavSrc), 'scale из BTN[] реально применяется к спрайту (раньше не применялся)');
}

console.log('\n7) dvor-blackjack.js — доп. сдвиг Играть/Готово/ценник, новая координата непарной комбинации');
{
    assert(/playBtn\.x = 485 - 30 - 20; playBtn\.y = 544 \+ 10;/.test(bjSrc), 'playBtn — ещё -20x/+10y поверх -30x');
    assert(/doneGfx\.x = 485 - 30 - 20; doneGfx\.y = 550 \+ 10;/.test(bjSrc), 'doneGfx — тот же доп. сдвиг (тот же слот, что playBtn)');
    assert(/priceSpr\.x = 615 - 30 - 20; priceSpr\.y = 552 \+ 10;/.test(bjSrc), 'priceSpr — ещё -20x/+10y поверх -30x');
    assert(/'__nonpair':\s*530,/.test(bjSrc), 'BJ_ROW_Y.__nonpair — 530 (было 522)');
}

console.log('\n8) dvor-poker-bag.js — счётчик спичек закрытой сумки: новая позиция + fontSize -2');
{
    assert(/fontSize:29,/.test(pokerBagSrc), 'fontSize спичек — 29 (было 31)');
    assert(/spTxt\.x = 309; spTxt\.y = 323;/.test(pokerBagSrc), 'позиция — x:309,y:323');
}

console.log('\n9) sidorovich.js — сухари/сухари-актив/хитбокс ещё -6px вверх поверх -32');
{
    // 18.10.2026 (ещё раз тем же днём — "убери прозрачные отступы у файлов Сидоровича"): к
    // формуле добавилась компенсация +43 (обрезан верх файла).
    assert(/sigShelf\.y = PANEL_Y_SID \+ 55 - 32 - 6 \+ 43;/.test(sidSrc), 'sigShelf.y — доп. -6, затем компенсация обрезки +43');
    // 18.10.2026 (ещё раз тем же днём — "убери прозрачные отступы у файлов Сидоровича"): к
    // формуле добавилась компенсация +43 (обрезан верх файла), см. oct18-batch4-*.test.js.
    assert(/sigActiv\.y = PANEL_Y_SID \+ 55 - 32 - 6 \+ 43;/.test(sidSrc), 'sigActiv.y — доп. -6, затем компенсация обрезки +43');
    // 18.10.2026 (4-е указание тем же днём — "не нужен отдельный хитбокс"): sigHit (Graphics)
    // убран, interactive теперь прямо на sigShelf (её y всё ещё учитывает -6, см. выше).
    assert(/sigShelf\.interactive = true; sigShelf\.buttonMode = true;/.test(sidSrc), 'sigShelf сама интерактивна (без отдельного Graphics-хитбокса)');
}

console.log('\n10) yashik_activ.png убран из игры целиком (sidorovich.js / vassilich.js / game-boot.js)');
{
    // Регексы ниже ищут реальные ВЫЗОВЫ/код (Texture.from(...)), а не голую подстроку
    // "yashik_activ.png" — она легитимно встречается в пояснительных комментариях ("по прямому
    // указанию — ... убери из игры"), что иначе даёт ложный FAIL (см. тот же приём в
    // bank-currency-hud-restore.test.js).
    assert(!/Texture\.from\([^)]*yashik_activ\.png/.test(sidSrc), 'sidorovich.js больше не создаёт текстуру из yashik_activ.png');
    assert(!/Texture\.from\([^)]*yashik_activ\.png/.test(vasSrc), 'vassilich.js больше не создаёт текстуру из yashik_activ.png');
    assert(!/'yashik_activ\.png'/.test(bootSrc), 'game-boot.js больше не грузит yashik_activ.png в прелоаде');
}

console.log('\n11) habar.js / game-boot.js — новый файл фона хабара (v2 → v3)');
{
    assert(/'\.\/images\/хабар страница v3\.png'/.test(habarSrc), 'habar.js ссылается на хабар страница v3.png');
    // Та же ловушка: комментарий выше в файле дословно цитирует старый путь в кавычках — ищем
    // именно ВЫЗОВ Texture.from(...) со старым путём, не голую подстроку.
    assert(!/Texture\.from\('\.\/images\/хабар страница\.png'\)/.test(habarSrc), 'habar.js больше НЕ создаёт текстуру из хабар страница.png (без версии)');
    assert(/'хабар страница v3\.png'/.test(bootSrc), 'game-boot.js грузит хабар страница v3.png в прелоаде');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
