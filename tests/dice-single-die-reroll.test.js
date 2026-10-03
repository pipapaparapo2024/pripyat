/**
 * Test: по ТЗ один заряд переброса в зариках должен тратиться РОВНО на один кубик
 * ("Каждый перекид заменяет только выбранный кубик"). Раньше можно было выделить
 * сразу несколько кубиков и перебросить все за один заряд (_diceConfirmNewScreen
 * перебирал ВСЕ this._diceSelected[i]===true, но списывал заряд только один раз).
 * Исправлено в _toggleDiceSwap — выбор нового кубика снимает выделение с остальных,
 * так что одновременно выделенным может быть максимум один.
 *
 * Run: node tests/dice-single-die-reroll.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-dice-game.js'), 'utf-8'
);

console.log('\nTest 1: выбор кубика снимает выделение с остальных (не более одного выбранного одновременно)');
{
    const m = src.match(/proto\._toggleDiceSwap = function\(idx\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_toggleDiceSwap найден');
    if (m) {
        const body = m[1];
        assert(/for\(let i = 0; i < 4; i\+\+\)\{\s*this\._diceSelected\[i\] = false;/.test(body),
            'перед установкой нового выбора все остальные кубики снимаются с выделения');
        assert(/this\._diceSelected\[idx\] = true;/.test(body), 'затем выставляется выбор именно для idx');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
