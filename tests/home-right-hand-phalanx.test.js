/**
 * Test: изначально "фаланги правой руки.png" (пальцы, обхватывающие предмет в руке) —
 * рендерился МЕЖДУ предметом в руке (cat:6, мачете/бита/и т.д. — поверх пальцев, как будто
 * рука его держит) и предплечьем/кистью (бывший _rightHandSpr — "правая рука.png"/"правая
 * рука пустая.png", поверх пальцев тоже, закрывал основание хвата).
 *
 * 21.10.2026 (по прямому указанию — "предплечье всегда одно, кисть меняется", см.
 * ПЕРЕИМЕНОВАНИЕ_АССЕТОВ_21_10_2026.md): система расщеплена на ДВА отдельных слоя с новыми
 * ролями, та же пара переменных ПЕРЕИМЕНОВАНА под новый смысл — this._rightHandSpr теперь
 * ПОЛНАЯ кисть ("кисть расслабленная.png"/"кисть хват.png", занимает старое место фаланг,
 * x:634/y:441), this._rightForearmSpr — статичное предплечье ("предплечье правое.png",
 * занимает старое место "правая рука.png", x:630/y:369). Z-order (сзади вперёд) не менялся:
 * ... → кисть (this._rightHandSpr) → предмет в руке (cat:6) → предплечье (this._rightForearmSpr
 * добавляется позже всего CLOTH_SLOTS-блока — по факту предплечье поверх всего, как и раньше
 * "правая рука.png").
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

console.log('\nTest 1: спрайт кисти (бывшие фаланги) создаётся с дефолтной текстурой "кисть расслабленная.png"');
{
    // 22.10.2026 (по прямому указанию, редактор позиций): общий box x:634/y:441 для обеих
    // текстур заменён на свой x/y/scale под каждую — создание использует x:647/y:424
    // (позиция "расслабленная.png"), x:634/y:421 ("хват.png") проставляется при переключении
    // текстуры в updateClothes(), см. home-hands-and-bg-adjust.test.js и
    // oct21-new-shmot-sets-and-forearm-hand-split.test.js для актуальных значений.
    const m = src.match(/if\(!this\._rightHandSpr\)\{([\s\S]*?)\n\t\t\}/);
    assert(!!m, 'блок создания _rightHandSpr найден');
    if (m) {
        const body = m[1];
        assert(/PIXI\.Texture\.from\('\.\/images\/кисть расслабленная\.png'\)/.test(body), 'использует ассет "кисть расслабленная.png" по умолчанию');
        assert(/this\._rightHandSpr\.x = 642;/.test(body), 'x = 642 (позиция "расслабленная.png")');
        assert(/this\._rightHandSpr\.y = 427;/.test(body), 'y = 427 (позиция "расслабленная.png")');
    }
}

console.log('\nTest 2: z-order — кисть добавляется ПЕРЕД предметом в руке (cat:6), а не после');
{
    const m = src.match(/CLOTH_SLOTS\.forEach\(s => \{([\s\S]*?)\n\t\t\}\);/);
    assert(!!m, 'CLOTH_SLOTS.forEach блок найден');
    if (m) {
        const body = m[1];
        assert(/if\(s\.cat === 6\) root\.layer0_mc\.addChild\(this\._rightHandSpr\);/.test(body),
            'кисть добавляется именно перед addChild слота cat:6 (предмет в руке рендерится поверх неё)');
        assert(/if\(s\.cat === 6\) root\.layer0_mc\.addChild\(this\._rightHandSpr\);\s*\n\s*root\.layer0_mc\.addChild\(this\._clothSlots\[s\.cat\]\);/.test(body),
            'условие с кистью стоит НЕПОСРЕДСТВЕННО перед addChild слота — гарантирует нужный z-order именно для cat:6');
    }
}

console.log('\nTest 3: _rightForearmSpr (предплечье) по-прежнему добавляется ПОСЛЕ всего CLOTH_SLOTS-блока');
{
    const clothBlockEnd = src.indexOf('this.updateClothes();');
    const forearmCreate = src.indexOf("this._rightForearmSpr = new PIXI.Sprite(PIXI.Texture.from('./images/предплечье правое.png'))");
    assert(clothBlockEnd >= 0 && forearmCreate >= 0 && clothBlockEnd < forearmCreate,
        '_rightForearmSpr создаётся/добавляется после блока CLOTH_SLOTS (значит, поверх кисти и предмета в руке)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
