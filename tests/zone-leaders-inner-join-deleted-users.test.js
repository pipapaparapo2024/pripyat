/**
 * Test: 26.09.2026, по прямому живому репорту со скриншотом — карточка "ОСОБО ОПАСЕН" в
 * рамке уважения локации продолжала показывать фото/уважение аккаунта, удалённого напрямую
 * из БД (административный сброс перед модерацией, минуя игровой resetMyRespectLeader(),
 * который чистит только СВОЮ запись при самостоятельном "СБРОС ВСЕГО").
 *
 * Причина: zone_respect_leader хранит user_id без FOREIGN KEY на users — прямое удаление
 * строки игрока не трогает эту таблицу вообще, рекорд остаётся сиротой и продолжает
 * резолвиться в интерфейсе как реальный игрок.
 *
 * Фикс: zone.leaders() теперь делает INNER JOIN с users — рекордсмен, чей аккаунт больше не
 * существует, просто не попадает в выдачу. Постоянный фикс на уровне запроса — не требует
 * помнить чистить эту таблицу вручную при каждом будущем удалении игрока.
 *
 * Run: node tests/zone-leaders-inner-join-deleted-users.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const zonePhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'zone.php'), 'utf-8');

console.log('\nTest 1: zone.leaders() делает INNER JOIN с users вместо голого SELECT из zone_respect_leader');
{
    const start = zonePhp.indexOf('function leaders(){');
    assert(start !== -1, 'leaders() найдена');
    const end = zonePhp.indexOf('\n        }', zonePhp.indexOf('output(', start));
    const body = zonePhp.slice(start, end);
    assert(!/SELECT `location_id`, `user_id`, `amount` FROM `zone_respect_leader`"\);/.test(body),
        'старый голый SELECT (без JOIN) убран — он отдавал сирот на удалённых игроков');
    assert(/INNER JOIN `\{\$this->registry\['utb'\]\}` u ON u\.`id` = z\.`user_id`/.test(body),
        'INNER JOIN с users по user_id — рекордсмен без реального аккаунта не попадает в выдачу');
    assert(/FROM `zone_respect_leader` z/.test(body), 'таблица рекордов используется с алиасом z (совместимо с JOIN)');
}

console.log('\nTest 2: поля результата (loc/id/amount) не изменились — клиент (zone_screen/bosses_select) не требует правок');
{
    const start = zonePhp.indexOf('function leaders(){');
    const end = zonePhp.indexOf('\n        }', zonePhp.indexOf('output(', start));
    const body = zonePhp.slice(start, end);
    assert(/\$out\[\] = \['loc' => intval\(\$row\['location_id'\]\), 'id' => intval\(\$row\['user_id'\]\), 'amount' => intval\(\$row\['amount'\]\)\];/.test(body),
        'формат строки результата (loc/id/amount) не тронут — тот же контракт для клиента');
}

console.log('\nTest 3: resetMyRespectLeader() (самостоятельный сброс через dev-панель) не тронут — остаётся для случая, когда игрок сбрасывает СВОЙ аккаунт сам');
{
    assert(/function resetMyRespectLeader\(\)\{/.test(zonePhp), 'resetMyRespectLeader() на месте — разные сценарии (самосброс vs админ-удаление), оба нужны');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
