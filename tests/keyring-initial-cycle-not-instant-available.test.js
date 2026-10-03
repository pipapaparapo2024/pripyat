/**
 * Test: 26.09.2026, по прямому репорту ("Связку ключей я выбил за первый прокрут, так
 * быть не должно") — подтверждено чтением живой таблицы roulette_state на сервере:
 * keyring_cycle_ends_at был создан со значением 0, а keyring_available вычисляется как
 * (keyring_cycle_ends_at <= time()) — то есть Связка была доступна СРАЗУ с момента запуска
 * фичи, без единого дня ожидания, хотя по ТЗ ожидание обязательно всегда, включая самый
 * первый цикл ("большую часть времени получить её невозможно").
 *
 * Фикс — обе миграции (migrate11.php/migrate11a.php, которые создают строку roulette_state
 * id=1, если её ещё нет) теперь стартуют с keyring_cycle_ends_at = time() + 30 дней вместо 0.
 * Сами миграции уже выполнены на живом сервере (строка существует), правка ничего не меняет
 * в текущей БД — это фикс на случай будущего чистого разворачивания проекта с нуля.
 *
 * Логика самой выдачи (_tryClaimKeyring — атомарный UPDATE ... WHERE keyring_cycle_ends_at
 * <= now, новый 30-дневный цикл после каждой выдачи) и исключение сектора №1 из честного
 * розыгрыша, пока Связка недоступна (_rollSlot) — уже были реализованы корректно и здесь не
 * менялись, регресс-гвард ниже это подтверждает.
 *
 * Run: node tests/keyring-initial-cycle-not-instant-available.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const m11  = fs.readFileSync(path.join(root, 'server', 'migrate11.php'), 'utf-8');
const m11a = fs.readFileSync(path.join(root, 'server', 'migrate11a.php'), 'utf-8');
const rouletteSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');

console.log('\nTest 1: migrate11.php — начальный keyring_cycle_ends_at = time()+30 дней, не 0');
{
    assert(/\$initialCycleEnd = time\(\) \+ 30\*24\*60\*60;/.test(m11), 'начальное значение цикла считается от time(), не хардкод 0');
    assert(/VALUES \(1, \$spinT, \$kushT, \$initialCycleEnd\)/.test(m11), 'INSERT использует новую переменную initialCycleEnd');
    assert(!/VALUES \(1, \$spinT, \$kushT, 0\);/.test(m11), 'старый хардкод 0 (доступна сразу) убран');
}

console.log('\nTest 2: migrate11a.php — тот же фикс (короткая версия той же миграции)');
{
    assert(/\$initialCycleEnd = time\(\) \+ 30\*24\*60\*60;/.test(m11a), 'начальное значение цикла считается от time(), не хардкод 0');
    assert(!/VALUES \(1, \$spinT, \$kushT, 0\)/.test(m11a), 'старый хардкод 0 (доступна сразу) убран');
}

console.log('\nTest 3: roulette.php — регресс-гвард (обновлено 28.09.2026)');
{
    // 28.09.2026 (по прямому указанию — "Связка ключей должна быть личной наградой, не одной
    // на весь сервер"): весь эксклюзивный 30-дневный цикл (единственный владелец на сервере,
    // атомарный UPDATE "кто первый — того и тапки") убран целиком — _tryClaimKeyring() теперь
    // просто выдаёт keyring_owner=1 текущему игроку через обычный loadUser()/saveUser(), без
    // претензии на эксклюзивность. Миграции (Test 1/2 выше) не трогали — они лишь заводят
    // историческую колонку keyring_cycle_ends_at, которая этим фиксом больше не читается для
    // решения о доступности (see $available = true в openMinigame()/spin()).
    assert(!/\$cycleEnd = \$now \+ 30\*24\*60\*60;/.test(rouletteSrc), '_tryClaimKeyring больше НЕ ставит эксклюзивный 30-дневный цикл');
    assert(/function _tryClaimKeyring\(\)\{[\s\S]{0,300}\$user\['keyring_owner'\] = 1;/.test(rouletteSrc),
        '_tryClaimKeyring() просто выдаёт keyring_owner=1 текущему игроку — без гонки за эксклюзивность');
    assert(/while\(\$idx === 12 \|\| \$idx === 0\)/.test(rouletteSrc), 'сектор №1 (idx=0) по-прежнему исключён из честного розыгрыша (не изменилось этой правкой)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
