/**
 * Test: readout универсального редактора показывает не только scale, но и итоговый
 * width/height в пикселях.
 *
 * Причина: одинаковый по смыслу набор объектов (например, карты покера, все жёстко
 * зафиксированы на 80×127) может законно иметь РАЗНЫЙ scale — он зависит от нативного
 * разрешения конкретной исходной картинки. Показывая только scale, пользователь путал
 * "разный scale" с "разным итоговым размером", хотя width/height у объектов были
 * одинаковы. Явный вывод w/h снимает эту путаницу — сразу видно, что реально на экране.
 *
 * Run: node tests/universal-pos-editor-size-readout.test.js
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

console.log('\nTest 1: _uUpdateReadout выводит w/h вместе со scale');
{
    const m = src.match(/proto\._uUpdateReadout = function\(extra\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_uUpdateReadout найден');
    if (m) {
        const body = m[1];
        assert(/const sizeTxt\s*=\s*'  w: ' \+ Math\.round\(s\.width\) \+ '  h: ' \+ Math\.round\(s\.height\);/.test(body),
            'sizeTxt формируется из фактических s.width/s.height (не из scale)');
        assert(/scaleTxt \+ sizeTxt/.test(body), 'sizeTxt подставляется в итоговый текст readout вместе со scaleTxt');
    }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
