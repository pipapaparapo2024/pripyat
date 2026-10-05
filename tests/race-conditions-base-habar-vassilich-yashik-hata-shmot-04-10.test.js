/**
 * Test: 04.10.2026, продолжение аудита гонок состояний (lost update) с того же вечера, что
 * tests/race-conditions-skills-weapons-ryukzak-casino-04-10.test.js. Фоновый Explore-аудит нашёл
 * тот же архитектурный риск (loadUser() → мутация нескольких полей в памяти → saveUser(), без
 * SELECT...FOR UPDATE) ещё в 12 активных контроллерах; этот файл закрывает 6 из них —
 * приоритетные 5 (habar.php/vassilich.php/yashik.php/hata.php/shmot.php, реально в проде/тесте,
 * дают RNG/экономику) + base.php (эталонный пример эксплойта из самого отчёта: "два клика
 * upgrade() могут оба прочитать coins=1000, оба списать ЛОКАЛЬНО, здание улучшилось дважды по
 * цене одного").
 *
 * Техника фикса — НЕ буквально та же, что в bosses.php/weapons.php/skills.php/ryukzak.php (там
 * обычно лочилось 1-2 общих между файлами поля через точечный SELECT/UPDATE на КОНКРЕТНОЙ
 * колонке), а обобщение того же физического приёма на функции, которые за один вызов мутируют
 * СРАЗУ МНОГО полей (валюта + счётчики + JSON-блобы): вся бизнес-логика (проверки + подсчёт
 * итоговых значений) ведётся на ОТДЕЛЬНОЙ копии `$lockedUser`, заполненной АКТУАЛЬНЫМИ
 * значениями всех нужных колонок под ОДНИМ SELECT...FOR UPDATE (та же физическая блокировка
 * строки — ЛЮБАЯ FOR UPDATE транзакция на ней, из ЛЮБОГО файла, реально ждёт COMMIT другой), а
 * итог пишется ОДНИМ UPDATE с перечнем всех залоченных колонок. $user[поле] для этих колонок
 * остаётся НЕТРОНУТЫМ до saveUser() (чтобы Database::saveData()/validateChanges() не перезаписал
 * только что закоммиченное устаревшим снимком loadUser()) — двухветочный контракт присвоения тот
 * же, что уже документирован для bosses.php/weapons.php: лок удался → переносим в $user ПОСЛЕ
 * saveUser(); лок не удался (нет соединения) → переносим ДО saveUser(), иначе результат
 * вообще нигде не сохранится (баг, уже найденный и исправленный 04.10.2026 в первом проходе).
 *
 * Самый серьёзный найденный риск — yashik.php.collect(): без лока два параллельных клика могли
 * прочитать ОДНУ И ТУ ЖЕ отложенную yashik_session и оба её начислить — двойная награда за один
 * открытый ящик, не просто потерянное списание.
 *
 * Структурные (regex) тесты, не нагрузочные — см. объяснение в docblock-е соседнего файла
 * (race-conditions-skills-weapons-ryukzak-casino-04-10.test.js) почему реальная конкурентность
 * не воспроизводима в этом харнессе без живой БД. Задача — поймать регрессию (кто-то убере лок
 * или вернёт присвоение в неверную ветку при рефакторинге), а не доказать сам факт работы лока.
 *
 * Run: node tests/race-conditions-base-habar-vassilich-yashik-hata-shmot-04-10.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readPhp(relPath) {
    return fs.readFileSync(path.join(root, relPath), 'utf-8');
}
function sliceFn(src, fnSignature, nextFnSignature) {
    const start = src.indexOf(fnSignature);
    if (start === -1) return null;
    const searchFrom = start + fnSignature.length;
    const end = nextFnSignature ? src.indexOf(nextFnSignature, searchFrom) : src.length;
    return src.slice(start, end === -1 ? src.length : end);
}

const ASSIGN_TPL = 'foreach($lockCols as $c) $user[$c] = $lockedUser[$c];';
const POST_SAVE_TPL = 'if($link) ' + ASSIGN_TPL;

// Общая проверка двухветочного контракта $lockedUser → $user, одинаковая для всех функций ниже:
// ровно 2 вхождения ASSIGN_TPL (одно — "голое", в фолбэк-ветке ДО saveUser(); одно — под
// "if($link)", ПОСЛЕ saveUser()), порядок строго fallback-присвоение < saveUser() < post-save.
function assertLockedUserContract(body, label, lockColNames) {
    assert(!!body, label + ': функция найдена');
    if (!body) return;
    assert(body.includes('$this->_rawLink()'), label + ': открывает отдельное соединение через _rawLink()');
    assert(body.includes('FOR UPDATE'), label + ': читает актуальные значения под FOR UPDATE');
    assert(body.includes('begin_transaction()') && body.includes('->commit()'), label + ': использует явную транзакцию begin_transaction/commit');
    assert(/UPDATE `\{\$this->registry\['utb'\]\}` SET /.test(body), label + ': пишет итог отдельным прямым UPDATE под той же транзакцией');
    assert(body.includes('$link->rollback()'), label + ': откатывает транзакцию на отказных ветках (не держит лок до конца процесса)');

    const assignCount = body.split(ASSIGN_TPL).length - 1;
    assert(assignCount === 2, label + ': ровно 2 присвоения $lockedUser→$user (фолбэк-ветка + после save), найдено ' + assignCount);

    const saveIdx = body.indexOf('saveUser($user)');
    const firstAssignIdx = body.indexOf(ASSIGN_TPL);
    const lastAssignIdx = body.lastIndexOf(ASSIGN_TPL);
    const postSaveIdx = body.lastIndexOf(POST_SAVE_TPL);
    assert(firstAssignIdx > -1 && saveIdx > -1 && firstAssignIdx < saveIdx,
        label + ': фолбэк-присвоение (без лока) идёт ДО saveUser() — иначе результат молча потеряется, если _rawLink() не смог подключиться');
    assert(postSaveIdx > -1 && postSaveIdx === lastAssignIdx - ('if($link) '.length) && postSaveIdx > saveIdx,
        label + ': финальное присвоение идёт ПОСЛЕ saveUser(), только если лок реально сработал (if($link))');

    for (const col of lockColNames) {
        assert(body.includes(col), label + `: лочит поле '${col}'`);
    }
}

const habarPhp     = readPhp('server/core/controllers/habar.php');
const vassilichPhp  = readPhp('server/core/controllers/vassilich.php');
const yashikPhp     = readPhp('server/core/controllers/yashik.php');
const hataPhp       = readPhp('server/core/controllers/hata.php');
const shmotPhp      = readPhp('server/core/controllers/shmot.php');
const basePhp       = readPhp('server/core/controllers/base.php');

console.log('\nTest 1: habar.php.buy() лочит habar_bought/habar_counts/валюту, двухветочный контракт');
assertLockedUserContract(
    sliceFn(habarPhp, 'function buy(){', 'function collectDay'),
    'habar.buy', ["'habar_bought'", "'habar_counts'"]
);

console.log('\nTest 2: habar.php.collectDay() лочит счётчики дня + валюты награды + weapons, двухветочный контракт');
assertLockedUserContract(
    sliceFn(habarPhp, 'function collectDay(){', 'private function _grantWeaponReward'),
    'habar.collectDay', ["'habar_days_collected'", "'habar_last_collect_ts'", "'weapons'", "'sedoy_dmg_total'"]
);

console.log('\nTest 3: vassilich.php.buy() лочит валюту/эффекты/vassilich_buys/coins_spent, двухветочный контракт');
assertLockedUserContract(
    sliceFn(vassilichPhp, 'function buy(){', 'function open_loot'),
    'vassilich.buy', ["'vassilich_buys'", "'coins_spent'", "'boss_keys'", "'bp_level'"]
);

console.log('\nTest 4: vassilich.php.open_loot() лочит валюту/эффекты, двухветочный контракт');
assertLockedUserContract(
    sliceFn(vassilichPhp, 'function open_loot(){', 'private function _applyEffect'),
    'vassilich.open_loot', ["'boss_keys'", "'max_energy'", "'bp_level'"]
);

console.log('\nTest 5: yashik.php.openBox() лочит bullets/ach_score/yashik_session/lost_stash_pity/shmot, двухветочный контракт');
assertLockedUserContract(
    sliceFn(yashikPhp, 'function openBox(){', 'function buyPatron'),
    'yashik.openBox', ["'bullets'", "'ach_score'", "'yashik_session'", "'lost_stash_pity'", "'shmot'"]
);

console.log('\nTest 6: yashik.php.buyPatron() лочит stew/bullets/stew_spent, двухветочный контракт');
assertLockedUserContract(
    sliceFn(yashikPhp, 'function buyPatron(){', 'function collect'),
    'yashik.buyPatron', ["'stew'", "'bullets'", "'stew_spent'"]
);

console.log('\nTest 7: yashik.php.collect() лочит yashik_session (защита от ДВОЙНОГО начисления одной сессии), двухветочный контракт');
{
    const body = sliceFn(yashikPhp, 'function collect(){', null);
    assertLockedUserContract(body, 'yashik.collect', ["'yashik_session'", "'stash_count'", "'shmot'"]);
    // Главный риск этой функции — не "лишнее списание", а ДВОЙНОЕ начисление одной и той же
    // отложенной сессии (два клика collect() до того, как yashik_session=null закоммитится).
    // Проверяем, что проверка "есть что забрать" (is_array($session)) выполняется НАД
    // $lockedUser (прочитанным под локом), а не над исходным устаревшим $user.
    assert(body && body.includes("$lockedUser['yashik_session'] ?? null"), 'yashik.collect: проверка сессии читает АКТУАЛЬНОЕ $lockedUser, не устаревший $user');
}

console.log('\nTest 8: hata.php.buy() лочит base_bg_owned/base_bg_active/cigarettes, двухветочный контракт');
assertLockedUserContract(
    sliceFn(hataPhp, 'function buy(){', 'function select'),
    'hata.buy', ["'base_bg_owned'", "'base_bg_active'"]
);

console.log('\nTest 9: shmot.php.buy() лочит валюту/shmot/max_energy, двухветочный контракт');
assertLockedUserContract(
    sliceFn(shmotPhp, 'function buy(){', 'function equip'),
    'shmot.buy', ["'shmot'", "'max_energy'"]
);

console.log('\nTest 10: base.php.upgrade() лочит base_buildings/coins/stew/coins_spent (эталонный эксплойт из отчёта), двухветочный контракт');
assertLockedUserContract(
    sliceFn(basePhp, 'function upgrade(){', 'function train'),
    'base.upgrade', ["'base_buildings'", "'coins_spent'"]
);

console.log('\nTest 11: base.php.train() лочит base_stats/energy/energy_time/energy_spent/train_count, двухветочный контракт');
assertLockedUserContract(
    sliceFn(basePhp, 'function train(){', 'function relocate'),
    'base.train', ["'base_stats'", "'energy_time'", "'energy_spent'", "'train_count'"]
);

console.log('\nTest 12: base.php.relocate() НЕ тронут локом — плоский overwrite base_location, не read-modify-write счётчика (осознанно не в скоупе фикса)');
{
    const body = sliceFn(basePhp, 'function relocate(){', null);
    assert(!!body, 'relocate() найден');
    assert(!body.includes('_rawLink()'), 'relocate() не использует _rawLink() — здесь нет реального lost-update риска (last-write-wins по дизайну)');
}

console.log('\nTest 13: во всех 6 файлах определён приватный _rawLink() с портом 3306 (тот же паттерн, что zone.php/bosses.php)');
for (const [name, src] of [['habar', habarPhp], ['vassilich', vassilichPhp], ['yashik', yashikPhp], ['hata', hataPhp], ['shmot', shmotPhp], ['base', basePhp]]) {
    assert(/private function _rawLink\(\)\{/.test(src), name + '.php: _rawLink() определён');
    assert(src.includes(", 3306)"), name + '.php: _rawLink() использует порт 3306 (не 6033 от старого хостинга)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
