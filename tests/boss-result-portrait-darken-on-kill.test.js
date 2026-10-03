/**
 * Test: 24.09.2026, по прямому указанию + скриншот — "если босс убит, картинка босса должна
 * затемняться, а не просто текст УБИТ поверх неё". Раньше на победном экране рисовался только
 * диагональный штамп "УБИТ" текстом, сам портрет оставался в исходной яркости.
 *
 * Run: node tests/boss-result-portrait-darken-on-kill.test.js
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf8');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

const portraitIdx = src.indexOf("const portrait = _sprite(portraitFile, PORTRAIT_POS);");
const stampIdx    = src.indexOf("const killedStamp = new PIXI.Text('УБИТ'");
assert(portraitIdx !== -1, 'портрет найден');
assert(stampIdx !== -1, 'штамп УБИТ найден');

const between = src.slice(portraitIdx, stampIdx);
console.log('\nЗатемнение добавлено между портретом и штампом "УБИТ" (только на победе)');
assert(/const portraitDark = new PIXI\.Graphics\(\);/.test(between), 'новый Graphics-оверлей создан');
assert(/portraitDark\.beginFill\(0x000000, 0\.55\);/.test(between), 'заливка чёрным с прозрачностью (не сплошной чёрный квадрат)');
assert(/portraitDark\.drawRect\(0, 0, PORTRAIT_W, PORTRAIT_H\);/.test(between), 'размер оверлея точно совпадает с портретом (не весь экран)');
assert(/portraitDark\.x = PORTRAIT_POS\.x; portraitDark\.y = PORTRAIT_POS\.y;/.test(between), 'позиция оверлея совпадает с позицией портрета');
assert(/if\(isWin\)\{\s*\n\s*const portraitDark/.test(between), 'оверлей добавляется ТОЛЬКО на экране победы (isWin), не на поражении');
assert(/win\.addChild\(portraitDark\);/.test(between), 'оверлей реально добавлен в дерево сцены');

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);
