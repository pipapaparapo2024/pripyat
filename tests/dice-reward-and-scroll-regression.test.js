/* Проверка: награды зариков всегда соответствуют показанным костям, premium ×0.9 до resolve,
 * а drag ползунка сводки слушает корень сцены. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const dice = fs.readFileSync(path.join(root, 'server/core/controllers/dice.php'), 'utf8');
const scroll = fs.readFileSync(path.join(root, '_client/src/game/svod/svod-scroll.js'), 'utf8');
let failed = 0;
function test(ok, name){ if(ok) console.log('✓ ' + name); else { console.error('✗ ' + name); failed++; } }
test(dice.includes('private function _reducePremiumRoll') && dice.includes('mt_rand(1, 100) > 10'), 'Рубли и шмот в зариках получают множитель шанса 0.9 до показа костей');
test(!dice.includes('$void = !empty($matchedRows)') && dice.includes('foreach($matchedRows as $row){'), 'resolve не аннулирует уже показанную награду');
test(dice.includes("$rolls = $this->_reducePremiumRoll($rolls, $catalog, $rollTrace);"), 'стартовый бросок применяет premium-множитель');
test(scroll.includes('const dragRoot = window.root || parent;') && scroll.includes("dragRoot.on('pointermove', onMove)"), 'ползунок сводки получает pointermove на корне сцены');
if(failed) process.exitCode = 1;
