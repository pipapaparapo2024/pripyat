/**
 * Test: попап валюты (bank.atm, ТУШЕНКА/МОНЕТЫ/СИГАРЕТЫ) перекрывал нижний HUD, если
 * открывался кликом по иконке валюты в HUD (interface-panels.js) — bank.init() сам
 * добавляет popup в layer2_mc, но НЕ поднимает HUD поверх себя. sidorovich.js (другая
 * точка входа) всегда явно вызывал iface.restoreHud() сразу после bank.init() — оттуда и
 * взялось разное поведение между двумя путями открытия одного и того же попапа.
 *
 * Run: node tests/bank-currency-hud-restore.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'interface', 'interface-panels.js'), 'utf-8'
);

console.log('\nTest 1: клик по иконке валюты в HUD — restoreHud() вызывается сразу после bank.init()');
{
    const m = src.match(/this\.up\[key\]\.on\('pointerdown', \(\)=>\{([\s\S]*?)\n\s{16}\}\);/);
    assert(!!m, 'обработчик pointerdown для иконок валюты найден');
    if (m) {
        const body = m[1];
        assert(/if\(window\.bank\) bank\.init\(CURRENCY_INFO\[key\]\.key\);/.test(body), 'bank.init() вызывается');
        assert(/if\(window\.iface\) iface\.restoreHud\(\);/.test(body),
            'restoreHud() вызывается сразу после — HUD больше не перекрывается попапом');
    }
}

console.log('\nTest 2: кнопка банка в HUD (butt_bank) — тоже вызывает restoreHud() после bank.init()');
{
    const m = src.match(/this\.up\.butt_bank\.on\('pointerdown', \(\)=>\{([\s\S]*?)\n\s{8}\}\);/);
    assert(!!m, 'обработчик butt_bank найден');
    if (m) {
        const body = m[1];
        assert(/bank\.init\(\);/.test(body), 'bank.init() вызывается');
        assert(/if\(window\.iface\) iface\.restoreHud\(\);/.test(body), 'restoreHud() вызывается после');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
