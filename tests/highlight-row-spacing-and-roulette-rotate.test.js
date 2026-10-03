/**
 * Test: три правки по итогам замеров через редактор позиций.
 *
 * 1) Зарики/покер/блэкджек — шаг между строками подсветки таблицы был неточным
 *    (зарики: не различал шаг внутри группы из 3 строк и шаг через черточку-разделитель;
 *    покер: 38px вместо 36px; блэкджек: ~38px вместо 35px). Теперь считается формулой
 *    от замеренного шага вместо ручного набора 18/9/9 чисел.
 *
 * 2) Блэкджек — текст результата над столом дублировал подсветку строки таблицы выплат
 *    (как уже было сделано для покера и зариков) — убран из отображения.
 *
 * 3) Рулетка — клин-подсветка сектора теперь умеет поворачиваться (Q/E) и менять угол
 *    раствора (,/.) через универсальный редактор позиций — раньше можно было только
 *    двигать и равномерно масштабировать, а этого недостаточно для клина колеса.
 *
 * Run: node tests/highlight-row-spacing-and-roulette-rotate.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game', 'dvor');
const dice = fs.readFileSync(path.join(root, 'dvor-dice-screen.js'), 'utf-8');
const poker = fs.readFileSync(path.join(root, 'dvor-poker-screen.js'), 'utf-8');
const bj = fs.readFileSync(path.join(root, 'dvor-blackjack.js'), 'utf-8');
const roul = fs.readFileSync(path.join(root, 'dvor-roulette-screen.js'), 'utf-8');
const editor = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8'
);

console.log('\nTest 1: зарики — DICE_ROW теперь явная карта {x,y} на 18 строк (04.10.2026, реальный замер каждой строки)');
{
    // 04.10.2026 (реальный замер пользователем через универсальный редактор позиций для ВСЕХ
    // 18 строк разом): массив из одних Y (DICE_ROW_Y) заменён на карту {x,y} (DICE_ROW) — см.
    // dice-combo-highlight-explicit-position-array.test.js для полной проверки.
    const m = dice.match(/const DICE_ROW = \[([\s\S]*?)\n    \];/);
    assert(!!m, 'DICE_ROW найден как явная карта {x,y}');
    if(m){
        const ys = [...m[1].matchAll(/y:\s*(-?\d+)\s*\}/g)].map(x => parseInt(x[1]));
        assert(ys.length === 18, 'карта содержит ровно 18 записей (по одной на строку таблицы)');
        assert(ys[0] === 152, 'верхняя строка (4×6) — y:152');
        assert(ys[17] === 563, 'последняя (18-я) строка — y:563');
    }
}

console.log('\nTest 2: покер — подсветка таблицы комбинаций (формула заменена точным замером по каждой строке)');
{
    // 26.09.2026: формула COMBO_ROW_ORDER.forEach(...база+шаг...) заменена на явную карту
    // {x,y} по каждой из 10 комбинаций отдельно (редактор позиций дал разные, не строго
    // равномерные шаги между строками реального фона) — см.
    // tests/poker-combo-highlight-exact-positions-and-error-codes.test.js для полной проверки.
    assert(/const COMBO_ROW_POS = \{/.test(poker), 'формула заменена явной картой позиций COMBO_ROW_POS');
    assert(!/COMBO_ROW_ORDER\.forEach/.test(poker), 'старая формула с единым шагом убрана целиком');
}

console.log('\nTest 3: блэкджек — BJ_ROW_Y теперь явные точечные значения (было формулой 235+i*35), текст результата убран');
{
    // 22.09.2026 (по прямому указанию, редактор позиций — точные замеры для ВСЕХ 9 строк
    // разом): формула заменена явным объектом-таблицей — см.
    // blackjack-combo-highlight-point-data-and-error-popup-position.test.js.
    assert(/const BJ_ROW_Y = \{/.test(bj), 'BJ_ROW_Y — объект-литерал (точечные значения), не формула');
    assert(!/BJ_ROW_Y\[key\] = 235 \+ i \* 35;/.test(bj), 'старая формула (235 + i*35) убрана');
    assert(!/win\.addChild\(resultTxt\);/.test(bj), 'resultTxt больше не добавляется в win (не рендерится)');
    assert(/this\._bjResultTxt = resultTxt;/.test(bj), 'объект всё ещё существует headless (на будущее)');
}

// 23.09.2026 (по прямому указанию — "убери подсвечивание для игры рулетку"): клин сектора
// (sectorHighlight/_drawRouletteSector/_uAdjustWidth) убран из рулетки целиком — Q/E/,/.
// остаются рабочими для ЛЮБОГО другого объекта редактора (см. Test 5 ниже), просто у рулетки
// больше нет объекта с этими флагами. См. tests/roulette-sector-highlight-removed.test.js.
console.log('\nTest 4: рулетка — регресс-гвард, клин сектора не возвращён');
{
    assert(!/this\._roulSectorHighlight =/.test(roul), 'this._roulSectorHighlight больше не создаётся (комментарий о старой фиче может упоминать имя — это нормально)');
    assert(!/_uAdjustWidth/.test(roul), '_uAdjustWidth (специфичный для клина колбэк) отсутствует в dvor-roulette-screen.js');
}

console.log('\nTest 5: universal_pos_editor — Q/E теперь универсальны, ,/. по-прежнему только для явно разрешивших');
{
    // 18.09.2026 (по прямому указанию): поворот Q/E раньше работал только для объектов с флагом
    // _uRotatable (единственный пример — клин рулетки) — теперь работает для ЛЮБОГО выбранного
    // объекта, флаг _uRotatable для поворота больше не проверяется. ,/. (сужение/расширение угла
    // клина рулетки) — узкоспециальная штука, осталась как была, только для явно разрешивших.
    assert(!/key === 'q' && this\._uSelected\._uRotatable/.test(editor), 'Q больше не ограничен флагом _uRotatable — работает для любого объекта');
    assert(!/key === 'e' && this\._uSelected\._uRotatable/.test(editor), 'E больше не ограничен флагом _uRotatable — работает для любого объекта');
    assert(/key === 'q'\) this\._uSelected\.rotation/.test(editor), 'Q крутит rotation любого выбранного объекта');
    assert(/key === 'e'\) this\._uSelected\.rotation/.test(editor), 'E крутит rotation любого выбранного объекта');
    assert(/key === ',' && typeof this\._uSelected\._uAdjustWidth === 'function'/.test(editor), ', сужает только объекты с методом _uAdjustWidth');
    assert(/key === '\.' && typeof this\._uSelected\._uAdjustWidth === 'function'/.test(editor), '. расширяет только объекты с методом _uAdjustWidth');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
