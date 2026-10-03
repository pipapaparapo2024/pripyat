/**
 * Test: позиционные правки попапов.
 *
 * 1) confirm.js / yashik.js — "отмена актив" (подсветка кнопки ОТМЕНА при нажатии)
 *    поднята на 2px в обоих попапах: "Подтвердить действие?" (confirm.js) и
 *    "Купить патрон?" (yashik.js._openBuyPatronPopup).
 *
 * 2) yashik.js._openOtkrytYashik — суммы наград в попапе "Результат обыска"
 *    зафиксированы на координатах, снятых через редактор позиций (532,451)/(688,451)/
 *    (835,451) — заменили старую формулу от исходных PSD-отступов.
 *
 * Run: node tests/otm-activ-and-yashik-reward-pos.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const confirmSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'popups', 'confirm.js'), 'utf-8'
);
const yashikSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'yashik.js'), 'utf-8'
);

// ── Test 1: otmActive (confirm.js) — позиция ─────────────────────────────────
// ИСТОРИЯ: сначала была формула от PSD-отступов (665-10, 386-32-2), затем прямой
// замер через редактор позиций (15.09.2026) заменил её на явные числа x:656 y:352
// (y практически не изменился, x сдвинулся на 1px) — см.
// tests/roulette-highlight-and-confirm-cancel-position.test.js Test 2 для деталей.
console.log('\nTest 1: confirm.js otmActive — актуальная позиция (замер редактора, x:656 y:352)');
{
    assert(/otmActive\.x = 656; otmActive\.y = 352;/.test(confirmSrc), 'otmActive.x = 656, otmActive.y = 352');
}

// ── Test 2: cancelActiv (yashik.js, купить патрон) поднят на 2px ──────────────
console.log('\nTest 2: yashik.js cancelActiv поднят на 2px (393-32-2)');
{
    assert(/cancelActiv\.y = 393 - 32 - 2;/.test(yashikSrc), 'cancelActiv.y = 393 - 32 - 2');
}

// ── Test 3: суммы наград в "Результат обыска" — фиксированные измеренные координаты ──
console.log('\nTest 3: суммы наград (рубли/сигареты/нычки) — координаты сняты редактором позиций');
{
    assert(/_addItemTxt\('\+' \+ coinsGain,\s*532, 451\);/.test(yashikSrc), 'рубли: (532,451)');
    assert(/_addItemTxt\('\+' \+ fmt\(cigsGain\),\s*688, 451\);/.test(yashikSrc), 'сигареты: (688,451)');
    assert(/_addItemTxt\('\+' \+ stashGain,\s*835, 451\);/.test(yashikSrc), 'нычки: (835,451)');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
