/**
 * Test: индивидуальная подгонка (y-сдвиг + масштаб) фона на попапе выбора базы (hata.js).
 *
 * Раньше эти же значения (сняты через универсальный редактор позиций) были применены
 * только к home.js (главный экран/хаб) — но пользователь дрэгал именно this._bgSpr
 * попапа выбора локации (hata.js._render()), отдельный Sprite от home.js._hataBgSpr.
 * В итоге правка не была видна там, где её реально снимали. Фикс: то же самое
 * BG_ADJUST (ключ — имя файла h.img) применяется и в hata.js._render().
 *
 * Оба места (hata.js — превью при выборе, home.js — постоянный фон хаба после выбора)
 * должны использовать одинаковые значения — иначе фон "прыгает" при закрытии попапа.
 *
 * Run: node tests/hata-bg-adjust.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const hataSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), 'utf-8'
);
const homeSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'home.js'), 'utf-8'
);

// ── Test 1: BG_ADJUST в hata.js задаёт y/scale по каждому файлу ──────────────
console.log('\nTest 1: hata.js BG_ADJUST задаёт индивидуальный y/scale по имени файла h.img');
{
    const m = hataSrc.match(/const BG_ADJUST = \{([\s\S]*?)\n\};/);
    assert(!!m, 'BG_ADJUST найден в hata.js');
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

// ── Test 2: _render() применяет BG_ADJUST по h.img к this._bgSpr ─────────────
console.log('\nTest 2: _render() читает BG_ADJUST[h.img] и применяет y/scale к this._bgSpr');
{
    const m = hataSrc.match(/this\._bgSpr\.texture = PIXI\.Texture\.from\('\.\/images\/' \+ h\.img\);([\s\S]*?)this\._updateCharClothes\(\);/);
    assert(!!m, 'блок установки текстуры фона + подгонки найден перед _updateCharClothes()');
    if (m) {
        const body = m[1];
        assert(/const adj = BG_ADJUST\[h\.img\] \|\| \{ y: 0, scale: 1 \};/.test(body),
            'adj берётся из BG_ADJUST по h.img, с безопасным дефолтом {y:0,scale:1}');
        assert(/this\._bgSpr\.width\s*=\s*1280 \* adj\.scale;/.test(body), 'width = 1280 * adj.scale');
        assert(/this\._bgSpr\.height\s*=\s*604 \* adj\.scale;/.test(body), 'height = 604 * adj.scale');
        assert(/this\._bgSpr\.y = adj\.y;/.test(body), 'y выставляется из adj.y');
    }
}

// ── Test 3: значения совпадают с home.js (фон не "прыгает" после закрытия попапа) ──
console.log('\nTest 3: значения BG_ADJUST в hata.js совпадают с _bgAdjust в home.js (тот же файл → тот же y/scale)');
{
    const files = ['шлюз.png','канализация.png','двор_фон.png','мастерская.png','железка.png','заправка.png','станция.png'];
    const extractMap = (src, varName) => {
        const re = new RegExp(varName + '\\s*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};');
        const m = src.match(re);
        const map = {};
        if (m) {
            const re2 = /'([^']+)':\s*\{\s*y:\s*(-?\d+),\s*scale:\s*([\d.]+)\s*\}/g;
            let mm;
            while ((mm = re2.exec(m[1]))) map[mm[1]] = { y: +mm[2], scale: +mm[3] };
        }
        return map;
    };
    const hataMap = extractMap(hataSrc, 'const BG_ADJUST');
    const homeMap = extractMap(homeSrc, '_bgAdjust');
    for (const f of files) {
        const h = hataMap[f], w = homeMap[f];
        assert(!!h && !!w && h.y === w.y && h.scale === w.scale,
            `${f}: hata.js {y:${h && h.y},scale:${h && h.scale}} === home.js {y:${w && w.y},scale:${w && w.scale}}`);
    }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
