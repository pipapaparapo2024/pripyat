/**
 * Test: 26.09.2026, по прямому указанию (скриншот попапа покупки поинтов — битая
 * жёлто-чёрная текстура поверх карточки "550") — "убери с попапа покупки красных и синих
 * поинтов иконки рублей".
 *
 * dvor-dice-screen.js (красные поинты, зарики) и dvor-roulette-buy.js (синие поинты,
 * рулетка) поверх КАЖДОЙ карточки пакета рисовали лишнюю оверлей-иконку "монеты эмблема.png"
 * — сама карточка (pkg.img) уже содержит готовую нарисованную художником цену/валюту,
 * отдельная иконка была избыточной и минимум на одной карточке рендерилась битой текстурой.
 * Убрана в обоих файлах целиком.
 *
 * Run: node tests/remove-coin-icon-overlay-points-buy-screens.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const diceSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice-screen.js'), 'utf-8');
const roulSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-buy.js'), 'utf-8');

console.log('\nTest 1: dvor-dice-screen.js — иконка "монеты эмблема.png" убрана из попапа покупки поинтов');
{
    assert(!/монеты эмблема\.png/.test(diceSrc), 'ссылка на "монеты эмблема.png" не встречается в файле');
    assert(!/const coinSpr = new PIXI\.Sprite/.test(diceSrc), 'переменная coinSpr (оверлей-иконка) удалена');
    assert(/PKGS\.forEach\(\(pkg, idx\)=>\{/.test(diceSrc), 'сам цикл отрисовки карточек пакетов сохранён');
}

console.log('\nTest 2: dvor-roulette-buy.js — та же иконка убрана из попапа покупки синих поинтов');
{
    assert(!/монеты эмблема\.png/.test(roulSrc), 'ссылка на "монеты эмблема.png" не встречается в файле');
    assert(!/const coinSpr_r = new PIXI\.Sprite/.test(roulSrc), 'переменная coinSpr_r (оверлей-иконка) удалена');
    assert(/ROUL_PKGS\.forEach\(\(pkg, idx\)=>\{/.test(roulSrc), 'сам цикл отрисовки карточек пакетов сохранён');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
