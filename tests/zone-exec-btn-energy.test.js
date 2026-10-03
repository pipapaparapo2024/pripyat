/**
 * Test: кнопка "ВЫПОЛНИТЬ" в попапе локации (zone-popup.js) пропадала при нехватке
 * энергии на активную ячейку.
 *
 * Баг: _updateLocPopup() выставлял this._locExecActiv.visible = hasEnergy — если
 * энергии не хватало на стоимость активной ячейки (cp.cell_cost), кнопка исчезала
 * ПОЛНОСТЬЮ, будто прогресс захвата локации сломался. Ожидаемое поведение: кнопка
 * всегда видна, а нехватка энергии обрабатывается по клику — открытием попапа
 * покупки энергии (как и происходит везде в игре при нехватке ресурса).
 *
 * Заодно: клик по кнопке при нехватке энергии (_attack() в zone.js) открывал общий
 * попап ошибки (iface._openSidorovichError()) вместо покупки энергии
 * (iface._openEnergyPopup()) — тоже поправлено.
 *
 * Run: node tests/zone-exec-btn-energy.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const zonePopupSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'zone', 'zone-popup.js'), 'utf-8'
);
const zoneSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'zone.js'), 'utf-8'
);

// ── Test 1: кнопка ВЫПОЛНИТЬ больше не скрывается из-за нехватки энергии ──────
console.log('\nTest 1: _locExecActiv.visible всегда true, не зависит от hasEnergy');
{
    assert(!/this\._locExecActiv\.visible\s*=\s*hasEnergy/.test(zonePopupSrc),
        'больше не осталось "this._locExecActiv.visible = hasEnergy"');
    assert(/this\._locExecActiv\.visible\s*=\s*true;/.test(zonePopupSrc),
        'this._locExecActiv.visible выставлен в true безусловно');
}

// ── Test 2: недостающая переменная hasEnergy убрана целиком (не осталась мёртвым кодом) ──
console.log('\nTest 2: hasEnergy не вычисляется впустую (убран мёртвый код)');
{
    assert(!/const hasEnergy\s*=/.test(zonePopupSrc), 'объявление "const hasEnergy = ..." удалено');
}

// 17.09.2026 (позже этого батча, перенос Зоны на сервер): списание энергии (TIMERS.spendEnergy)
// переехало на сервер (zone.php.fillCheckpoint — финальное решение и списание там, читер не
// может подделать энергию консолью). Клиентская проверка стала READ-ONLY (TIMERS.getEnergy(),
// не spendEnergy()) — только для мгновенной обратной связи без похода на сервер; если к
// моменту ответа энергии внезапно не хватит (гонка), сервер сам откажет. Суть проверки та же:
// нехватка энергии открывает покупку энергии, а не общий попап ошибки.
console.log('\nTest 3: zone.js._attack() при нехватке энергии открывает iface._openEnergyPopup()');
{
    const m = zoneSrc.match(/_attack\(locIdx, cpIdx\)\{([\s\S]*?)\n    \}/);
    assert(!!m, '_attack() найден в zone.js');
    if (m) {
        const body = m[1];
        assert(/if\(TIMERS\.getEnergy\(\) < energyCost\)\{[\s\S]*?iface\._openEnergyPopup\(\);/.test(body),
            'при TIMERS.getEnergy() < energyCost вызывается iface._openEnergyPopup() (клиентская проверка — только для мгновенной обратной связи)');
        assert(!/if\(TIMERS\.getEnergy\(\) < energyCost\)\{[\s\S]{0,200}iface\._openSidorovichError\(\);/.test(body),
            'не вызывается общий iface._openSidorovichError() при нехватке энергии');
        assert(/TS\.php\('zone\.fillCheckpoint'/.test(body),
            'финальное решение и реальное списание энергии — на сервере (zone.php.fillCheckpoint)');
    }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
