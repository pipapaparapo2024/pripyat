/**
 * Test: репорт 23.09.2026 "ударил босса, начал помогать друг, но у босса в разы меньше HP,
 * чем должно быть" — разбор живого console-лога показал: суммарный урон в рейтинге
 * (Карначев 200 + свой 37 = 237) не сходился с реальным падением HP (1000 → 526 = -474).
 *
 * Корень: users.php.resetAllPlayers() ("СБРОС У ВСЕХ" в дев-панели) чистит boss_damage_log,
 * но НЕ трогал boss_instances (миграция 29, общий HP боевой сессии) — живой инстанс оставался
 * с уже подсевшим current_hp от урона ДО сброса, а вся история этого урона стиралась в ноль.
 * Дальше игроки бьют заново, их новый урон честно логируется — но current_hp всё ещё занижен
 * на весь "стёртый" старый урон, поэтому сумма в рейтинге не сходится с фактическим HP.
 *
 * Смежная дыра нашлась и в resetSession() (одиночный сброс аккаунта через dev-панель): свои
 * личные boss_damage_log/boss_instance_claims не чистились вовсе — "сброшенный" игрок мог
 * прийти на ещё живой общий инстанс, который бил до сброса, и либо получить fail 71 "награда
 * уже получена" за бой, которого для "нового" аккаунта как бы не было, либо засчитаться как
 * уже участвовавший по старым, davно неактуальным записям.
 *
 * Run: node tests/boss-instance-reset-cleanup.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const usersPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');

assert(!/function\s+resetAllPlayers\s*\(/.test(usersPhp), 'Массовый сброс удалён из контроллера');
assert(!/['"]resetAllPlayers['"]/.test(usersPhp), 'Маршрут массового сброса удалён из списка разрешённых');

console.log('\nTest 3: resetSession() (сброс ОДНОГО аккаунта) чистит свои boss_damage_log/boss_instance_claims по uid');
{
    const start = usersPhp.indexOf('function resetSession()');
    const end   = usersPhp.indexOf('function devGrantWeapons()', start);
    const body  = usersPhp.slice(start, end);
    assert(/DELETE FROM `boss_damage_log` WHERE `uid`=/.test(body), 'DELETE FROM boss_damage_log WHERE uid=... присутствует');
    assert(/DELETE FROM `boss_instance_claims` WHERE `uid`=/.test(body), 'DELETE FROM boss_instance_claims WHERE uid=... присутствует');
    assert(!/DELETE FROM `boss_instances`/.test(body), 'boss_instances НЕ трогается одиночным сбросом (общая для всех игроков сущность — её чистит только resetAllPlayers)');
    const uidDeclaredBeforeUse = body.indexOf('$uid = intval') !== -1
        && body.indexOf('$uid = intval') < body.indexOf('WHERE `uid`=');
    assert(uidDeclaredBeforeUse, '$uid объявлен и заполнен до использования в DELETE-запросах');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
