/**
 * Test: батч 19.09.2026 (по прямому указанию) —
 *
 *  1) «друзья актив.png» имел прозрачное поле слева (257×50, реальный видимый контент только
 *     в правых 160px), из-за чего файл был шире «друзья неактив.png» (159×35) — обрезан до
 *     фактического содержимого (160×35). ВАЖНО: это НЕ общее правило "всегда обрезать все
 *     файлы от прозрачности" — обрезка одного конкретного файла безопасна ТОЛЬКО потому, что
 *     позиционирование этой кнопки уже anchor-центрированное (anchor 0.5,0.5 + явные
 *     координаты центра), а не top-left. Для файлов, которые позиционируются top-left или чья
 *     прозрачная кайма ЯВЛЯЕТСЯ частью расчёта отступов где-то в коде, слепая обрезка сдвинула
 *     бы видимый контент — каждый случай нужно проверять отдельно, не автоматизировать чохом.
 *  2) Правая кнопка саб-таба («друзья» / «мои достижения») в топах урона/авторитета/достижений
 *     раньше вычисляла свой центр из ширины/высоты КОНКРЕТНОЙ активной картинки текущей вкладки
 *     (secondActiveW/H в svod.js) — из-за этого достижения садились в другую точку, чем урон/
 *     авторитет. Теперь единая абсолютная точка (SUBTAB_SECOND_X=789, SUBTAB_SECOND_Y=191,
 *     снята редактором позиций), одна и та же для всех трёх экранов.
 *
 * Run: node tests/svod-friends-btn-trim-and-unified-second-tab-position.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const svodSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod.js'), 'utf-8');
const lbSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-leaderboard.js'), 'utf-8');
const IMAGES_DIR = path.join(root, '_client', 'development', 'images');

function pngDims(p){
    const b = fs.readFileSync(p);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

console.log('\nTest 1: "друзья актив.png" обрезан от прозрачного поля слева — теперь вплотную к "друзья неактив.png"');
{
    const active  = pngDims(path.join(IMAGES_DIR, 'друзья актив.png'));
    const passive = pngDims(path.join(IMAGES_DIR, 'друзья неактив.png'));
    assert(active.w <= 165 && active.h === 35, `друзья актив.png обрезан до ~160×35, получили ${active.w}x${active.h}`);
    assert(Math.abs(active.w - passive.w) <= 2, `ширина актив (${active.w}) теперь почти совпадает с пассив (${passive.w}), не отличается на ~100px`);
}

console.log('\nTest 2: svod.js — secondActiveW/secondActiveH полностью убраны из конфигов вкладок (мёртвые после смены формулы)');
{
    assert(!/secondActiveW/.test(svodSrc), 'secondActiveW нигде не встречается в svod.js');
    assert(!/secondActiveH/.test(svodSrc), 'secondActiveH нигде не встречается в svod.js');
    // Регресс-гвард: конфиги трёх вкладок по-прежнему на месте, просто без размерных полей.
    assert(/cat: 4, bg: 'задний фон топы по авторитету\.png'/.test(svodSrc), "конфиг вкладки 'respect' на месте");
    assert(/cat: 0, bg: 'задний фон топы по урону\.png'/.test(svodSrc), "конфиг вкладки 'damage' на месте");
    assert(/cat: 5, bg: 'задний фон топы по достижения\.png'/.test(svodSrc), "конфиг вкладки 'ach' на месте");
}

console.log('\nTest 3: svod-leaderboard.js — единая абсолютная позиция правой кнопки для всех вкладок');
{
    // 22.09.2026: X сдвинут ещё раз редактором позиций (789→801, см.
    // svod-achievements-tab-position-and-transparent-padding-crop.test.js).
    assert(/const SUBTAB_SECOND_X = 801, SUBTAB_SECOND_Y = 191;/.test(lbSrc),
        'SUBTAB_SECOND_X=801, SUBTAB_SECOND_Y=191 — снято редактором позиций, единое значение');
    const start = lbSrc.indexOf('const subSecond = new PIXI.Sprite');
    const end   = lbSrc.indexOf('win.addChild(subSecond);');
    const body  = lbSrc.slice(start, end);
    assert(/subSecond\.x = SUBTAB_SECOND_X;/.test(body), 'subSecond.x = SUBTAB_SECOND_X напрямую (без +ширина/2)');
    assert(/subSecond\.y = SUBTAB_SECOND_Y;/.test(body), 'subSecond.y = SUBTAB_SECOND_Y напрямую (без +высота/2)');
    assert(/subSecond\.anchor\.set\(0\.5, 0\.5\);/.test(body), 'anchor(0.5,0.5) сохранён — центрирует любой ассет вокруг этой точки независимо от размера');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
