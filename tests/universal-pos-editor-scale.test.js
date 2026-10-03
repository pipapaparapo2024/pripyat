/**
 * Test: масштабирование (увеличение/уменьшение) объекта в универсальном редакторе позиций.
 *
 * Раньше редактор умел только двигать объект (drag + стрелки). По просьбе добавлена
 * попиксельная подгонка размера: PageUp/PageDown меняют равномерный (uniform) scale
 * выбранного объекта, Shift — шаг ×10. Шаг переведён из "экранных пикселей" в scale через
 * нативную ширину текстуры объекта (texture.orig.width), чтобы +1 ощущался одинаково для
 * любого объекта независимо от исходного разрешения его картинки.
 *
 * Run: node tests/universal-pos-editor-scale.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8'
);

// ── Test 1: PageUp/PageDown вызывают _uScaleStep с нужным знаком шага ─────────
console.log('\nTest 1: клавиатурный обработчик реагирует на PageUp/PageDown');
{
    const m = src.match(/this\._uKeyHandler = \(e\) => \{([\s\S]*?)\n\s{8}\};/);
    assert(!!m, '_uKeyHandler найден');
    if (m) {
        const body = m[1];
        assert(/e\.key === 'PageUp'\s*\)\s*this\._uScaleStep\(this\._uSelected, step\);/.test(body),
            'PageUp увеличивает размер (+step)');
        assert(/e\.key === 'PageDown'\s*\)\s*this\._uScaleStep\(this\._uSelected, -step\);/.test(body),
            'PageDown уменьшает размер (-step)');
        assert(/const step = e\.shiftKey \? 10 : 1;/.test(body), 'step переиспользует ту же логику Shift=10/1px, что и стрелки');
    }
}

// ── Test 2: _uScaleStep переводит пиксели в равномерный scale через нативную ширину ──
console.log('\nTest 2: _uScaleStep конвертирует deltaPx в scale через texture.orig.width');
{
    const m = src.match(/proto\._uScaleStep = function\(obj, deltaPx\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_uScaleStep найден');
    if (m) {
        const body = m[1];
        assert(/obj\.texture\.orig\.width/.test(body), 'использует нативную ширину текстуры (orig.width) как базу шага');
        assert(/Math\.max\(0\.02, cur \+ deltaPx \/ Math\.max\(1, nativeW\)\);/.test(body),
            'новый scale = текущий + (пиксели/нативная ширина), не может уйти в 0 или отрицательный');
        assert(/obj\.scale\.x = next;\s*\n\s*obj\.scale\.y = next;/.test(body),
            'scale.x и scale.y выставляются одинаково (равномерное масштабирование, без искажения пропорций)');
    }
}

// ── Test 3: readout и копирование включают текущий scale ─────────────────────
console.log('\nTest 3: readout и КОПИРОВАТЬ показывают/копируют scale выбранного объекта');
{
    assert(/const scaleTxt = s\.scale \? '  scale: ' \+ s\.scale\.x\.toFixed\(3\) : '';/.test(src),
        'readout формирует строку scale, если у объекта есть свойство scale');
    assert(/scaleTxt \+ sizeTxt \+ rotTxt \+ widthTxt \+ hint;/.test(src), 'scaleTxt подставляется в текст readout (вместе с sizeTxt)');
    assert(/\(s\.scale \? ', scale: ' \+ s\.scale\.x\.toFixed\(3\) : ''\)/.test(src),
        '_uCopySelected добавляет scale в копируемый текст');
}

// ── Test 4: после PageUp/PageDown readout и рамка-подсветка обновляются ──────
console.log('\nTest 4: после нажатия PageUp/PageDown readout и hover-рамка пересчитываются');
{
    const m = src.match(/if\(moved\)\{([\s\S]*?)\n            \}/);
    assert(!!m, 'после любого движения (включая масштаб) обновляются и readout, и рамка вокруг объекта');
    if(m){
        assert(/this\._uUpdateReadout\(\);/.test(m[1]), 'readout обновляется');
        assert(/this\._uUpdateHoverBox\(this\._uSelected\);/.test(m[1]), 'hover-рамка обновляется');
    }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
