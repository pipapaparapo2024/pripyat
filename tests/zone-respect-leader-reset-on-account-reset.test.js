/**
 * Test: 26.09.2026, по прямому репорту — "при сбросе своего аккаунта почему-то я остался в
 * рамке локации как человек, у которого больше всего уважения за прохождение локаций".
 *
 * Причина: zone_respect_leader — ГЛОБАЛЬНАЯ таблица рекордов (location_id PK, кто набрал
 * максимум уважения в локации за всё время), физически отдельная от users.respect (прямое
 * подключение через zone.php._rawLink(), не через udb/utb). Обычный "СБРОС ВСЕГО" в
 * dev_panel.js (users.save по whitelist + users.resetSession по server-only игровым сессиям)
 * никак её не касался — respect обнулялся в users, а рекорд "кто держит рамку" в отдельной
 * таблице оставался прежним навсегда.
 *
 * Фикс: новый метод zone.php.resetMyRespectLeader() — DELETE своих строк из
 * zone_respect_leader (не трогает чужие рекорды), вызывается из dev_panel.js._resetAccount()
 * дополнительно к обычному сбросу.
 *
 * Run: node tests/zone-respect-leader-reset-on-account-reset.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const zonePhp    = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'zone.php'), 'utf-8');
const devPanel   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');

console.log('\nTest 1: zone.php — resetMyRespectLeader() зарегистрирован в permits и удаляет только свои записи');
{
    assert(/\$this->permits = \[[^\]]*'resetMyRespectLeader'[^\]]*\];/.test(zonePhp),
        "'resetMyRespectLeader' добавлен в whitelist permits");

    const start = zonePhp.indexOf('function resetMyRespectLeader()');
    assert(start !== -1, 'метод resetMyRespectLeader() найден');
    const end  = zonePhp.indexOf('\n        }', start);
    const body = zonePhp.slice(start, end);

    assert(/DELETE FROM `zone_respect_leader` WHERE `user_id` = \$uid/.test(body),
        'DELETE ограничен WHERE user_id = $uid — удаляет только свои строки, не чужие рекорды');
    assert(/\$uid = intval\(\$this->registry\['uid'\]\);/.test(body),
        'uid берётся из серверного registry (не из параметров клиента) — нельзя удалить чужой рекорд подделкой запроса');
}

console.log('\nTest 2: dev_panel.js._resetAccount() вызывает zone.resetMyRespectLeader() при полном сбросе');
{
    const start = devPanel.indexOf('proto._resetAccount = function()');
    const end   = devPanel.indexOf('\n    };', start);
    const body  = devPanel.slice(start, end);
    assert(/TS\.php\('zone\.resetMyRespectLeader', \{\}/.test(body),
        '_resetAccount() шлёт zone.resetMyRespectLeader на сервер');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
