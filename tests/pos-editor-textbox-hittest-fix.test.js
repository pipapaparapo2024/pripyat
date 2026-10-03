/**
 * Test: батч 21.09.2026 (по прямому указанию, репорт живьём — "могу сделать бокс для текста,
 * но не могу ничего с ним, никак с ним взаимодействовать: не могу вписать текст, не могу им
 * двигать") — universal_pos_editor.js._uCreateTextBox() создавал бокс и его текст-образец
 * через `root.addChild(...)`, добавляя их НАПРЯМУЮ в корень сцены. Хит-тест самого редактора
 * (_uCollectAt/_uFindAllAt) сканирует ТОЛЬКО root.layer2_mc/layer1_mc/layer0_mc — сам root
 * не проверяется вообще, поэтому клик по только что созданному боксу никогда не находил его:
 * бокс визуально существовал (поэтому пользователь его видел и мог создавать), но был
 * физически невыбираемым — drag/resize/поворот/Delete не работали в принципе.
 *
 * Run: node tests/pos-editor-textbox-hittest-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8');

console.log('\nTest 1: _uFindAllAt/_uCollectAt хит-тест сканирует ТОЛЬКО layer0/1/2_mc (подтверждаем факт бага)');
{
    const start = src.indexOf('proto._uFindAllAt = function(gx, gy){');
    const end   = src.indexOf('\n    };', start);
    const body  = src.slice(start, end);
    assert(/this\._uCollectAt\(root\.layer2_mc, gx, gy, \[\]\)/.test(body), 'сканирует layer2_mc');
    assert(/this\._uCollectAt\(root\.layer1_mc, gx, gy, \[\]\)/.test(body), 'сканирует layer1_mc');
    assert(/this\._uCollectAt\(root\.layer0_mc, gx, gy, \[\]\)/.test(body), 'сканирует layer0_mc');
    assert(!/this\._uCollectAt\(root, gx, gy/.test(body), 'НЕ сканирует root напрямую — объект, добавленный туда, хит-тестом не находится');
}

console.log('\nTest 2: _uCreateTextBox() добавляет бокс и его текст-образец в layer2_mc, а не в root напрямую');
{
    const start = src.indexOf('proto._uCreateTextBox = function(){');
    const end   = src.indexOf('\n    };', start);
    const body  = src.slice(start, end);

    assert(/root\.layer2_mc\.addChild\(label\);/.test(body), 'текст-образец добавляется в root.layer2_mc (не в root)');
    assert(/root\.layer2_mc\.addChild\(box\);/.test(body), 'сам бокс добавляется в root.layer2_mc (не в root)');
    assert(!/(?<!layer2_mc\.)\broot\.addChild\(box\)/.test(body), 'старый вызов root.addChild(box) напрямую в root убран');
    assert(!/(?<!layer2_mc\.)\broot\.addChild\(label\)/.test(body), 'старый вызов root.addChild(label) напрямую в root убран');
}

console.log('\nTest 3: box._uDraggable/_uIsTextBox по-прежнему выставлены — теперь хит-тест реально их находит (см. Test 1)');
{
    const start = src.indexOf('proto._uCreateTextBox = function(){');
    const end   = src.indexOf('\n    };', start);
    const body  = src.slice(start, end);
    assert(/box\._uDraggable = true;/.test(body), 'box._uDraggable=true (флаг, по которому _uCollectAt подбирает объект)');
    assert(/box\._uIsTextBox = true;/.test(body), 'box._uIsTextBox=true (для Delete/копирования {x,y,w,h})');
    assert(/box\.interactive = true; box\.buttonMode = true;/.test(body), 'box кликабелен');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
