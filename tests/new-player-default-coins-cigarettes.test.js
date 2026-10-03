/**
 * Test: 27.09.2026 — "новый игрок не получает дефолтные значения 10 рублей и 1000 сигарет".
 *
 * Причина: единственное место, где реально создаётся строка НОВОГО игрока —
 * Users::get() в server/core/controllers/users.php (ветка isset($user['error']) — первый
 * заход, строки в БД ещё нет). Массив $user_arr, который уходит в Database::saveData()
 * (INSERT ... ON DUPLICATE KEY UPDATE), никогда не выставлял coins/cigarettes явно —
 * значения молча брались из DEFAULT колонки в БД (там '0', не '10'/'1000' по ТЗ). При этом
 * users.php._defaultResetUdata() (используется только users.resetSession/resetAllPlayers —
 * сброс аккаунта, не создание нового) уже содержал верные coins=>'10', cigarettes=>'1000',
 * поэтому баг был незаметен на сброшенных тестовых аккаунтах, но проявлялся у КАЖДОГО
 * реально нового игрока.
 *
 * Фикс: явно добавлены 'coins'=>10, 'cigarettes'=>1000 в $user_arr — только для ВНОВЬ
 * создаваемой строки, существующих игроков эта ветка кода не затрагивает (условие
 * isset($user['error']) истинно только когда строки с этим id ещё нет в БД).
 *
 * Run: node tests/new-player-default-coins-cigarettes.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const usersSrc = readSrc('server/core/controllers/users.php');

console.log('\nTest 1: Users::get() — ветка создания НОВОГО игрока выставляет coins/cigarettes по ТЗ');
{
    const start = usersSrc.indexOf("function get(){");
    const end   = usersSrc.indexOf('$user = $this->setFriends($user);');
    const body  = usersSrc.slice(start, end);

    // Именно в блоке создания нового игрока (внутри if(isset($user['error']) ...)),
    // не где-то ещё в файле (например, в _defaultResetUdata()).
    const arrStart = body.indexOf('$user_arr = array(');
    const arrEnd   = body.indexOf(');', arrStart);
    const userArr  = body.slice(arrStart, arrEnd);

    assert(arrStart !== -1, '$user_arr (создание нового игрока) найден внутри get()');
    assert(/'coins'\s*=>\s*10\b/.test(userArr), "новый игрок получает 'coins'=>10 при создании аккаунта");
    assert(/'cigarettes'\s*=>\s*1000\b/.test(userArr), "новый игрок получает 'cigarettes'=>1000 при создании аккаунта");

    // saveData() должен реально уйти с этими полями — проверяем, что $user_arr передаётся
    // в saveData сразу после объявления (не теряется/не переопределяется по пути).
    const afterArr = body.slice(arrEnd, arrEnd + 300);
    assert(/saveData\(\$this->registry\['utb'\], \$user_arr\)/.test(afterArr),
        '$user_arr с coins/cigarettes уходит в Database::saveData() (INSERT нового игрока)');
}

console.log('\nTest 2: _defaultResetUdata() (сброс аккаунта, НЕ создание нового) по-прежнему содержит те же значения — не регрессировал заодно');
{
    // 27.09.2026 (фикс собственного теста, найден при полном прогоне tests/ перед деплоем):
    // 'boss_fight_session' встречается в файле РАНЬШЕ, чем начинается сама _defaultResetUdata()
    // (это служебное поле упоминается выше по файлу) — indexOf находил "}" задолго до функции,
    // end оказывался МЕНЬШЕ start, .slice(start, end) с end<start даёт '' — ложный FAIL на
    // полностью корректном коде. Ищем конец через 'boss_fight_session', но начиная поиск
    // ПОСЛЕ start, а не с начала файла.
    const start = usersSrc.indexOf('private function _defaultResetUdata(){');
    const end   = usersSrc.indexOf('}', usersSrc.indexOf('boss_fight_session', start));
    const body  = usersSrc.slice(start, end);

    assert(/'coins'=>'10'/.test(body), "_defaultResetUdata() содержит coins=>'10'");
    assert(/'cigarettes'=>'1000'/.test(body), "_defaultResetUdata() содержит cigarettes=>'1000'");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
