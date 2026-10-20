/**
 * Test: кнопка "ПЕРЕБРОСИТЬ/ПОДТВЕРДИТЬ" в зариках (_diceConfirmBtn) стояла на y=635 —
 * внутри зоны нижнего HUD (604-720). Пока Двор прятал общий HUD, это было незаметно.
 * После того как HUD стал всегда видимым поверх экранов Двора (см. interface.js —
 * restoreHud() больше не скрывает его для Двора, добавляется в layer2_mc ПОСЛЕ игровых
 * экранов = рендерится сверху), кнопка оказалась физически перекрыта HUD-баром и стала
 * невидимой/некликабельной. Перенесена на позицию кнопки БРОСИТЬ (604,523) — они никогда
 * не видны одновременно (взаимоисключающие состояния экрана).
 *
 * Run: node tests/dice-confirm-btn-hud-overlap.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-dice-screen.js'), 'utf-8'
);

console.log('\nTest 1: confirmBtn (ПЕРЕБРОСИТЬ/ПОДТВЕРДИТЬ) вынесена из зоны нижнего HUD (604-720)');
{
    // 20.10.2026 (редактор позиций): throwBtn/confirmBtn вместе переехали на (624,541) —
    // по-прежнему делят одну позицию (см. Test 2), по-прежнему вне зоны HUD (604-720 по Y).
    assert(/confirmBtn\.x = 624; confirmBtn\.y = 541;/.test(src),
        'confirmBtn стоит на (624, 541) — совпадает с throwBtn, вне зоны HUD');
    assert(!/confirmBtn\.x = 520; confirmBtn\.y = 635;/.test(src),
        'старая позиция (520, 635) внутри зоны HUD убрана');
}

console.log('\nTest 2: throwBtn (БРОСИТЬ) остаётся на той же позиции, что и confirmBtn — кнопки взаимоисключающие');
{
    assert(/throwBtn\.x = 624; throwBtn\.y = 541;/.test(src),
        'throwBtn на (624, 541) — confirmBtn делит с ней ровно то же место');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
