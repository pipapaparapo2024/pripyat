/**
 * Test: 26.09.2026, по прямому репорту (со скриншотом) — предыдущая попытка реализовать
 * "повторный клик перебрасывает кубик" ошибочно навесила взвод/подтверждение на кнопку
 * БРОСИТЬ ("НАЖМИТЕ ЕЩЁ РАЗ ДЛЯ БРОСКА"), хотя запрос был про САМ кубик: первый клик по
 * кубику выбирает его (покачивание, см. _diceSelectAnim), ПОВТОРНЫЙ клик именно по уже
 * выбранному кубику должен сразу его перебросить — без отдельной кнопки-подтверждения.
 * Эта правка отменяет взвод БРОСИТЬ (снова одиночный клик = dice.start) и переносит
 * click-to-reroll на _toggleDiceSwap.
 *
 * Run: node tests/dice-die-click-twice-rerolls.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const gameSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice-game.js'), 'utf-8');
const screenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice-screen.js'), 'utf-8');
const dvorSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice.js'), 'utf-8');

console.log('\nTest 1: кнопка БРОСИТЬ снова одиночный клик — взвод/подтверждение полностью убраны');
{
    assert(!/_diceThrowArmed/.test(gameSrc), '_diceThrowArmed нигде не осталось в dvor-dice-game.js');
    assert(!/_disarmDiceThrow/.test(gameSrc), '_disarmDiceThrow нигде не осталось в dvor-dice-game.js');
    assert(!/_disarmDiceThrow/.test(dvorSrc), '_disarmDiceThrow нигде не осталось в dvor-dice.js (_closeDiceScreen)');
    assert(!/_diceThrowConfirmTxt/.test(screenSrc), 'подпись "НАЖМИТЕ ЕЩЁ РАЗ ДЛЯ БРОСКА" убрана из dvor-dice-screen.js');
    const start = gameSrc.indexOf('proto._playDiceNewScreen = function()');
    // 28.09.2026: окно расширено 900→1500→2200 — сначала комментарий про suspendPlayerSave, а
    // потом ещё flushPlayerSave-обёртка (см. casino-round-start-flush-before-exp-race.test.js)
    // сдвинули искомую строку дальше за прежнюю границу окна.
    const body  = gameSrc.slice(start, start + 2200);
    assert(/TS\.php\('dice\.start'/.test(body), '_playDiceNewScreen шлёт dice.start сразу, без промежуточного клика-взвода');
}

console.log('\nTest 2: клик по НЕвыбранному кубику — только выбирает его (покачивание), реролл не уходит');
{
    const start = gameSrc.indexOf('proto._toggleDiceSwap = function(idx)');
    const body  = gameSrc.slice(start, gameSrc.indexOf('\n    };', start));
    const selectBranch = body.slice(body.indexOf('// По ТЗ один заряд'));
    assert(/this\._diceSelected\[idx\] = true;/.test(selectBranch), 'при первом клике кубик просто помечается выбранным');
    assert(/this\._diceSelectAnim\(idx\);/.test(selectBranch), 'запускается анимация покачивания (_diceSelectAnim)');
    assert(!/_diceConfirmNewScreen\(\)/.test(selectBranch), 'при ПЕРВОМ клике reroll (_diceConfirmNewScreen) НЕ вызывается');
}

console.log('\nTest 3: повторный клик по УЖЕ выбранному кубику сразу перебрасывает его');
{
    const start = gameSrc.indexOf('proto._toggleDiceSwap = function(idx)');
    const body  = gameSrc.slice(start, gameSrc.indexOf('\n    };', start));
    assert(/if\(this\._diceSelected\[idx\]\)\{/.test(body), 'есть ветка "кубик уже выбран"');
    const already = body.slice(body.indexOf('if(this._diceSelected[idx]){'), body.indexOf('// По ТЗ один заряд'));
    assert(/this\._diceConfirmNewScreen\(\);/.test(already), 'повторный клик по тому же кубику вызывает _diceConfirmNewScreen() (реролл)');
    assert(/return;/.test(already), 'после вызова реролла функция завершается (не переходит к логике выбора)');
}

console.log('\nTest 4: хит-зона кубика по-прежнему зовёт единый _toggleDiceSwap(idx) — вся логика внутри него');
{
    assert(/hit\.on\('pointerdown', \(\)=>this\._toggleDiceSwap\(_di\)\);/.test(screenSrc), 'клик по кубику вызывает _toggleDiceSwap(idx)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
