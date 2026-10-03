/**
 * Test: замок (не достигнут порог) и галочка "разрешено" (достигнут) для иконок
 * разблокировки смены карт в покере — это РАЗНЫЕ спрайты с НЕЗАВИСИМЫМИ координатами.
 * Раньше был один спрайт, который просто менял текстуру между замком и галочкой на
 * ОДНОЙ и той же позиции — пользователь явно указал, что расположение замка и
 * расположение галочки не совпадают и сводить их в одну точку не нужно.
 *
 * 24.09.2026 (позже в тот же день, по скриншоту редактора позиций poker_20_level.png):
 * все три замка и все три галочки сдвинуты ЕЩЁ РАЗ, одинаково — -14 по X, -1 по Y от
 * значений ниже (708→694 и т.д.) — см. комментарий над LVL_DATA в dvor-poker-screen.js.
 *
 * 25.09.2026 (по прямому указанию — новая позиция "покер разрешено.png" x:714,y:120,
 * scale:1.1, плюс новый арт замков/галочек из папки "вкладка двор" на рабочем столе):
 * галочки ("разрешено") у ВСЕХ трёх тиров сдвинуты ещё раз, тем же +13X/+1Y (701→714,
 * 119→120 и т.д.) — замки НЕ трогали, для них новых координат не присылали, только
 * заменили сам файл на актуальный.
 *
 * Run: node tests/poker-level-icons-position.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-poker-screen.js'), 'utf-8'
);

console.log('\nTest 1: LVL_DATA задаёt отдельные координаты замка и галочки для каждой из трёх иконок');
{
    const m = src.match(/const LVL_DATA = \[([\s\S]*?)\];/);
    assert(!!m, 'LVL_DATA найден');
    if (m) {
        const body = m[1];
        // 19.09.2026: вся сетка ячейки покера поднята на 12px по прямому указанию (Y -12).
        // 26.09.2026: lockX/Y уточнены редактором позиций ещё раз (scale не менялся — новые
        // значения совпадают с прежним lockScale 1-в-1). checkX/checkY не трогали.
        assert(/img:'poker_20_level',\s*thr:20,\s*lockX:707,\s*lockY:117,\s*lockScale:0\.981,\s*checkX:714,\s*checkY:120/.test(body),
            'poker_20_level — замок x:707 y:117 scale:0.981, галочка x:714 y:120 (не менялась)');
        assert(/img:'poker_60_level',\s*thr:60,\s*lockX:765,\s*lockY:117,\s*lockScale:0\.975,\s*checkX:771,\s*checkY:120/.test(body),
            'poker_60_level — замок x:765 y:117 scale:0.975, галочка x:771 y:120 (не менялась)');
        assert(/img:'poker_100_level',\s*thr:100,\s*lockX:821,\s*lockY:117,\s*lockScale:1\.000,\s*checkX:827,\s*checkY:120/.test(body),
            'poker_100_level — замок x:821 y:117 scale:1.000, галочка x:827 y:120 (не менялась)');
    }
}

console.log('\nTest 2: построение — два независимых спрайта (замок/галочка), не текстура-свитч на одном');
{
    const m = src.match(/for\(let li = 0; li < 3; li\+\+\)\{([\s\S]*?)\n        \}/);
    assert(!!m, 'цикл построения иконок найден');
    if (m) {
        const body = m[1];
        assert(/const lockSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/' \+ cfg\.img \+ '\.png'\)\);/.test(body),
            'lockSpr создаётся из cfg.img (замок для этого порога)');
        assert(/lockSpr\.x = cfg\.lockX; lockSpr\.y = cfg\.lockY;/.test(body), 'lockSpr позиционируется по cfg.lockX/lockY');
        assert(/const checkSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/poker_razresheno\.png'\)\);/.test(body),
            'checkSpr всегда создаётся из poker_razresheno.png (общая текстура галочки)');
        assert(/checkSpr\.x = cfg\.checkX; checkSpr\.y = cfg\.checkY;/.test(body), 'checkSpr позиционируется по cfg.checkX/checkY — отдельно от замка');
        assert(/checkSpr\.visible = false;/.test(body), 'галочка изначально скрыта (порог ещё не достигнут)');
    }
}

console.log('\nTest 3: обновление UI переключает видимость двух спрайтов, а не текстуру одного');
{
    const m = src.match(/this\._pokerLvlIcons\.forEach\(item => \{([\s\S]*?)\n\s{12}\}\);/);
    assert(!!m, 'блок обновления иконок найден');
    if (m) {
        const body = m[1];
        assert(/item\.lockSpr\.visible\s*=\s*!reached;/.test(body), 'замок скрывается, когда порог достигнут');
        assert(/item\.checkSpr\.visible\s*=\s*reached;/.test(body), 'галочка показывается, когда порог достигнут');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
