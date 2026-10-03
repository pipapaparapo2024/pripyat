/**
 * Test: батч 22.09.2026 (по прямому указанию — "там где рамка и фото игрока у которого
 * больше всего уважения подпиши снизу сколько у него уважения в этой зоне") — под фото
 * рекордсмена по уважению (zone_screen.js, рамка "рамка уважение.png") добавлена подпись с
 * суммой (l.amount из zone.leaders()) — раньше показывалось только фото без числа.
 *
 * Run: node tests/zone-respect-leader-amount-caption.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const zoneScreenSrc = readSrc('_client/src/game/shell/overlays/zone_screen.js');

console.log('\nTest 1: zone_screen.js — импортирует formatRewardAmount (единый "К"-форматтер сумм наград)');
{
    assert(/import \{ formatRewardAmount \} from '\.\.\/popups\/reward\.js';/.test(zoneScreenSrc),
        'импорт присутствует — переиспользует общий форматтер, не дублирует свой');
}

console.log('\nTest 2: под фото рекордсмена рисуется подпись с суммой уважения (l.amount)');
{
    const start = zoneScreenSrc.indexOf('const _renderRespectLeaders = (users) => {');
    const end   = zoneScreenSrc.indexOf('const _withResolver =', start);
    const body  = zoneScreenSrc.slice(start, end);

    // 22.09.2026 (по прямому указанию, скриншот редактора позиций — "текст без +, чёрным
    // шрифтом, с теми характеристиками как я показал"): префикс "+" убран (голое число),
    // см. zone-cards-uniform-size-and-respect-caption-style.test.js для полной сверки стиля.
    // 29.09.2026: реализация ушла от formatRewardAmount к простому String(l.amount) (приставки
    // "+" нет в обоих случаях — это и было сутью правки); formatRewardAmount остался
    // импортирован, но для этой подписи больше не вызывается.
    assert(/const amountTxt = new PIXI\.Text\(String\(l\.amount\), \{/.test(body),
        'текст строится из l.amount (сумма уважения ИМЕННО этого рекордсмена на ИМЕННО этой зоне), без префикса "+"');
    // 02.10.2026: +5px — подтверждённый пользователем напрямую выбор, не баг (не трогать без
    // прямого указания).
    assert(/amountTxt\.x = frameSpr\.x \+ RESPECT_FRAME_W \/ 2 \+ 5;/.test(body), 'сдвинута на +5px вправо от центра рамки (подтверждено пользователем)');
    // 24.09.2026 (по прямому указанию, редактор позиций — "y:325"): позиция уточнена на 29px
    // выше прежней (была frameSpr.y+RESPECT_FRAME_H="низ рамки"), теперь именованная константа
    // RESPECT_AMOUNT_REL_Y=138 — см. zone-respect-leader-position-zindex-and-refresh.test.js.
    assert(/amountTxt\.y = frameSpr\.y \+ RESPECT_AMOUNT_REL_Y;/.test(body), 'располагается по уточнённому смещению RESPECT_AMOUNT_REL_Y от рамки');
    assert(/amountTxt\._uDraggable = true;/.test(body), 'помечен draggable — можно точно подвинуть через редактор позиций при необходимости');
    // 24.09.2026 (баг найден по прямому указанию — "число должно быть по Z-индексу выше рамки"):
    // addChildAt(..., frameIdx+1) вставляло ПЕРЕД рамкой (ниже по z) — заменено на addChild
    // (конец списка группы = выше рамки), группа своей локации не изменилась.
    assert(/g\.group\.addChild\(amountTxt\);/.test(body),
        'добавляется в ГРУППУ своей локации (не в win напрямую), в конец списка — выше рамки по z-индексу');
}

console.log('\nTest 3: подпись зарегистрирована в _zoneRespectPhotos для единообразной очистки при пересборке экрана');
{
    const start = zoneScreenSrc.indexOf('const _renderRespectLeaders = (users) => {');
    const end   = zoneScreenSrc.indexOf('const _withResolver =', start);
    const body  = zoneScreenSrc.slice(start, end);
    assert(/this\._zoneRespectPhotos\.push\(\{ spr: amountTxt, locIdx: l\.loc \}\);/.test(body),
        'amountTxt зарегистрирован в том же массиве, что и photoSpr — тот же жизненный цикл');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
