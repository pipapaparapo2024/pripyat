/**
 * Test: "фаланги правой руки.png" раньше рисовались ТОЛЬКО на главном меню (home.js) —
 * на вкладке "База" (hata.js) и на манекене в "Шмотках" (shmot_shop.js) персонаж
 * рисуется ОТДЕЛЬНЫМ, независимым кодом (свой набор спрайтов), поэтому фаланги там
 * не появлялись вовсе. Добавлены на оба экрана по той же логике z-order (фаланги —
 * перед добавлением слота cat:6, чтобы предмет в руке лёг поверх пальцев).
 *
 * Также: right-hand спрайт на главном меню сдвинут на 1px (631→630) для согласованности
 * с hata.js, где то же значение уже было 630 (по прямой правке из скриншота редактора).
 *
 * Run: node tests/phalanx-hata-shmot-shop.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const homeSrc  = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'home.js'), 'utf-8');
const hataSrc  = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), 'utf-8');
const shopSrc  = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), 'utf-8');

console.log('\nTest 1: home.js — правая рука сдвинута на 1px (631 → 630) для согласованности с hata.js');
{
    assert(/this\._rightHandSpr\.x = 630;/.test(homeSrc), 'x = 630 (было 631)');
    assert(/this\._rightHandSpr\.y = 369;/.test(homeSrc), 'y = 369 не тронут');
}

console.log('\nTest 2: hata.js ("База") — фаланги добавлены с теми же координатами, что на главном меню');
{
    assert(/PIXI\.Texture\.from\('\.\/images\/фаланги правой руки\.png'\)/.test(hataSrc), 'использует тот же ассет фаланг');
    assert(/rightHandPhalanxSpr\.x = 634;/.test(hataSrc), 'x = 634 (то же, что на home.js)');
    assert(/rightHandPhalanxSpr\.y = 441;/.test(hataSrc), 'y = 441 (то же, что на home.js)');
    const m = hataSrc.match(/CHAR_SLOTS\.forEach\(s => \{([\s\S]*?)\n        \}\);/);
    assert(!!m, 'CHAR_SLOTS.forEach блок найден');
    if (m) {
        assert(/if\(s\.cat === 6\) win\.addChild\(rightHandPhalanxSpr\);/.test(m[1]),
            'фаланги добавляются перед слотом cat:6 (предмет в руке ляжет поверх пальцев)');
    }
}

console.log('\nTest 3: shmot_shop.js (манекен "Шмотки") — фаланги добавлены с пересчитанными координатами (+224/+4)');
{
    assert(/PIXI\.Texture\.from\('\.\/images\/фаланги правой руки\.png'\)/.test(shopSrc), 'использует тот же ассет фаланг');
    assert(/rightHandPhalanxSpr\.x = 858;/.test(shopSrc), 'x = 858 (634 + 224, тот же сдвиг, что у всех MAN_SLOTS)');
    assert(/rightHandPhalanxSpr\.y = 445;/.test(shopSrc), 'y = 445 (441 + 4)');
    const m = shopSrc.match(/MAN_SLOTS\.forEach\(s => \{([\s\S]*?)\n        \}\);/);
    assert(!!m, 'MAN_SLOTS.forEach блок найден');
    if (m) {
        assert(/if\(s\.cat === 6\) win\.addChild\(rightHandPhalanxSpr\);/.test(m[1]),
            'фаланги добавляются перед слотом cat:6 (предмет в руке ляжет поверх пальцев)');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
