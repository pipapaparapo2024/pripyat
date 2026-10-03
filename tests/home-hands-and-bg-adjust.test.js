/**
 * Test: точные координаты кистей рук на главном экране и индивидуальная подгонка
 * (вертикальный сдвиг + масштаб) фонов локаций — сняты через универсальный редактор
 * позиций прямо на живом экране (а не через формулу от смещения манекена в магазине,
 * которая давала расхождение в несколько пикселей).
 *
 * Run: node tests/home-hands-and-bg-adjust.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'home.js'), 'utf-8'
);

// ── Test 1: правая/левая рука — точные координаты, снятые редактором ─────────
console.log('\nTest 1: координаты правой/левой руки заданы напрямую (не формулой от 224/-4)');
{
    const mRight = src.match(/this\._rightHandSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/правая рука\.png'\)\);([\s\S]*?)\n\t\t\}/);
    assert(!!mRight, 'блок создания правой руки найден');
    if (mRight) {
        assert(/this\._rightHandSpr\.x = 630;/.test(mRight[1]), 'правая рука x = 630 (было 631, сдвинута на 1px для согласованности с hata.js)');
        assert(/this\._rightHandSpr\.y = 369;/.test(mRight[1]), 'правая рука y = 369');
    }
    const mLeft = src.match(/this\._leftHandSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/левая рука\.png'\)\);([\s\S]*?)\n\t\t\}/);
    assert(!!mLeft, 'блок создания левой руки найден');
    if (mLeft) {
        assert(/this\._leftHandSpr\.x = 534;/.test(mLeft[1]), 'левая рука x = 534');
        assert(/this\._leftHandSpr\.y = 385;/.test(mLeft[1]), 'левая рука y = 385');
    }
}

// ── Test 2: _bgAdjust содержит индивидуальную подгонку для каждого фона ──────
console.log('\nTest 2: _bgAdjust задаёт y/scale индивидуально по каждому файлу фона локации');
{
    const m = src.match(/_bgAdjust = \{([\s\S]*?)\n\t\};/);
    assert(!!m, '_bgAdjust найден');
    if (m) {
        const body = m[1];
        const cases = [
            ["'шлюз.png':",        'y: 32, scale: 1.000'],
            ["'канализация.png':", 'y: 35, scale: 1.000'],
            ["'двор_фон.png':",    'y: 54, scale: 1.000'],
            ["'мастерская.png':",  'y: 74, scale: 1.000'],
            ["'железка.png':",     'y: 56, scale: 1.002'],
            ["'заправка.png':",    'y: 63, scale: 1.004'],
            ["'станция.png':",     'y: 73, scale: 1.000'],
        ];
        for (const [key, frag] of cases) {
            assert(body.includes(key) && body.includes(frag), `${key} → { ${frag} }`);
        }
    }
}

// ── Test 3: updateBg() применяет adj.y/adj.scale к спрайту фона ──────────────
console.log('\nTest 3: updateBg() читает _bgAdjust по имени текущего файла и применяет y/scale');
{
    const m = src.match(/updateBg\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'updateBg() найден');
    if (m) {
        const body = m[1];
        assert(/const adj\s*=\s*this\._bgAdjust\[file\] \|\| \{ y: 0, scale: 1 \};/.test(body),
            'adj берётся из _bgAdjust по имени файла, с безопасным дефолтом {y:0,scale:1}');
        assert(/this\._hataBgSpr\.width\s*=\s*1280 \* adj\.scale;/.test(body), 'width = 1280 * adj.scale');
        assert(/this\._hataBgSpr\.height\s*=\s*604 \* adj\.scale;/.test(body), 'height = 604 * adj.scale');
        assert(/this\._hataBgSpr\.y = adj\.y;/.test(body), 'y выставляется из adj.y');
    }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
