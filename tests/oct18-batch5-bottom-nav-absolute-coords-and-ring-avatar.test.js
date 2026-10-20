/**
 * Test: батч 18.10.2026 (пятый за день, по прямому указанию, новый снимок позиционного
 * редактора + ряд функциональных фиксов) — покрывает ТОЛЬКО поведенческие/структурные
 * изменения (чистые x/y/scale без нового поведения — по правилу №10 AGENTS.md обновлены
 * существующие regex-тесты на месте, см. oct18-batch3-ui-polish-and-active-slot.test.js).
 *
 *  1) interface-bottom-nav.js — все 6 кнопок переставлены на абсолютные координаты из
 *     редактора позиций (порядок слева направо сменился: "банда" и "боссы" поменялись
 *     местами), scale теперь реально применяется к спрайту (раньше не применялся вообще).
 *  2) interface.js — круглая маска на фото аватара (квадратное фото торчало углами за
 *     пределы круглой рамки портала) + новый файл "кольцо верхний худ.png" поверх иконки.
 *  3) sidorovich.js — отдельные Graphics-хитбоксы (konservaHit/boxHit/posylkaHit/sigHit/
 *     bagHit) убраны целиком, hover/клик теперь напрямую на idle-спрайтах — см. отдельный
 *     докблок в самом sidorovich.js для разбора исходных багов (сухари триггерились на 42px
 *     выше реального рисунка; рюкзак перехватывал hover у консерв).
 *  4) interface-currency-purchase.js — activeSlotSpr ещё +5 вниз; countTxt/priceTxt ещё
 *     ±16px (поверх уже применённых ±32).
 *  5) ryukzak.js — lvlTxt (цифра уровня рюкзака) на абсолютных координатах x:432,y:511,
 *     scale:0.390 вместо формулы от lvlPlate.
 *  6) interface-top-currency.js — plateSecondary (сама выдвинувшаяся плашка, не только
 *     иконка внутри неё) тоже переключает закреплённую валюту при клике/наведении.
 *  7) svod-achievements.js — иконки bp_50/meta_500: ширина 56→54px, x получает доп. -1.
 *  8) svod-achievements.js / svod-leaderboard.js — fontWeight:'bold' убран у всех текстов
 *     Southbank LT (в проекте зарегистрирован только Regular, bold был fake-bold браузера).
 *  9) ryukzak.js — hover-тултип на баннере "шанс на шмотку" (без строки "Требования"),
 *     dev_panel.js — mockReward.forceShmotBanner + mockShmot для проверки тултипа.
 *
 * Run: node tests/oct18-batch5-bottom-nav-absolute-coords-and-ring-avatar.test.js
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

const navSrc      = read('_client/src/game/interface/interface-bottom-nav.js');
const ifaceSrc     = read('_client/src/game/interface.js');
const sidSrc       = read('_client/src/game/shell/overlays/sidorovich.js');
const currPurchSrc = read('_client/src/game/interface/interface-currency-purchase.js');
const ryukSrc      = read('_client/src/game/shell/overlays/ryukzak.js');
const topCurSrc    = read('_client/src/game/interface/interface-top-currency.js');
const achSrc       = read('_client/src/game/svod/svod-achievements.js');
const lbSrc        = read('_client/src/game/svod/svod-leaderboard.js');
const devSrc       = read('_client/src/game/shell/overlays/dev_panel.js');
const bootSrc      = read('_client/src/game/game-boot.js');

console.log('\n1) interface-bottom-nav.js — абсолютные координаты, scale реально применяется');
{
    assert(/spr\.scale\.set\(b\.scale\);/.test(navSrc), 'scale из BTN[] применяется к спрайту кнопки');
    assert(/key: 'sidorovich'.*x: 98,\s*y: 662,\s*scale: 1\.016/.test(navSrc), 'сидорович — x:98,y:662,scale:1.016');
    assert(/key: 'banda'.*x: 293,\s*y: 664,\s*scale: 1\.066/.test(navSrc), 'банда — x:293,y:664,scale:1.066');
    assert(/key: 'bosses'.*x: 511,\s*y: 665,\s*scale: 1\.067/.test(navSrc), 'боссы — x:511,y:665,scale:1.067 (поменялись местами с бандой)');
    assert(/key: 'zone'.*x: 1163,\s*y: 663,\s*scale: 1\.031/.test(navSrc), 'зона — x:1163,y:663,scale:1.031');
}

console.log('\n2) interface.js — кольцо поверх иконки (19.10.2026: круглая маска под фото убрана — см. ниже)');
{
    // 19.10.2026 (по прямому указанию — "убери эту маску под фото, она там не нужна"): маска
    // радиусом S/2=26px оказалась сильно меньше декоративного кольца (110×108px без scale) —
    // убрана целиком, см. oct19-batch-....test.js за полным покрытием.
    assert(!/const avaMask = new PIXI\.Graphics/.test(ifaceSrc), 'PIXI.Graphics для маски больше не создаётся');
    assert(!/bm\.mask = avaMask;/.test(ifaceSrc), 'bm.mask больше не выставляется');
    assert(/кольцо верхний худ\.png/.test(ifaceSrc), 'новый файл кольца подключён');
    // 20.10.2026 (по прямому указанию — "кольцо в натуральном размере, поверх всего HUD, в
    // левом верхнем углу"): кольцо переехало из icon_mc/up.ava напрямую в `this.up` (addChild
    // добавляет последним ребёнком = топ z-order), x=0,y=0, без scale — см. ring-native-size
    // тест ниже.
    assert(/this\.up\.addChild\(ring\);/.test(ifaceSrc), 'кольцо добавлено напрямую в this.up (топ z-order, не внутрь icon_mc/up.ava)');
    assert(/if\(!this\._avatarRing\)/.test(ifaceSrc), 'кольцо создаётся один раз, не на каждую перезагрузку фото');
    assert(/'кольцо верхний худ\.png'/.test(bootSrc), 'кольцо есть в прелоаде game-boot.js');
}

console.log('\n3) sidorovich.js — отдельные хитбоксы убраны, hover/клик напрямую на спрайтах');
{
    assert(!/const konservaHit/.test(sidSrc), 'konservaHit (Graphics) больше не создаётся');
    assert(!/const boxHit/.test(sidSrc), 'boxHit (Graphics) больше не создаётся');
    assert(!/const sigHit/.test(sidSrc), 'sigHit (Graphics) больше не создаётся');
    assert(!/const bagHit/.test(sidSrc), 'bagHit (Graphics) больше не создаётся');
    assert(!/const posylkaHit/.test(sidSrc), 'posylkaHit (Graphics) больше не создаётся');
    // 19.10.2026 (по прямому указанию — "хитбокс ящика нужно убрать"): chestHit был отдельным
    // мёртвым хитбоксом от ДО появления спрайта посылки (сундука) — удалён, открытие ящика
    // теперь на posylkaIdle.on('pointerdown', ...), см. oct19-batch-....test.js.
    assert(!/const chestHit = new PIXI\.Graphics/.test(sidSrc), 'chestHit (Graphics) больше не создаётся (19.10.2026)');
    assert(/konservaIdle\.interactive = true; konservaIdle\.buttonMode = true;/.test(sidSrc), 'konservaIdle сама интерактивна');
    assert(/bankaIdle\.interactive = true; bankaIdle\.buttonMode = true;/.test(sidSrc), 'bankaIdle сама интерактивна');
    assert(/posylkaIdle\.interactive = true; posylkaIdle\.buttonMode = true;/.test(sidSrc), 'posylkaIdle сама интерактивна (hover + клик, 19.10.2026)');
    assert(/posylkaIdle\.on\('pointerdown', \(\)=>\{ this\._openYashikScreen\(\); \}\);/.test(sidSrc), 'клик по сундуку открывает экран ящика (19.10.2026)');
    assert(/sumkaFront\.interactive = true; sumkaFront\.buttonMode = true;/.test(sidSrc), 'sumkaFront сама интерактивна');
    assert(/sumkaFront\.on\('pointerdown', \(\)=>\{ this\._openRyukzakReward\(\); \}\);/.test(sidSrc), 'клик по сумке открывает рюкзак');
}

console.log('\n4) interface-currency-purchase.js — активный слот +5 (count/price Y см. oct19-batch-....test.js)');
{
    assert(/activeSlotSpr\.y = def\.activeSlotY \+ 5;/.test(currPurchSrc), 'activeSlotSpr.y — ещё +5');
}

console.log('\n5) ryukzak.js — цифра уровня рюкзака на абсолютных координатах');
{
    // 20.10.2026 (по прямому указанию, два захода тем же днём): x 432→464, y 511→523→525,
    // fontSize 12→18→24.
    assert(/lvlTxt\.x = 464; lvlTxt\.y = 525;/.test(ryukSrc), 'lvlTxt.x=464,y=525');
    // 18.10.2026 (найдено тестом no-text-fontsize-scale-pixelation.test.js — scale.set() на
    // PIXI.Text пикселизует канвас-текст): 30×0.390 пересчитано напрямую в fontSize, lvlTxt.
    // scale.set() больше не вызывается.
    assert(/fontFamily: 'Southbank LT', fontSize: 24, fill: '#d4b99c',/.test(ryukSrc), 'lvlTxt — fontSize:24 напрямую (было 12→18→24)');
    assert(!/\n\s*lvlTxt\.scale\.set/.test(ryukSrc), 'lvlTxt.scale.set() не вызывается как код (пикселизация текста)');
}

console.log('\n6) interface-top-currency.js — выдвинутая плашка тоже переключает валюту');
{
    assert(/plateSecondary\.interactive = true; plateSecondary\.buttonMode = true;/.test(topCurSrc), 'plateSecondary интерактивна');
    assert(/plateSecondary\.on\('pointerdown', _swapToSecondary\);/.test(topCurSrc), 'клик по plateSecondary зовёт тот же _swapToSecondary');
    assert(/iconSecondary\.on\('pointerdown', _swapToSecondary\);/.test(topCurSrc), 'iconSecondary зовёт тот же общий обработчик (не дублирует логику)');
}

console.log('\n7) svod-achievements.js — bp_50/meta_500: ширина 54px, x -1 доп.');
{
    assert(/const _isWideIcon = \(a\.id === 'bp_50' \|\| a\.id === 'meta_500'\);/.test(achSrc), '_isWideIcon вычисляется на каждый _fillCard (пул карточек)');
    assert(/c\._iconSpr\.width\s*=\s*_isWideIcon \? 54 : 46;/.test(achSrc), 'ширина 54 для bp_50/meta_500 (было 56)');
    assert(/c\._iconSpr\.x = ICON_X - 1 - \(_isWideIcon \? 1 : 0\);/.test(achSrc), 'x получает доп. -1 только для широких иконок');
}

console.log('\n8) svod — fontWeight:bold убран из реальных стилей текста (единственный файл шрифта Southbank LT — Regular)');
{
    // Проверяем именно АРГУМЕНТ стиля внутри `new PIXI.Text(...)`, а не голую подстроку —
    // собственные поясняющие комментарии в коде тоже содержат текст "fontWeight:'bold'" (см.
    // AGENTS.md про коллизии regex-тестов с собственными комментариями).
    assert(!/new PIXI\.Text\([^)]*fontWeight:\s*'bold'/.test(achSrc), 'svod-achievements.js — ни один PIXI.Text не задаёт fontWeight:\'bold\'');
    assert(!/new PIXI\.Text\([^)]*fontWeight:\s*'bold'/.test(lbSrc), 'svod-leaderboard.js — ни один PIXI.Text не задаёт fontWeight:\'bold\'');
}

console.log('\n9) ryukzak.js / dev_panel.js — hover-тултип баннера шмотки + dev-превью с mockShmot');
{
    assert(/const HAS_SHMOT_DROP = !!\(mockReward && mockReward\.forceShmotBanner\);/.test(ryukSrc), 'HAS_SHMOT_DROP учитывает forceShmotBanner');
    assert(/shmotBanner\.on\('pointerover', _showShmotBannerTip\);/.test(ryukSrc), 'hover на баннере вызывает тултип');
    assert(!/Требования/.test(ryukSrc.slice(ryukSrc.indexOf('_showShmotBannerTip'), ryukSrc.indexOf('_showShmotBannerTip') + 3000)),
        'в тултипе баннера НЕТ строки "Требования" (по прямому указанию, в отличие от shmot_shop)');
    assert(/forceShmotBanner: true,/.test(devSrc), 'dev_panel.js передаёт forceShmotBanner:true');
    assert(/mockShmot: \{ name:/.test(devSrc), 'dev_panel.js передаёт mockShmot для проверки тултипа');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
