/**
 * Test: 04.10.2026, по прямому указанию — пользователь прислал РЕАЛЬНЫЙ замер через
 * универсальный редактор позиций для ВСЕХ 18 строк таблицы наград "Зарики" разом (x,y,scale,
 * rot,w,h на каждую комбинацию от "2 единички" до "4 шестёрки"), взамен прежнего массива
 * DICE_ROW_Y (одни только Y, формула/экстраполяция, см. dice-screen-correct-themed-background.test.js
 * за историей — та же картина "числа похожи на относительные" уже описывалась 22.09.2026).
 *
 * Присланные числа (x от -12 до 0, y от -190 до 221) сами по себе НЕ абсолютные координаты
 * канваса — но, в отличие от 22.09.2026 (когда сопоставить числа со строками не удалось),
 * на этот раз каждая строка была явно подписана комбинацией, что позволило пересчитать:
 * 18/18 значений Y совпали (±0-2px) со старыми формула-базированными Y при +342
 * (true_y = raw_y + 342), и X лёг в районе прежнего X-якоря (~1009, см. старый комментарий
 * "редактор x:1009" у DICE_ROW_X) при +1009 — совпадение с такой точностью по всем 18 строкам
 * исключает случайность, см. derivation в комментарии над DICE_ROW в dvor-dice-screen.js.
 *
 * DICE_ROW_Y (один Y на строку, общий X/W/H) заменён на DICE_ROW — карту {x,y} (центр) на
 * каждую строку отдельно, т.к. X теперь тоже плавает построчно (997..1009).
 *
 * Run: node tests/dice-combo-highlight-explicit-position-array.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const diceScreenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice-screen.js'), 'utf-8');
const diceGameSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice-game.js'), 'utf-8');

console.log('\nTest 1: DICE_ROW — явная карта {x,y}, не формула и не плоский массив одних Y');
{
    assert(/const DICE_ROW = \[/.test(diceScreenSrc), 'DICE_ROW объявлен как массив-литерал объектов {x,y}');
    assert(!/const DICE_ROW_Y = /.test(diceScreenSrc), 'старый DICE_ROW_Y (один Y на строку) убран целиком');
    assert(!/const DICE_ROW_X = /.test(diceScreenSrc), 'старый единый DICE_ROW_X убран — X теперь тоже по строкам');
    // 20.10.2026 (позже тем же днём — реальный замер через 18 независимых маркеров): W/H
    // обновлены на 264×29 (было 261×26, см. Test 3 ниже за полной историей).
    assert(/const DICE_ROW_W = 264, DICE_ROW_H = 29;/.test(diceScreenSrc), 'общие W/H (264×29) заданы отдельно — одинаковы для всех строк');
}

console.log('\nTest 2: DICE_ROW — ровно 18 записей, по одной на каждую строку TABLE, каждая с индексным комментарием-подписью комбинации');
{
    const m = diceScreenSrc.match(/const DICE_ROW = \[([\s\S]*?)\n    \];/);
    assert(!!m, 'блок массива найден');
    const body = m ? m[1] : '';
    const entries = [...body.matchAll(/\{\s*x:\s*(-?\d+),\s*y:\s*(-?\d+)\s*\},\s*\/\/\s*(\d+):/g)];
    assert(entries.length === 18, `ровно 18 строк с {x,y} и индексным комментарием (найдено ${entries.length})`);
    entries.forEach((e, i) => {
        assert(parseInt(e[3]) === i, `строка индекс ${i} промаркирована правильным номером в комментарии (найдено "${e[3]}")`);
    });
}

console.log('\nTest 3: значения — РЕАЛЬНЫЙ замер 20.10.2026 через 18 независимых маркеров (scale:1.000 у всех)');
{
    // История того же дня (хронологически):
    // 1) 04.10.2026 — первый реальный замер (формула true_y = raw_y + 342), откат 20.10.2026
    //    когда следующий снимок (x:42 общий, y:-287..156) оказался замером КОНТЕЙНЕРА общего
    //    Graphics (position всегда 0,0), а не отдельной строки.
    // 2) 20.10.2026 (позже тем же днём) — архитектура переделана на 18 независимых маркеров
    //    (см. dice-poker-bj-combo-highlight-editor-markers.test.js), после чего пользователь
    //    прислал НОВЫЙ замер — на этот раз scale:1.000 у всех 18 строк (не 0.949, как в
    //    забракованном снимке) — данные математически монотонны по Y (131→574) и правдоподобны,
    //    применены как финальные.
    const m = diceScreenSrc.match(/const DICE_ROW = \[([\s\S]*?)\n    \];/);
    const entries = [...(m ? m[1] : '').matchAll(/\{\s*x:\s*(-?\d+),\s*y:\s*(-?\d+)\s*\}/g)]
        .map(e => ({ x: parseInt(e[1]), y: parseInt(e[2]) }));

    const expectedY = [131,156,181,212,236,261,292,316,340,371,395,420,449,473,497,526,551,574];
    const expectedX = [1000,1000,1000,1002,1002,1002,1003,1005,1005,1005,1005,1005,1005,1005,1005,1005,1005,1005];

    assert(entries.length === 18, 'ровно 18 записей для сравнения');
    assert(JSON.stringify(entries.map(e => e.y)) === JSON.stringify(expectedY),
        'все 18 Y-значений соответствуют новому реальному замеру 20.10.2026 (per-marker, scale:1.000)');
    assert(JSON.stringify(entries.map(e => e.x)) === JSON.stringify(expectedX),
        'все 18 X-значений соответствуют новому реальному замеру 20.10.2026 — X плавает по строкам (1000..1005)');

    assert(/const DICE_ROW_W = 264, DICE_ROW_H = 29;/.test(diceScreenSrc),
        'DICE_ROW_W/H обновлены на реальный замер (w:294-30=264, h:29) — было 261×26');
}

console.log('\nTest 4: порядок строк в комментариях массива совпадает с порядком TABLE в dvor-dice-game.js (та же комбинация на том же индексе)');
{
    const tableMatch = diceGameSrc.match(/const TABLE = \[([\s\S]*?)\];/);
    assert(!!tableMatch, 'TABLE найден в dvor-dice-game.js');
    const tableEntries = [...(tableMatch ? tableMatch[1] : '').matchAll(/\{v:(\d+),n:(\d+)\}/g)]
        .map(m => ({ v: parseInt(m[1]), n: parseInt(m[2]) }));
    assert(tableEntries.length === 18, 'TABLE содержит 18 комбинаций');

    // Достаточно сверить первую (4×6) и последнюю (2×1) строки — если порядок начала/конца
    // совпадает и длина одинакова (18), середина заведомо в том же порядке (оба списка
    // строятся строго последовательно v:6→1, n:4→2, без перестановок).
    assert(tableEntries[0].v === 6 && tableEntries[0].n === 4, 'TABLE[0] — v6n4 (Шмотка), совпадает с комментарием "0: 4×6" у DICE_ROW[0]');
    assert(tableEntries[17].v === 1 && tableEntries[17].n === 2, 'TABLE[17] — v1n2 (500 сигарет), совпадает с комментарием "17: 2×1" у DICE_ROW[17]');
}

console.log('\nTest 5: this._diceComboHighlights — 18 независимых маркеров, каждый на СВОЕЙ позиции из DICE_ROW[idx]');
{
    // 20.10.2026 (по прямому указанию — "каждое выпадение комбинации имеет координаты 0,0,
    // сделай координаты относительно всей плоскости"): отрисовка/позиционирование переехали
    // из _diceShowComboHighlight (вызывался на каждый бросок, единый Graphics с position
    // всегда (0,0)) в ОДНОРАЗОВУЮ постройку 18 маркеров — у каждого собственный x/y =
    // DICE_ROW[idx], поэтому редактор позиций теперь читает осмысленные координаты для
    // КАЖДОЙ строки отдельно, а не (0,0) контейнера.
    const buildIdx = diceScreenSrc.indexOf('this._diceComboHighlights = DICE_ROW.map((rowPos, idx) => {');
    assert(buildIdx !== -1, 'постройка маркеров (this._diceComboHighlights) найдена');
    const buildEnd = diceScreenSrc.indexOf('});', buildIdx) + 3;
    const buildBody = diceScreenSrc.slice(buildIdx, buildEnd);
    assert(/m\.x = rowPos\.x; m\.y = rowPos\.y;/.test(buildBody), 'каждый маркер получает СОБСТВЕННУЮ позицию = DICE_ROW[idx] (не (0,0))');
    assert(/m\.drawRoundedRect\(-DICE_ROW_W \/ 2 \+ 30, -DICE_ROW_H \/ 2 \+ 14, DICE_ROW_W \+ 30, DICE_ROW_H, 5\);/.test(buildBody),
        'рамка рисуется ЛОКАЛЬНО (под собственную позицию маркера) со сдвигом +30/+14 и шириной +30 (сужена с +60)');
    assert(/m\._uDraggable = true;/.test(buildBody), 'каждый маркер отдельно помечен _uDraggable — редактор видит и двигает их по одному');

    const start = diceScreenSrc.indexOf('proto._diceShowComboHighlight = function(rowIndex){');
    const end   = diceScreenSrc.indexOf('\n    };', start);
    const body  = diceScreenSrc.slice(start, end);
    assert(/markers\.forEach\(\(m, idx\) => \{/.test(body), 'show-функция только переключает visible/alpha маркеров, не рисует и не двигает');
    assert(!/drawRoundedRect/.test(body), 'show-функция больше не перерисовывает рамку (форма фиксирована при постройке)');
}

console.log('\nTest 6: редактор позиций — показать все варианты / восстановить (dice)');
{
    assert(/proto\._diceShowAllComboVariants = function\(\)\{/.test(diceScreenSrc), '_diceShowAllComboVariants определён (показывает все 18 маркеров разом)');
    assert(/proto\._diceRestoreComboHighlight = function\(\)\{/.test(diceScreenSrc), '_diceRestoreComboHighlight определён (возвращает реальный результат после редактора)');
    assert(/proto\._diceHideComboHighlight = function\(\)\{/.test(diceScreenSrc), '_diceHideComboHighlight определён (общий хелпер гашения всех маркеров)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
