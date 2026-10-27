/**
 * Test: 24.10.2026 (по прямому указанию): две мелкие правки календаря "Разнарядка".
 *
 * 1) Галочка "разнарядка галочка выполнено.png" — scale 1.2. Якорь переведён на центр (0.5,0.5)
 *    и позиция — геометрический центр бирки дня (41×44: x+20.5,y+22), а не левый верхний угол
 *    (было x+8,y+12 без anchor) — иначе увеличение масштаба растягивало бы картинку от угла,
 *    съезжая от центра бирки, а не росло бы симметрично вокруг него.
 * 2) Выполненные дни (status 'done') перестают быть кликабельными — раньше interactive/
 *    buttonMode стояли true для ЛЮБОГО дня в пределах месяца, клик по выполненному дню молча
 *    ничего не делал (_onDayClick проверяет pay_costs), но курсор всё ещё показывал "кликабельно"
 *    — вводило в заблуждение. Только 'failed' (реально в pay_costs, см. getState()) остаются
 *    интерактивны.
 *
 * Run: node tests/oct24-raznaryadka-checkmark-scale-noninteractive.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client/src/game/shell/overlays/raznaryadka.js'), 'utf-8');

console.log('\nTest 1: галочка — anchor(0.5,0.5), центр бирки (x+20.5,y+22), scale 1.2');
{
    assert(/check\.anchor\.set\(0\.5, 0\.5\);/.test(src), 'check.anchor.set(0.5, 0.5) — центрированный якорь');
    assert(/check\.x = pos\.x \+ 20\.5; check\.y = pos\.y \+ 22;/.test(src), 'check позиционирована в геометрическом центре бирки (41×44)');
    assert(/check\.scale\.set\(1\.2\);/.test(src), 'check.scale.set(1.2) применён');
    assert(!/check\.x = pos\.x \+ 8; check\.y = pos\.y \+ 12;/.test(src), 'старая left-top позиция (без anchor) убрана');
}

console.log('\nTest 2: _render() — только проваленные (failed) дни остаются кликабельными, выполненные (done) — нет');
{
    const start = src.indexOf('for(let d = 1; d <= 31; d++){', src.indexOf('_render(){'));
    const body = src.slice(start, src.indexOf('\n        }\n', start));
    assert(/spr\.interactive = status === 'failed';/.test(body), "spr.interactive привязан к status==='failed'");
    assert(/spr\.buttonMode = status === 'failed';/.test(body), "spr.buttonMode привязан к status==='failed' (курсор не 'кликабельно' на done/pending)");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
