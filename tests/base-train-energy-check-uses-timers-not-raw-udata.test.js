/**
 * Test: 28.09.2026, продолжение аудита энергии по прямой просьбе — "проверь клиентскую
 * (визуальную) часть отдельно от серверной".
 *
 * Найдено: base.js._trainStat() (качалка) проверял хватает ли энергии по СЫРОМУ
 * udata['energy'] — значению, реально сохранённому в БД на момент последней загрузки, БЕЗ
 * учёта регенерации, накопленной с тех пор. HUD (interface.js.updateEnergy()) и
 * zone.js._attack() тем временем уже читают/показывают TIMERS.getEnergy() — регенерированное
 * значение (см. Timers._regenSnapshot() в _client/src/modules/timers.js). Расхождение:
 * игрок видит в HUD, например, 13/50 энергии, жмёт "ТРЕНИРОВАТЬ" — и получает
 * "Недостаточно энергии!", хотя по показанному числу энергии хватает с запасом.
 *
 * Фикс — тот же паттерн, что уже используют bot.js/dev_panel.js: TIMERS.getEnergy() с
 * фолбэком на udata['energy'], если TIMERS почему-то ещё не создан.
 *
 * Run: node tests/base-train-energy-check-uses-timers-not-raw-udata.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game');
const baseJs = fs.readFileSync(path.join(root, 'base.js'), 'utf-8');
const zoneJs = fs.readFileSync(path.join(root, 'zone.js'), 'utf-8');
const botJs = fs.readFileSync(path.join(root, 'bot.js'), 'utf-8');

console.log('\nTest 1: base.js._trainStat() проверяет энергию через TIMERS.getEnergy(), не сырой udata[\'energy\']');
{
    const start = baseJs.indexOf('_trainStat(idx){');
    const end = baseJs.indexOf('_renderLocations(){', start);
    const body = baseJs.slice(start, end);
    assert(/const energy = window\.TIMERS \? TIMERS\.getEnergy\(\) : parseInt\(udata\['energy'\]\|\|0\);/.test(body),
        'использует TIMERS.getEnergy() (регенерированное значение) с фолбэком на udata, как bot.js/dev_panel.js');
    assert(!/const energy = parseInt\(udata\['energy'\]\|\|0\);/.test(body),
        'больше не читает СЫРОЕ udata[\'energy\'] напрямую, минуя регенерацию');
}

console.log('\nTest 2: регресс-гвард — zone.js._attack() уже делал это правильно (сверка, что паттерн не сломан заодно)');
{
    assert(/TIMERS\.getEnergy\(\) < energyCost/.test(zoneJs),
        'zone.js по-прежнему проверяет энергию через TIMERS.getEnergy(), как и раньше');
}

console.log('\nTest 3: регресс-гвард — bot.js (образец паттерна) не тронут этим фиксом');
{
    assert(/const energy = window\.TIMERS \? TIMERS\.getEnergy\(\) : parseInt\(udata\['energy'\]\|\|0\);/.test(botJs),
        'bot.js — исходный образец паттерна TIMERS-с-фолбэком, использованный при фиксе base.js, остаётся как был');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
