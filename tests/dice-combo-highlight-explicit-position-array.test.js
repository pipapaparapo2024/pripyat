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
    assert(/const DICE_ROW_W = 261, DICE_ROW_H = 26;/.test(diceScreenSrc), 'общие W/H (261×26) заданы отдельно — одинаковы для всех строк');
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

console.log('\nTest 3: значения пересчитаны 04.10.2026 по реальному замеру ВСЕХ 18 строк (true_y = raw_y + 342)');
{
    const m = diceScreenSrc.match(/const DICE_ROW = \[([\s\S]*?)\n    \];/);
    const entries = [...(m ? m[1] : '').matchAll(/\{\s*x:\s*(-?\d+),\s*y:\s*(-?\d+)\s*\}/g)]
        .map(e => ({ x: parseInt(e[1]), y: parseInt(e[2]) }));

    const expectedY = [152,175,197,225,249,271,300,322,345,375,397,418,446,468,490,518,541,563];
    const expectedX = [997,998,998,1000,1000,1000,1004,1004,1004,1004,1004,1004,1004,1009,1009,1009,1009,1009];

    assert(entries.length === 18, 'ровно 18 записей для сравнения');
    assert(JSON.stringify(entries.map(e => e.y)) === JSON.stringify(expectedY),
        'все 18 Y-значений соответствуют пересчитанному реальному замеру (raw_y + 342)');
    assert(JSON.stringify(entries.map(e => e.x)) === JSON.stringify(expectedX),
        'все 18 X-значений соответствуют пересчитанному реальному замеру (raw_x + 1009) — X плавает по строкам (997..1009)');
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

console.log('\nTest 5: _diceShowComboHighlight читает центр {x,y} из DICE_ROW[idx] построчно (X больше не общий на все строки)');
{
    const start = diceScreenSrc.indexOf('proto._diceShowComboHighlight = function(rowIndex){');
    const end   = diceScreenSrc.indexOf('\n    };', start);
    const body  = diceScreenSrc.slice(start, end);
    assert(/const \{ x: cx, y: cy \} = DICE_ROW\[idx\];/.test(body), 'координаты строки берутся из DICE_ROW[idx] (и x, и y — построчно)');
    assert(/h\.drawRoundedRect\(cx - DICE_ROW_W \/ 2, cy - DICE_ROW_H \/ 2, DICE_ROW_W, DICE_ROW_H, 5\);/.test(body),
        'рамка рисуется вокруг центра (cx,cy) конкретной строки, единой W/H для всех');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
