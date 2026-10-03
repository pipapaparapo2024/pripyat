/**
 * Test: новый ассет "фаланги правой руки.png" (пальцы, обхватывающие предмет в руке) —
 * должен рендериться МЕЖДУ предметом в руке (cat:6, мачете/бита/и т.д. — поверх пальцев,
 * как будто рука его держит) и предплечьем/кистью (_rightHandSpr — поверх пальцев тоже,
 * закрывает основание хвата). Координаты — с PSD-слоя "фаланга мезинца" (X:852,Y:445),
 * с которым новый ассет совпадает по размеру пиксель-в-пиксель (35×18).
 *
 * Порядок z-index (сзади вперёд): ... → фаланги → предмет в руке (cat:6) → _rightHandSpr.
 *
 * Координаты x:634/y:441 — обновлены позже через универсальный редактор позиций
 * (старые с PSD-слоя "фаланга мезинца", x:852/y:445, не совпадали с реальной рукой).
 *
 * Run: node tests/home-right-hand-phalanx.test.js
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

console.log('\nTest 1: спрайт фаланги создаётся с координатами PSD-слоя "фаланга мезинца"');
{
    const m = src.match(/if\(!this\._rightHandPhalanxSpr\)\{([\s\S]*?)\n\t\t\}/);
    assert(!!m, 'блок создания _rightHandPhalanxSpr найден');
    if (m) {
        const body = m[1];
        assert(/PIXI\.Texture\.from\('\.\/images\/фаланги правой руки\.png'\)/.test(body), 'использует новый ассет "фаланги правой руки.png"');
        assert(/this\._rightHandPhalanxSpr\.x = 634;/.test(body), 'x = 634 (снято редактором позиций)');
        assert(/this\._rightHandPhalanxSpr\.y = 441;/.test(body), 'y = 441 (снято редактором позиций)');
    }
}

console.log('\nTest 2: z-order — фаланга добавляется ПЕРЕД предметом в руке (cat:6), а не после');
{
    const m = src.match(/CLOTH_SLOTS\.forEach\(s => \{([\s\S]*?)\n\t\t\}\);/);
    assert(!!m, 'CLOTH_SLOTS.forEach блок найден');
    if (m) {
        const body = m[1];
        assert(/if\(s\.cat === 6\) root\.layer0_mc\.addChild\(this\._rightHandPhalanxSpr\);/.test(body),
            'фаланга добавляется именно перед addChild слота cat:6 (предмет в руке рендерится поверх неё)');
        assert(/if\(s\.cat === 6\) root\.layer0_mc\.addChild\(this\._rightHandPhalanxSpr\);\s*\n\s*root\.layer0_mc\.addChild\(this\._clothSlots\[s\.cat\]\);/.test(body),
            'условие с фалангой стоит НЕПОСРЕДСТВЕННО перед addChild слота — гарантирует нужный z-order именно для cat:6');
    }
}

console.log('\nTest 3: _rightHandSpr (кисть/предплечье) по-прежнему добавляется ПОСЛЕ всего CLOTH_SLOTS-блока');
{
    const clothBlockEnd = src.indexOf('this.updateClothes();');
    const rightHandCreate = src.indexOf("this._rightHandSpr = new PIXI.Sprite(PIXI.Texture.from('./images/правая рука.png'))");
    assert(clothBlockEnd >= 0 && rightHandCreate >= 0 && clothBlockEnd < rightHandCreate,
        '_rightHandSpr создаётся/добавляется после блока CLOTH_SLOTS (значит, поверх фаланги и предмета в руке)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
