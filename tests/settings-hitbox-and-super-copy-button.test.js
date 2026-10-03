/**
 * Test: батч 25.09.2026 (по прямому указанию) —
 *  1) Кнопка настроек: иконка/хитбокс сведены к одной позиции (1237,23), хитбокс уменьшен до
 *     реального размера иконки (35×35, было 45×45) — компенсирующий "+=10" в interface-panels.js
 *     больше не нужен (позиция зашита напрямую в interface_elements.min.js).
 *  2) Редактор позиций — новая кнопка "📋 СУПЕР КОПИРОВАТЬ": та же схема копирования, что у
 *     обычной, плюс rotation (в градусах) и фактические w/h объекта.
 *
 * Run: node tests/settings-hitbox-and-super-copy-button.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const ifaceLib   = readSrc('_client/development/libs/interface_elements.min.js');
const panelsSrc  = readSrc('_client/src/game/interface/interface-panels.js');
const editorSrc  = readSrc('_client/src/game/shell/overlays/universal_pos_editor.js');

console.log('\nTest 1: interface_elements.min.js — иконка и хитбокс кнопки настроек сведены к (1237,23), хитбокс 35×35');
{
    assert(ifaceLib.includes('_bst.x=1237;_bst.y=23;'), 'иконка (визуальный спрайт) на (1237,23)');
    assert(ifaceLib.includes('b.drawRect(0,0,35,35)'), 'хитбокс уменьшен до 35×35 (было 45×45)');
    assert(ifaceLib.includes('f.setTransform(1237,23)'), 'хитбокс-контейнер на той же позиции, что и иконка (1237,23) — раньше был (1244,13) + внешний "+=10"');
    assert(!ifaceLib.includes('b.drawRect(0,0,45,45)'), 'старый размер хитбокса (45×45) убран');
}

console.log('\nTest 2: interface-panels.js — компенсирующий "+= 10" убран (позиция теперь зашита напрямую)');
{
    const s = panelsSrc.indexOf('if(this.up.butt_settings){');
    const e = panelsSrc.indexOf('\n        }', s);
    const body = panelsSrc.slice(s, e);
    assert(!/butt_settings\.y \+= 10;/.test(body), 'компенсирующий сдвиг убран — иначе позиция снова разъехалась бы на 10px');
    assert(/this\._addHoverGlow\(this\.up\.butt_settings\);/.test(body), 'hover-эффект не тронут');
}

console.log('\nTest 3: универсальный редактор — новая кнопка "📋 СУПЕР КОПИРОВАТЬ"');
{
    assert(/superCopyBtn\.on\('pointerdown', \(\)=>this\._uCopySelectedSuper\(\)\);/.test(editorSrc), 'кнопка вызывает новый метод _uCopySelectedSuper');
    assert(/this\._uSuperCopyBtn = superCopyBtn;/.test(editorSrc), 'ссылка сохранена на this для очистки/исключения из хит-теста');
    assert(/child === this\._uSuperCopyBtn/.test(editorSrc), 'кнопка исключена из собственного хит-теста редактора (иначе её можно было бы случайно "утащить")');
    assert(/if\(this\._uSuperCopyBtn && this\._uSuperCopyBtn\.parent\) this\._uSuperCopyBtn\.parent\.removeChild\(this\._uSuperCopyBtn\);/.test(editorSrc),
        'кнопка удаляется при выключении редактора — не остаётся "призраком"');
}

console.log('\nTest 4: _uCopySelectedSuper — копирует x/y/scale + rotation (в градусах) + фактические w/h');
{
    const s = editorSrc.indexOf('proto._uCopySelectedSuper = function(){');
    const e = editorSrc.indexOf('\n    };', s);
    const body = editorSrc.slice(s, e);
    assert(/const rotDeg = Math\.round\(\(s\.rotation \|\| 0\) \* 180 \/ Math\.PI\);/.test(body), 'rotation переводится из радиан в градусы');
    assert(/', rot: ' \+ rotDeg \+ '°'/.test(body), 'угол поворота идёт в копируемый текст');
    assert(/', w: ' \+ Math\.round\(s\.width\) \+ ', h: ' \+ Math\.round\(s\.height\);/.test(body),
        'ширина/высота идут в текст — Math.round(s.width/height) уже учитывают scale (та же формула, что у текст-бокса)');
    assert(/this\._uUpdateReadout\('Скопировано \(супер,/.test(body), 'читаемая панель обновляется всегда, независимо от успеха буфера обмена (та же защита, что у обычного копирования)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
