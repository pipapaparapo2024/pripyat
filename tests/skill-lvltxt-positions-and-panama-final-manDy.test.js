/**
 * Test: 17.09.2026 (пятый батч) — точные координаты, снятые пользователем вживую через
 * редактор позиций:
 *
 *  1) Текст «уровень/макс» под каждой иконкой скилла (bosses_skills.js) — раньше все 20
 *     считались одной формулой (cx, cy+30), реально не совпадало ни по X (центрированный
 *     анкор, но у "0/5" и "0/100" разная ширина визуально давала разный сдвиг), ни по Y
 *     (реальный сдвиг 21-30px в зависимости от ряда). 19 из 20 скиллов получили точные
 *     координаты (не хватает №1 «Размашистый» — оставлена формула по умолчанию).
 *  2) «Панама СССР» (голова_5.png, shmot.js id:24) — предыдущая правка (manDy:-25, снятая на
 *     глаз по скриншоту 16.09.2026) оказалась перелётом; финальное значение (manDy:15),
 *     подтверждённое вживую в магазине шмоток, теперь захардкожено.
 *
 * Run: node tests/skill-lvltxt-positions-and-panama-final-manDy.test.js
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

const skillsSrc = readSrc('_client/src/game/shell/overlays/bosses_skills.js');
const shmotSrc  = readSrc('_client/src/game/shmot.js');

console.log('\nTest 1: SKILL_LVLTXT_POS содержит все 19 заданных координат + null для Размашистого');
{
    assert(/const SKILL_LVLTXT_POS = \[/.test(skillsSrc), 'массив позиций определён');

    const expected = [
        null, [538,208], [695,208], [860,208], [1002,208],
        [1005,315], [848,315], [696,315], [537,315], [396,315],
        [287,413], [457,415], [638,415], [789,415], [936,413],
        [1024,513], [891,513], [717,513], [562,513], [406,512],
    ];
    expected.forEach((pair, i) => {
        if(pair === null){
            assert(new RegExp('null,\\s*//\\s*0\\s').test(skillsSrc), `индекс ${i} (Размашистый) — null (формула по умолчанию)`);
        } else {
            const re = new RegExp('\\[' + pair[0] + ',' + pair[1] + '\\]');
            assert(re.test(skillsSrc), `индекс ${i} — координата [${pair[0]},${pair[1]}] присутствует в массиве`);
        }
    });
}

console.log('\nTest 2: цикл построения иконок использует SKILL_LVLTXT_POS с фолбэком на формулу');
{
    const start = skillsSrc.indexOf('lvlTxt.anchor.set(0.5);');
    const body  = skillsSrc.slice(start, start + 200);
    assert(/const lvlPos = SKILL_LVLTXT_POS\[i\];/.test(body), 'берёт позицию по индексу скилла');
    assert(/lvlTxt\.x = lvlPos \? lvlPos\[0\] : cx;/.test(body), 'X — из массива, иначе cx (формула по умолчанию)');
    assert(/lvlTxt\.y = lvlPos \? lvlPos\[1\] : cy \+ 30;/.test(body), 'Y — из массива, иначе cy+30 (формула по умолчанию)');
}

// 18.09.2026: значение 15 из этого батча оказалось ещё не окончательным — пользователь позже
// поднял ещё на 1px живой правкой (15→14), см. tests/panama-sssr-man-offset-fix.test.js.
// 23.09.2026: сам предмет (id:24 «Панама СССР») удалён целиком батчем "убери все шмотки,
// которые покупаются за монеты/тушёнку" (дублировала дроп-вещь «Панама (Охотник)») —
// позиционный разбор manDy неактуален, тест теперь регресс-гвард на отсутствие id:24.
console.log('\nTest 3: Панама СССР (id:24) удалена батчем 23.09.2026');
{
    const line = shmotSrc.split('\n').find(l => l.includes("id:24") && l.includes('Панама СССР'));
    assert(!line, 'предмет id:24 отсутствует в shmot.js (удалён — дублировал «Панама (Охотник)»)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
