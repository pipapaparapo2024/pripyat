/**
 * Test: 28.09.2026, массовый живой репорт нескольких игроков в VK-чате проекта «Припять» —
 * "@all проверьте Энергию", "было 13 энергии после перезагрузки 0 стало", "как не зайду
 * 4 энергии", "накопало 5 энергии, зашёл, та же ошибка, данные устарели, обновилось энергии
 * 0 стало, лока не пройдена".
 *
 * Корень: `energy_time` (анкер регенерации, см. Gameops::energySnapshot()/spendEnergy() в
 * gameops.php и зеркальную клиентскую формулу Timers._regenSnapshot() в timers.js) пишется
 * ТОЛЬКО двумя местами — zone.php.fillCheckpoint() и base.php.train() (через spendEnergy()).
 * Для ЛЮБОГО аккаунта, который ещё ни разу не тратил энергию через эти два места (в том числе
 * ВСЕ аккаунты сразу после введения этой системы 28.09.2026, и любой аккаунт после сброса
 * дев-панелью — см. _defaultResetUdata() energy_time=>'0'), energy_time остаётся <= 0.
 * energySnapshot() при savedTime<=0 честно возвращает "анкер = сейчас", но НИЧЕГО не
 * сохраняет — тот же приём использует клиентский Timers.updateFromUdata() (эфемерно, только
 * для дисплея в рамках текущей сессии). Итог: энергия визуально тикает вверх в рамках ОДНОЙ
 * сессии (иллюзия регенерации от локального "анкер = момент открытия игры"), но эта база
 * никогда не долетает до udata['energy_time']/БД — следующая перезагрузка (users.get()) снова
 * видит СЫРОЕ, нерегенерированное значение и "энергия обнуляется" в восприятии игрока.
 *
 * Фикс: users.php.get() (единственная точка, которую проходит КАЖДЫЙ логин/перезаход) теперь
 * бутстрапит и СРАЗУ СОХРАНЯЕТ реальный анкер, если energy_time<=0 — один раз на аккаунт,
 * дальше обычная формула (клиент + spendEnergy()) работает как задумано. Заодно фикс отдельного,
 * но связанного бага: Users::__construct() никогда не инициализировал $this->ops (Gameops) —
 * devGrantShmot() уже вызывал $this->ops->loadUser() и падал бы фатально при любом вызове.
 *
 * Run: node tests/energy-time-bootstrap-on-login.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const usersPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const gameopsPhp = fs.readFileSync(path.join(root, 'server', 'core', 'models', 'gameops.php'), 'utf-8');

console.log('\nTest 1: Users::__construct() инициализирует $this->ops = new Gameops(...)');
{
    const ctorStart = usersPhp.indexOf('function __construct($registry){');
    const ctorEnd = usersPhp.indexOf('function get(){', ctorStart);
    const body = usersPhp.slice(ctorStart, ctorEnd);
    assert(/\$this->ops\s*=\s*new Gameops\(\$registry\);/.test(body),
        'конструктор создаёт $this->ops — без этого devGrantShmot() падал бы фатально на $this->ops->loadUser()');
    assert(/private \$registry, \$friends_top, \$ops;/.test(usersPhp),
        '$ops объявлен как свойство класса (иначе PHP 8.5 как минимум предупредит о динамическом свойстве)');
}

console.log('\nTest 2: get() бутстрапит energy_time, когда он <= 0, и СРАЗУ сохраняет анкер');
{
    const getStart = usersPhp.indexOf('function get(){');
    const getEnd = usersPhp.indexOf('function getProfile(){', getStart);
    assert(getStart > -1 && getEnd > getStart, 'функция get() найдена');
    const body = usersPhp.slice(getStart, getEnd);

    assert(/intval\(\$user\['energy_time'\] \?\? 0\) <= 0/.test(body),
        'проверяет именно energy_time<=0 (а не energy — бутстрап анкера, не самой валюты)');
    assert(/\$this->ops->energySnapshot\(\$user\)/.test(body),
        'использует ту же формулу энергии, что и spendEnergy() — единый источник истины');
    assert(/\$this->ops->saveUser\(\[.*'energy'.*'energy_time'.*\]\)/.test(body) ||
           /\$this->ops->saveUser\(\[.*'energy_time'.*'energy'.*\]\)/.test(body),
        'бутстрап СРАЗУ сохраняется в БД (не только в локальную переменную $user) — иначе бага повторится на каждой перезагрузке');

    // Бутстрап должен идти ДО финального refresh()/output(), чтобы игрок увидел уже
    // исправленное значение на этой же самой загрузке, не только со следующей.
    const bootstrapIdx = body.indexOf('energy_time');
    const outputIdx = body.indexOf("output(array('udata'");
    assert(bootstrapIdx > -1 && outputIdx > bootstrapIdx,
        'бутстрап применяется ДО отправки ответа игроку — виден сразу, не через один логин');
}

console.log('\nTest 3: energySnapshot() сама по себе по-прежнему НЕ сохраняет (регресс-гвард — не задваивать сохранение в двух местах)');
{
    const start = gameopsPhp.indexOf('function energySnapshot($user){');
    const end = gameopsPhp.indexOf('function spendEnergy(', start);
    const body = gameopsPhp.slice(start, end);
    assert(!/saveUser/.test(body), 'energySnapshot() остаётся чистым read-only расчётом — сохранение теперь явно в вызывающем коде (users.php.get())');
}

console.log('\nTest 4: spendEnergy() (zone/base) по-прежнему сам пишет energy_time — бутстрап в get() не подменяет, а дополняет этот путь');
{
    const start = gameopsPhp.indexOf('function spendEnergy(&$user, $amount){');
    assert(start > -1, 'spendEnergy() найден');
    const body = gameopsPhp.slice(start, start + 400);
    assert(/\$user\['energy_time'\]\s*=\s*\$baseTime;/.test(body), 'spendEnergy() всё ещё сам пишет energy_time при реальной трате');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
