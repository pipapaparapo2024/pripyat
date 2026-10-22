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
 * 21.10.2026 (по прямому указанию — "предплечье всегда одно, кисть меняется", см.
 * ПЕРЕИМЕНОВАНИЕ_АССЕТОВ_21_10_2026.md): "фаланги правой руки.png" заменены на полную кисть
 * ("кисть расслабленная.png"/"кисть хват.png", переменная переименована в rightHandSpr/
 * rightHandPhalanxSpr → rightHandSpr), "правая рука.png" (x:630,y:369) — на статичное
 * предплечье (rightForearmSpr, "предплечье правое.png"). Координаты/z-order не менялись,
 * обновлены только имена переменных/файлов в этом тесте.
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

console.log('\nTest 1: home.js — предплечье правой руки (22.10.2026, повторная калибровка: 630→649→642, 369→377→375)');
{
    assert(/this\._rightForearmSpr\.x = 642;/.test(homeSrc), 'x = 642');
    assert(/this\._rightForearmSpr\.y = 375;/.test(homeSrc), 'y = 375');
}

console.log('\nTest 2: hata.js ("База") — кисть добавлена со своим x/y/scale под дефолтную текстуру (22.10.2026, редактор позиций)');
{
    assert(/PIXI\.Texture\.from\('\.\/images\/кисть расслабленная\.png'\)/.test(hataSrc), 'использует ассет кисти по умолчанию');
    assert(/rightHandSpr\.x = 642;/.test(hataSrc), 'x = 642 (позиция "расслабленная.png", то же, что на home.js)');
    assert(/rightHandSpr\.y = 427;/.test(hataSrc), 'y = 427 (позиция "расслабленная.png")');
    const m = hataSrc.match(/CHAR_SLOTS\.forEach\(s => \{([\s\S]*?)\n        \}\);/);
    assert(!!m, 'CHAR_SLOTS.forEach блок найден');
    if (m) {
        assert(/if\(s\.cat === 6\) win\.addChild\(rightHandSpr\);/.test(m[1]),
            'кисть добавляется перед слотом cat:6 (предмет в руке ляжет поверх пальцев)');
    }
}

console.log('\nTest 3: shmot_shop.js (манекен "Шмотки") — кисть добавлена со своими координатами (22.10.2026, редактор позиций — не формула +224/+4)');
{
    assert(/PIXI\.Texture\.from\('\.\/images\/кисть расслабленная\.png'\)/.test(shopSrc), 'использует ассет кисти по умолчанию');
    assert(/rightHandSpr\.x = 866;/.test(shopSrc), 'x = 866 (позиция "расслабленная.png" на манекене магазина)');
    assert(/rightHandSpr\.y = 431;/.test(shopSrc), 'y = 431');
    const m = shopSrc.match(/MAN_SLOTS\.forEach\(s => \{([\s\S]*?)\n        \}\);/);
    assert(!!m, 'MAN_SLOTS.forEach блок найден');
    if (m) {
        assert(/if\(s\.cat === 6\) win\.addChild\(rightHandSpr\);/.test(m[1]),
            'кисть добавляется перед слотом cat:6 (предмет в руке ляжет поверх пальцев)');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
