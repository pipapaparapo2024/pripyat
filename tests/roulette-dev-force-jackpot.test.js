/**
 * Test: батч 25.09.2026 (по прямому указанию — "вместо демки стаканчиков сделай 100% шанс
 * джекпота для теста, записывать в БД не нужно") —
 *
 * Личный ОДНОРАЗОВЫЙ dev-флаг (dev_force_jackpot), тот же паттерн, что уже есть у
 * dev_force_drops (users.php.setDevFlag()). Форсирует джекпот ТОЛЬКО для следующего
 * roulette.spin() ЭТОГО игрока, сам гасится сразу после использования, и — важно — НЕ
 * трогает общий счётчик/порог/пул джекпота в roulette_state (это реальный прогресс всех
 * остальных игроков, форсировать его ради теста одного аккаунта нельзя).
 *
 * Run: node tests/roulette-dev-force-jackpot.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const roulettePhp = read('server/core/controllers/roulette.php');
const usersPhp     = read('server/core/controllers/users.php');
const devPanelJs   = read('_client/src/game/shell/overlays/dev_panel.js');
const migrate29     = read('server/migrate29.php');

console.log('\n1) users.php.setDevFlag() — dev_force_jackpot добавлен в whitelist разрешённых dev-флагов');
{
    assert(/\$allowedFlags = \['dev_force_drops', 'dev_force_jackpot'\];/.test(usersPhp),
        "'dev_force_jackpot' добавлен рядом с уже существующим 'dev_force_drops'");
}

console.log('\n2) users.php — dev_force_jackpot гасится и при resetSession(), и при resetAllPlayers()');
{
    assert(/'dev_force_jackpot'\s*=>\s*0,/.test(usersPhp), "resetSession(): 'dev_force_jackpot' => 0 присутствует");
    assert(/'dev_force_jackpot'=>'0'/.test(usersPhp), "resetAllPlayers(): 'dev_force_jackpot'=>'0' присутствует");
}

console.log('\n3) roulette.php.spin() — читает и сразу гасит личный флаг ДО решения о джекпоте');
{
    const start = roulettePhp.indexOf('function spin(){');
    const end   = roulettePhp.indexOf('\n    // Выбирает slotIdx');
    const body  = roulettePhp.slice(start, end);

    assert(/\$devForceJackpot = \$this->ops->i\(\$user, 'dev_force_jackpot'\) > 0;/.test(body),
        'читает dev_force_jackpot через Gameops::i() (сервер-only поле, не whitelist)');
    assert(/if\(\$devForceJackpot\) \$user\['dev_force_jackpot'\] = 0;/.test(body),
        'гасит флаг сразу после чтения — одноразовый, не остаётся включённым навсегда');
    // 26.09.2026 (дев-форс конкретного слота рулетки, тот же батч): условие расширено ещё на
    // ($devForceIdx === 12) — форс именно джекпотного слота тоже должен считаться джекпотом.
    assert(/\$jackpot = \$realJackpot \|\| \$devForceJackpot \|\| \(\$devForceIdx === 12\);/.test(body),
        'итоговый $jackpot учитывает реальный счётчик, dev-форс джекпота и dev-форс слота 12');
}

console.log('\n4) roulette.php.spin() — dev-форс НЕ трогает общий счётчик/порог/пул (реальный прогресс других игроков)');
{
    const start = roulettePhp.indexOf('function spin(){');
    const end   = roulettePhp.indexOf('\n    // Выбирает slotIdx');
    const body  = roulettePhp.slice(start, end);

    assert(/if\(\$realJackpot\)\{/.test(body), 'сброс spin_counter/spin_threshold/jackpot_pool завёрнут в if($realJackpot) — НЕ в if($jackpot)');
    assert(!/if\(\$jackpot\)\{\s*\n\s*\$newThreshold/.test(body), 'блок сброса общего состояния больше не выполняется по условию $jackpot целиком (только по $realJackpot)');
}

console.log('\n5) roulette.php.spin() — ветка "нет соединения к общей таблице" тоже уважает dev-форс');
{
    const start = roulettePhp.indexOf('if(!$link){');
    const end   = roulettePhp.indexOf('\n        }', start);
    const body  = roulettePhp.slice(start, end);
    // 25.09.2026 (дев-форс комбинаций казино, другая сессия): вызов получил 5-й аргумент
    // $devForceIdx (форс конкретного слота, независимо от форса джекпота).
    assert(/\$this->_rollSlot\(\$devForceJackpot, false, \$user, \$slotTrace, \$devForceIdx\);/.test(body),
        '_rollSlot() получает $devForceJackpot вместо жёсткого false — форс работает даже без подключения к roulette_state');
    // 26.09.2026: расширено на slotIdx===12 (форс именно джекпотного слота), та же причина,
    // что и в разделе 3) выше.
    assert(/'jackpot' => \(\$devForceJackpot \|\| \$slotResult\['slotIdx'\] === 12\),/.test(body),
        "ответ содержит 'jackpot' => (\$devForceJackpot || slotIdx===12) (было жёстко false)");
}

console.log('\n6) dev_panel.js — кнопка вызывает users.setDevFlag с dev_force_jackpot=1, старая демо-кнопка "Стаканчики" убрана');
{
    assert(/proto\._forceNextJackpot = function\(\)\{/.test(devPanelJs), '_forceNextJackpot определён');
    assert(/TS\.php\('users\.setDevFlag', \{flag: 'dev_force_jackpot', value: 1\}/.test(devPanelJs),
        'вызывает users.setDevFlag с правильным флагом и value:1');
    assert(!/this\._openSuperGame\(\)/.test(devPanelJs), 'старый вызов _openSuperGame() (демо-стаканчики) убран из dev-панели');
    assert(/100% НА СЛЕД\. СПИН/.test(devPanelJs), 'новая кнопка подписана понятно');
}

console.log('\n7) Миграция 29 — добавляет колонку dev_force_jackpot, идемпотентна (SHOW COLUMNS проверка)');
{
    assert(/dev_force_jackpot/.test(migrate29), 'миграция ссылается на dev_force_jackpot');
    assert(/TINYINT\(1\) NOT NULL DEFAULT 0/.test(migrate29), 'тип колонки — TINYINT(1) DEFAULT 0, тот же, что у dev_force_drops');
    assert(/SHOW COLUMNS FROM/.test(migrate29), 'проверяет существование колонки перед ALTER TABLE (безопасно перезапускать)');
    assert(/stalker_migrate29_2026/.test(migrate29), 'защищена секретным ключом в query-параметре');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
