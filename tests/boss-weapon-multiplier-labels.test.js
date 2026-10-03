const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf8');
let failed = 0;
function assert(ok, msg){ if(ok) console.log('  OK', msg); else { console.error('  FAIL', msg); failed++; } }

assert(src.includes('3: {x:668, y:714}'), 'множитель мачете расположен по координатам редактора');
assert(src.includes('4: {x:751, y:714}'), 'множитель ствола расположен по координатам редактора');
assert(src.includes('5: {x:833, y:714}'), 'множитель автомата расположен по координатам редактора');
assert(!src.includes('_bossFightQtyLabels'), 'подпись количества доступных ударов удалена');
assert(!/Math\.floor\(qty \/ mult\)/.test(src), 'число вида «90x» больше не рассчитывается');
assert(src.includes("multLbl.text = mTxt"), 'для каждого донатного оружия показывается выбранный множитель');
if(failed) process.exit(1);
