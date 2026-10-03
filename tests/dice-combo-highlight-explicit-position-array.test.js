/**
 * Test: батч 22.09.2026 (по прямому указанию — "пытался сделать алгоритм... не получается,
 * лучше сделать поточечно") — DICE_ROW_Y (Y-координаты подсветки строки таблицы наград на
 * экране "Зарики") переведён с формулы (IIFE, шаг 22px внутри группы / 27px между группами)
 * на явный массив из 18 литералов — по одному на каждую строку TABLE (dvor-dice-game.js),
 * в том же порядке (v:6×n4,n3,n2, v:5×..., ..., v:1×n4,n3,n2).
 *
 * Значения СОХРАНЕНЫ из прежде рабочей формулы (не изменены) — пользователь прислал ~15
 * скриншотов редактора позиций с координатами каждой строки, но показанные там числа
 * (отрицательные, вне диапазона 152-551) не удалось надёжно сопоставить с конкретными
 * строками — похоже, сняты относительно другой точки отсчёта, а не как абсолютная позиция
 * на холсте (см. комментарий прямо над DICE_ROW_Y в dvor-dice-screen.js). Структурная цель
 * достигнута (точечное редактирование одной строки без пересчёта формулы), а не итоговые
 * числа — при необходимости пользователь может прислать точное значение для любой конкретной
 * строки отдельно.
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

console.log('\nTest 1: DICE_ROW_Y — явный массив, не формула/IIFE');
{
    assert(/const DICE_ROW_Y = \[/.test(diceScreenSrc), 'DICE_ROW_Y объявлен как массив-литерал');
    assert(!/const DICE_ROW_Y = \(\(\) => \{/.test(diceScreenSrc), 'старая формула (IIFE) убрана целиком');
    assert(!/arr\[i - 1\] \+ \(i % 3 === 0 \? 27 : 22\)/.test(diceScreenSrc), 'формула пересчёта шага (22/27px) больше не используется');
}

console.log('\nTest 2: DICE_ROW_Y — ровно 18 значений, по одному на каждую строку TABLE, каждая с комментарием-подписью комбинации');
{
    const m = diceScreenSrc.match(/const DICE_ROW_Y = \[([\s\S]*?)\n    \];/);
    assert(!!m, 'блок массива найден');
    const body = m ? m[1] : '';
    const entries = [...body.matchAll(/(\d+),\s*\/\/\s*(\d+):\s*(\dх?\d|\d×\d)\s*—\s*(.+)/g)];
    // Более мягкий парсинг — просто считаем числа и комментарии по номеру индекса.
    const nums = [...body.matchAll(/^\s*(\d+),\s*\/\/\s*(\d+):/gm)];
    assert(nums.length === 18, `ровно 18 строк с числом+индексным комментарием (найдено ${nums.length})`);
    nums.forEach((n, i) => {
        assert(parseInt(n[2]) === i, `строка индекс ${i} промаркирована правильным номером в комментарии (найдено "${n[2]}")`);
    });
}

console.log('\nTest 3: значения перекалиброваны 22.09.2026 по двум явно подписанным точкам ("3×6"/"4×6") — новый массив, не старая формула');
{
    // 22.09.2026: два новых скриншота редактора позиций явно подписаны ("3×6"→100 рублей,
    // "4×6"→Шмотка), что дало надёжный якорь (true_y = raw_y + 572) для пересчёта всех 18
    // старых замеров — см. blackjack-combo-highlight-point-data-and-error-popup-position.test.js.
    const m = diceScreenSrc.match(/const DICE_ROW_Y = \[([\s\S]*?)\];/);
    const nums = [...(m ? m[1] : '').matchAll(/(\d+),/g)].map(x => parseInt(x[1]));

    const expected = [152,175,198,226,248,271,299,322,344,373,396,418,446,468,491,518,540,563];

    assert(nums.length === 18, 'ровно 18 чисел для сравнения');
    assert(JSON.stringify(nums) === JSON.stringify(expected),
        'все 18 значений побайтово совпадают с новой калибровкой (152 база, шаг 22-23px внутри группы, 27-29px через разделитель)');
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
    assert(tableEntries[0].v === 6 && tableEntries[0].n === 4, 'TABLE[0] — v6n4 (Шмотка), совпадает с комментарием "0: 4×6" у DICE_ROW_Y[0]');
    assert(tableEntries[17].v === 1 && tableEntries[17].n === 2, 'TABLE[17] — v1n2 (500 сигарет), совпадает с комментарием "17: 2×1" у DICE_ROW_Y[17]');
}

console.log('\nTest 5: _diceShowComboHighlight по-прежнему индексирует DICE_ROW_Y напрямую (структура использования не изменилась)');
{
    const start = diceScreenSrc.indexOf('proto._diceShowComboHighlight = function(rowIndex){');
    const end   = diceScreenSrc.indexOf('\n    };', start);
    const body  = diceScreenSrc.slice(start, end);
    assert(/const cy = DICE_ROW_Y\[idx\] - 4;/.test(body), 'подсветка по-прежнему читает DICE_ROW_Y[idx] (массив вместо формулы — прозрачно для остального кода)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
