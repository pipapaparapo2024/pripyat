/**
 * Test: батч 20.10.2026 (по прямому указанию, редактор позиций + несколько поведенческих правок) —
 *
 *  1) zone.php: шанс выпадения заначки уменьшен 15%→7% (чистая балансная правка, значение не
 *     зафиксировано в ТЗ — проверено отдельно по просьбе пользователя "откуда такой шанс").
 *  2) dvor-dice-screen.js: позиционные правки по снимку редактора позиций (фон, кнопка покупки
 *     поинтов, счётчик красных поинтов, таймер бесплатного броска, кнопка БРОСИТЬ/confirmBtn) +
 *     кубики результата брсока (DICE_POSITIONS) сдвинуты вправо 20px / вниз 10px.
 *  3) ryukzak.js: цифра уровня рюкзака — вправо 32px, вниз 12px, fontSize 12→18; ячейки
 *     заполнения шкалы уровня — влево на 1px (первая ячейка x:248, было 249).
 *  4) interface-currency-purchase.js: хайвер-эффект карточек покупки — убран рост по scale
 *     (_addHoverScale), теперь как у нижнего ХУДа — только alpha (_addHoverAlpha).
 *  5) dvor-roulette-minigame.js: 9 стаканчиков супер-игры — было 3 ГРУППЫ по 3 одинаковых подряд
 *     (CUP_FILES[Math.floor(i/3)]), теперь чередование (CUP_FILES[i % 3]) — радиация/
 *     предупреждение/противогаз вперемешку, как было запрошено ("три одинаковых подряд — не
 *     нужно, нужно вперемешку").
 *  6) (ОТКАЧЕНО тем же днём, позже — см. oct20-batch2-dice-combo-highlight-revert... ниже по
 *     истории тестов) dvor-dice-screen.js: DICE_ROW пробовали пересчитать по новому снимку
 *     редактора позиций — снимок оказался НЕ в той системе координат (_diceComboHighlight это
 *     общий Graphics с h.position всегда (0,0), редактор не может замерить отдельную строку
 *     внутри него) — возвращены последние рабочие координаты 04.10.2026, см. тест выше по
 *     списку: dice-combo-highlight-explicit-position-array.test.js.
 *  7) ryukzak.js: новый hit-бокс (785,520,212×34) над названием выпавшей шмотки — наведение
 *     показывает тот же тултип, что уже есть у баннера "шанс на шмотку".
 *  8) interface-currency-purchase.js: добавлен style.padding:6 на все 3 текстовых стиля попапа
 *     покупки — фикс "буквы разного размера" (PIXI обрезает canvas-текстуру по тесной
 *     bounding-box без явного padding, у засечковых шрифтов это плавает по глифам).
 *
 * Run: node tests/oct20-batch-stash-chance-dice-positions-ryukzak-hover-cups-shuffle.test.js
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

const zonePhp     = readSrc('server/core/controllers/zone.php');
const diceSrc      = readSrc('_client/src/game/dvor/dvor-dice-screen.js');
const ryukzakSrc   = readSrc('_client/src/game/shell/overlays/ryukzak.js');
const purchaseSrc  = readSrc('_client/src/game/interface/interface-currency-purchase.js');
const minigameSrc  = readSrc('_client/src/game/dvor/dvor-roulette-minigame.js');

console.log('\nTest 1: zone.php — шанс заначки 15%→7%');
{
    assert(/if\(mt_rand\(1, 100\) <= 7\)\{/.test(zonePhp), 'шанс заначки теперь 7% (было 15%)');
    assert(!/if\(mt_rand\(1, 100\) <= 15\)\{/.test(zonePhp), 'старое значение 15% больше не встречается');
}

console.log('\nTest 2: dvor-dice-screen.js — позиции по снимку редактора (20.10.2026)');
{
    assert(/bg\.x = -1; bg\.y = 22; bg\.width = 1280; bg\.height = 690;/.test(diceSrc), 'фон зариков: y 27→22');
    assert(/pointsTxt\.x = 190; pointsTxt\.y = 462; pointsTxt\.rotation/.test(diceSrc), 'счётчик красных поинтов: y 464→462');
    assert(/buyBtn\.x = 195; buyBtn\.y = 556;/.test(diceSrc), 'кнопка купить поинты: y 559→556');
    assert(/timerTxt\.x = 623; timerTxt\.y = 486;/.test(diceSrc), 'таймер бесплатного броска: y 489→486');
    assert(/throwBtn\.x = 624; throwBtn\.y = 541;/.test(diceSrc), 'кнопка БРОСИТЬ: y 543→541');
    assert(/confirmBtn\.x = 624; confirmBtn\.y = 541;/.test(diceSrc), 'кнопка ПОДТВЕРДИТЬ (делит позицию с БРОСИТЬ): y 543→541');
    assert(/const DICE_POSITIONS = \[\s*\{x:458, y:328\}, \{x:564, y:328\},\s*\{x:670, y:328\}, \{x:776, y:328\}\s*\];/.test(diceSrc),
        'позиции кубиков результата сдвинуты вправо на 20px и вниз на 10px (было 438/544/650/756,318)');
}

console.log('\nTest 3: ryukzak.js — цифра уровня и ячейки заполнения (20.10.2026, два захода тем же днём)');
{
    const lvlTxtDecl = ryukzakSrc.match(/const lvlTxt = new PIXI\.Text\(String\(previewLevel\), \{([\s\S]{0,120})/);
    assert(!!lvlTxtDecl && /fontSize: 24, fill: '#d4b99c',/.test(lvlTxtDecl[1]), 'fontSize цифры уровня увеличен 12→18→24');
    assert(/lvlTxt\.x = 464; lvlTxt\.y = 525;/.test(ryukzakSrc), 'цифра уровня: x 432→464 (+32), y 511→523→525 (+12, +2)');
    assert(/seg\.x = 248 \+ s \* 50; seg\.y = 554;/.test(ryukzakSrc), 'первая ячейка заполнения: x 249→248 (влево на 1px)');
}

console.log('\nTest 4: interface-currency-purchase.js — хайвер карточек покупки без роста (как нижний ХУД)');
{
    const switchIdx = purchaseSrc.indexOf('info[\'default\'].forEach');
    const forEachEnd = purchaseSrc.indexOf('\n            });', switchIdx);
    const body = purchaseSrc.slice(switchIdx, forEachEnd);
    assert(/this\._addHoverAlpha\(slot, 0\.85\)/.test(body), 'слот использует _addHoverAlpha (тот же эффект, что у нижнего ХУДа) вместо _addHoverScale');
    assert(!/_addHoverScale\(slot/.test(body), '_addHoverScale для slot убран (раньше добавлял рост 1.06×)');
    assert(!/slot\.on\('pointerover', \(\) => \{ slot\.alpha = 0\.85; \}\);/.test(body), 'ручной pointerover/pointerout на alpha убран — теперь делает _addHoverAlpha');
}

console.log('\nTest 5: dvor-roulette-minigame.js — стаканчики вперемешку (было 3 группы по 3 подряд)');
{
    assert(/CUP_FILES\[i % 3\]/.test(minigameSrc), 'closedSpr выбирает файл по i % 3 (чередование)');
    assert(!/CUP_FILES\[Math\.floor\(i \/ 3\)\]/.test(minigameSrc), 'старая группировка по 3 подряд (Math.floor(i/3)) убрана');
}

console.log('\nTest 6: dvor-dice-screen.js — DICE_ROW (история до 20.10.2026 позже тем же днём, см. Test 6 в dice-combo-highlight-explicit-position-array.test.js для АКТУАЛЬНОЙ калибровки)');
{
    // 20.10.2026 (ещё позже тем же днём — реальный замер ВСЕХ 18 строк по отдельности через
    // новую архитектуру независимых маркеров, scale:1.000 у всех — надёжные данные, не
    // артефакт сужения общего объекта): DICE_ROW/DICE_ROW_W/DICE_ROW_H обновлены на новые
    // значения. Актуальные числа и формула отрисовки проверяются в
    // tests/dice-combo-highlight-explicit-position-array.test.js (Test 3/5) и
    // tests/dice-poker-bj-combo-highlight-editor-markers.test.js — здесь оставлена только
    // проверка, что массив по-прежнему корректной структуры (18 записей).
    const m = diceSrc.match(/const DICE_ROW = \[([\s\S]*?)\n    \];/);
    assert(!!m, 'DICE_ROW найден');
    if(m){
        const entries = [...m[1].matchAll(/\{\s*x:\s*(-?\d+),\s*y:\s*(-?\d+)\s*\}/g)].map(e => ({x:+e[1], y:+e[2]}));
        assert(entries.length === 18, 'ровно 18 строк');
    }
}

console.log('\nTest 7: ryukzak.js — новый hit-бокс над названием выпавшей шмотки (785,520,212×34)');
{
    assert(/const shmotNameHit = new PIXI\.Graphics\(\);/.test(ryukzakSrc), 'shmotNameHit создан');
    assert(/shmotNameHit\.drawRect\(-106, -17, 212, 34\);/.test(ryukzakSrc), 'размер хитбокса 212×34, центрирован (-106,-17 от якоря)');
    assert(/shmotNameHit\.x = 785; shmotNameHit\.y = 520;/.test(ryukzakSrc), 'позиция хитбокса — x:785,y:520');
    assert(/shmotNameHit\.on\('pointerover', _showShmotBannerTip\);/.test(ryukzakSrc), 'наведение показывает тот же тултип, что у баннера "шанс на шмотку"');
}

console.log('\nTest 8: interface-currency-purchase.js — padding на текстовых стилях (фикс "буквы разного размера")');
{
    // 20.10.2026 (позже тем же днём — перенос стиля слоя из Photoshop): TXT_STYLE_COUNT/PRICE/
    // TITLE объединены в общий TXT_STYLE_BASE с padding:8 (было 6, увеличено под новую обводку+
    // тень, которые иначе клипались бы по тесной bounding-box) — см.
    // tests/currency-purchase-text-style-photoshop-transfer.test.js за полной проверкой.
    assert(/padding: 8,/.test(purchaseSrc), 'общий базовый стиль получил padding:8 (увеличено с 6 под обводку+тень)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
