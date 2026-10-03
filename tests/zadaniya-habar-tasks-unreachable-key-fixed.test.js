/**
 * Test: 28.09.2026, по прямому указанию — продолжение аудита жалобы "с хабара не выдаются
 * поинты" (см. tests/habar-open-dead-code-removed.test.js).
 *
 * Находка: задания «Хабарщик» (tasks_pool.json), «Рубеж: Собиратель» (tasks_pool.json),
 * «Отправить 5/10 заначек» (zadaniya_config.json, id habar_5/habar_10) и «Коллекционер»
 * (оба файла, id w_collector в zadaniya_config.json) все проверяли ключ 'habar_opened' —
 * счётчик, который рос ТОЛЬКО внутри Habar::open(), а этот метод был недостижимым мёртвым
 * кодом (client habar.js никогда не вызывал permit 'open', см. соседний тест). Значит
 * habar_opened у ЛЮБОГО игрока всегда 0, и ни одно из этих заданий не могло быть выполнено
 * никогда, никаким реальным действием в игре — независимо от сегодняшней чистки.
 *
 * Фикс (по прямому указанию — "переключи на habar_days_collected"): у всех задач,
 * проверявших habar_opened, ключ заменён на habar_days_collected — реальный, растущий
 * счётчик (habar.php.collectDay(), см. server/json/habar_daily_config.json, максимум 30 —
 * все пороги задач 1/5/7/10 внутри этого диапазона, значит теперь реально достижимы).
 * tasks.php._statValue()/Tasks::claim() читают ключ задания дженерик-геттером
 * (Gameops::i($user,$key)) — замена значения ключа в конфиге не требует правок кода.
 *
 * Run: node tests/zadaniya-habar-tasks-unreachable-key-fixed.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readJson(rel){ return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf-8')); }

const tasksPool = readJson('server/json/tasks_pool.json');
const zadaniya  = readJson('server/json/zadaniya_config.json');
const habarDaily = readJson('server/json/habar_daily_config.json');

function findByName(list, name){ return list.find(t => t.name === name); }
function findById(list, id){ return list.find(t => t.id === id); }

console.log('\nTest 1: tasks_pool.json — ни одно задание больше не проверяет мёртвый habar_opened');
{
    const allTasks = [...tasksPool.daily, ...tasksPool.weekly, ...tasksPool.special];
    assert(!allTasks.some(t => t.key === 'habar_opened'), 'ни одно задание в tasks_pool.json не ссылается на habar_opened');

    const habarschik = findByName(tasksPool.daily, 'Хабарщик');
    assert(!!habarschik && habarschik.key === 'habar_days_collected' && habarschik.need === 1,
        '"Хабарщик" переключён на habar_days_collected, need не менялся (1)');

    const sobiratel = findByName(tasksPool.daily, 'Рубеж: Собиратель');
    assert(!!sobiratel && sobiratel.key === 'habar_days_collected' && sobiratel.need === 7,
        '"Рубеж: Собиратель" переключён на habar_days_collected, need не менялся (7)');

    const kollekcioner = findByName(tasksPool.weekly, 'Коллекционер');
    assert(!!kollekcioner && kollekcioner.key === 'habar_days_collected' && kollekcioner.need === 5,
        '"Коллекционер" (tasks_pool.json) переключён на habar_days_collected, need не менялся (5)');
}

console.log('\nTest 2: zadaniya_config.json — ни одно задание больше не проверяет мёртвый habar_opened');
{
    const allTasks = [...zadaniya.daily, ...zadaniya.weekly, ...zadaniya.special];
    assert(!allTasks.some(t => t.key === 'habar_opened'), 'ни одно задание в zadaniya_config.json не ссылается на habar_opened');

    const habar5 = findById(zadaniya.daily, 'habar_5');
    assert(!!habar5 && habar5.key === 'habar_days_collected' && habar5.need === 5,
        'habar_5 переключён на habar_days_collected, need не менялся (5)');

    const habar10 = findById(zadaniya.daily, 'habar_10');
    assert(!!habar10 && habar10.key === 'habar_days_collected' && habar10.need === 10,
        'habar_10 переключён на habar_days_collected, need не менялся (10)');

    const wCollector = findById(zadaniya.weekly, 'w_collector');
    assert(!!wCollector && wCollector.key === 'habar_days_collected' && wCollector.need === 5,
        'w_collector переключён на habar_days_collected, need не менялся (5)');
}

console.log('\nTest 3: пороги задач (1/5/7/10) реально достижимы — habar_days_collected растёт до 30');
{
    assert(typeof habarDaily.total_days === 'number' && habarDaily.total_days === 30,
        'habar_daily_config.json.total_days = 30 — максимум, до которого может дорасти habar_days_collected');
    const allNeeds = [
        ...tasksPool.daily.filter(t => t.key === 'habar_days_collected'),
        ...tasksPool.weekly.filter(t => t.key === 'habar_days_collected'),
        ...zadaniya.daily.filter(t => t.key === 'habar_days_collected'),
        ...zadaniya.weekly.filter(t => t.key === 'habar_days_collected'),
    ].map(t => t.need);
    assert(allNeeds.length === 6, 'найдены все 6 задач, переключённых на habar_days_collected (3 в tasks_pool.json + 3 в zadaniya_config.json)');
    assert(allNeeds.every(n => n <= habarDaily.total_days),
        'все пороги (' + allNeeds.join(', ') + ') не превышают 30 — задачи реально выполнимы за месяц ежедневного сбора хабара');
}

console.log('\nTest 4: habar_days_collected — реальный писатель есть (habar.php.collectDay()), habar_opened больше никем не пишется');
{
    const habarPhp = fs.readFileSync(path.join(root, 'server/core/controllers/habar.php'), 'utf-8');
    assert(/\$user\['habar_days_collected'\]\s*=\s*\$collected \+ 1;/.test(habarPhp),
        'habar.php.collectDay() реально инкрементирует habar_days_collected при каждом сборе — задачи теперь двигаются вместе с игровым прогрессом');
    assert(!/habar_opened/.test(habarPhp), 'habar.php больше нигде не упоминает habar_opened (мёртвое поле, писателя не осталось)');
}

console.log('\nTest 5: tasks.php читает key заданий дженерик-геттером — замена значения в конфиге не требует правок кода контроллера');
{
    const tasksPhp = fs.readFileSync(path.join(root, 'server/core/controllers/tasks.php'), 'utf-8');
    assert(/private function _statValue\(\$user, \$key\)\{\s*return \$this->ops->i\(\$user, \$key, 0\);\s*\}/.test(tasksPhp),
        '_statValue() читает любое поле $user по ключу из конфига (Gameops::i) — не хардкодит имена задач');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
