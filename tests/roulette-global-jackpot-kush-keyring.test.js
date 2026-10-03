/**
 * Test: глобальный джек-пот рулетки, мини-игра "9 стаканчиков" + Куш, Связка ключей
 * (30-дневный цикл) — ранее полностью отсутствовали в коде (per-player локальный pity
 * вместо общего на всех игроков счётчика; 9-стаканчиков и Куш не существовали вовсе;
 * Связка ключей была декоративной меткой, навсегда исключённой из выпадения).
 *
 * Новая архитектура:
 *  - server/migrate11.php создаёт общую (одна строка, id=1) таблицу roulette_state
 *    (spin_counter/spin_threshold — джек-пот; kush_counter/kush_threshold — Куш;
 *    keyring_owner_id/keyring_cycle_ends_at — Связка) + колонки users.roulette_cups
 *    (что сервер разложил под 9 стаканчиков) и users.keyring_owner.
 *  - server/core/controllers/roulette.php — status/spin/claimKeyring/openMinigame/pickCup,
 *    атомарные UPDATE...LAST_INSERT_ID() (без гонок при одновременных прокрутках разных
 *    игроков) и атомарный условный UPDATE для эксклюзивного присвоения Связки.
 *  - Клиент (_client/src/game/dvor/dvor-roulette*.js) больше не решает джек-пот/ключи
 *    локальным счётчиком this._data.roulette.jack — спрашивает сервер перед каждым спином.
 *
 * Run: node tests/roulette-global-jackpot-kush-keyring.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const migrateSrc   = fs.readFileSync(path.join(root, 'server', 'migrate11.php'), 'utf-8');
const controllerSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');
const registrySrc  = fs.readFileSync(path.join(root, 'server', 'core', 'models', 'registry.php'), 'utf-8');
const dvorSrc      = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor.js'), 'utf-8');
const roulSrc      = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette.js'), 'utf-8');
const roulScreenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-screen.js'), 'utf-8');
const minigameSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-minigame.js'), 'utf-8');

console.log('\nTest 1: миграция создаёт общую таблицу roulette_state с верными диапазонами');
{
    assert(/CREATE TABLE IF NOT EXISTS `roulette_state`/.test(migrateSrc), 'таблица roulette_state создаётся');
    assert(/spin_counter.*spin_threshold/s.test(migrateSrc), 'есть поля джек-пота (spin_counter/spin_threshold)');
    assert(/kush_counter.*kush_threshold/s.test(migrateSrc), 'есть поля Куша (kush_counter/kush_threshold)');
    assert(/keyring_owner_id.*keyring_cycle_ends_at/s.test(migrateSrc), 'есть поля Связки ключей (владелец/конец цикла ожидания)');
    assert(/rand\(3000, 3500\)/.test(migrateSrc), 'стартовый spin_threshold — диапазон 3000-3500 по ТЗ');
    assert(/rand\(6, 8\)/.test(migrateSrc), 'стартовый kush_threshold — диапазон 6-8 по ТЗ');
    assert(/roulette_cups.*TEXT/.test(migrateSrc), 'добавляется колонка users.roulette_cups (что сервер положил под стаканчики)');
    assert(/keyring_owner.*VARCHAR/.test(migrateSrc), 'добавляется колонка users.keyring_owner');
}

console.log('\nTest 2: контроллер roulette.php зарегистрирован и содержит все методы');
{
    assert(/'roulette'/.test(registrySrc), "'roulette' добавлен в разрешённые классы (registry.php), иначе universal.php отклонит все вызовы");
    // 22.09.2026: 'openCase' добавлен в permits (server-authoritative открытие кейса
    // рулетки) — см. tests/roulette-poker-spichki-open-server-authoritative.test.js.
    // 24.09.2026: добавлен permit 'claimPrize' (несвязанной правкой) — расширение списка, не регресс.
    // 27.09.2026 (устаревший тест, найдено плановой чисткой): 'buyPoints' добавлен в permits
    // 26.09.2026 (аудит "покупка поинтов зариков/рулетки за рубли напрямую вызывает
    // users.save" — см. комментарий у $BUY_POINTS_TABLE в roulette.php), тест не обновили.
    // 29.09.2026 (СРОЧНО, по прямому указанию — найденный по ходу дела эксплойт): 'claimKeyring'
    // удалён из permits и как метод — раньше клиент дёргал его ОТДЕЛЬНЫМ запросом после спина
    // БЕЗ проверки, что игрок реально выбил сектор №1 — TS.php('roulette.claimKeyring', {}) из
    // консоли давал keyring_owner=1 бесплатно и в любой момент. Выдача перенесена прямо в
    // spin()/pickCup() (см. tests/roulette-global-jackpot-kush-keyring.test.js (структура) и roulette-wheel-visual-keyring-cooldown-impossible.test.js (Monte-Carlo)).
    assert(/this->permits = \['status', 'spin', 'claimPrize', 'openMinigame', 'pickCup', 'openCase', 'buyPoints'\];/.test(controllerSrc), 'все старые методы (минус claimKeyring) + claimPrize + openCase + buyPoints в permits');
    assert(/function status\(\)/.test(controllerSrc) && /function spin\(\)/.test(controllerSrc) &&
           /function openMinigame\(\)/.test(controllerSrc) &&
           /function pickCup\(\)/.test(controllerSrc), 'status/spin/openMinigame/pickCup реализованы');
    assert(!/\n    function claimKeyring\(\)\{/.test(controllerSrc), 'публичный метод claimKeyring() удалён целиком (эксплойт-эндпоинт)');
}

console.log('\nTest 3: джек-пот — атомарный инкремент через LAST_INSERT_ID (без гонок между игроками)');
{
    // 15.09.2026: тот же запрос теперь ЗАОДНО растит jackpot_pool (+10 за спин) —
    // см. tests/roulette-real-jackpot-pool.test.js для полной проверки этой логики.
    assert(/UPDATE `roulette_state` SET `spin_counter` = LAST_INSERT_ID\(`spin_counter` \+ 1\), `jackpot_pool` = `jackpot_pool` \+ 10 WHERE `id`=1/.test(controllerSrc),
        'spin() инкрементирует общий счётчик атомарно через LAST_INSERT_ID (и заодно растит jackpot_pool)');
    assert(/\$newThreshold = rand\(3000, 3500\);/.test(controllerSrc), 'после срабатывания — новый порог 3000-3500');
}

console.log('\nTest 4: Куш — глобальный счётчик открытых мини-игр, порог 6-8, сброс после срабатывания');
{
    // 27.09.2026 (устаревший тест, найдено плановой чисткой): 26.09.2026 (по прямому указанию —
    // "исправление логики Куша") openMinigame() перестал сбрасывать kush_counter в момент
    // достижения порога (раньше Куш "сгорал", если игрок не угадывал нужный стаканчик) — сброс
    // перенесён в pickCup() (ветка reward==='kush', реальный выигрыш). Заодно инкремент счётчика
    // перестал использовать трюк LAST_INSERT_ID(...) (там больше нет условного сброса в той же
    // строке, атомарность отдельного WHERE-порога не нужна) — обычный UPDATE + отдельный SELECT.
    // Уже подтверждено отдельным тестом на то же поведение —
    // tests/shmot-cell-positions-batch2-and-consolation-prize.test.js (строки 83-88).
    assert(/UPDATE `roulette_state` SET `kush_counter` = kush_counter \+ 1 WHERE `id`=1/.test(controllerSrc),
        'openMinigame() инкрементирует общий счётчик открытых мини-игр (сброс порога — только в pickCup при реальном выигрыше)');
    assert(/\$newT = rand\(6, 8\);/.test(controllerSrc), 'после срабатывания Куша — новый порог 6-8');
}

console.log('\nTest 5: Связка ключей — бинарная доступность с 30-дневным окном (см. полное ТЗ 29.09.2026, tests/roulette-global-jackpot-kush-keyring.test.js (структура) и roulette-wheel-visual-keyring-cooldown-impossible.test.js (Monte-Carlo))');
{
    // 28.09.2026 правка ("Связка должна быть личной наградой, не одной на весь сервер") убрала
    // эксклюзивный 30-дневный цикл ВООБЩЕ — заодно случайно захардкодила $keyringAvailable=true
    // без единого дня ожидания (репорт 29.09.2026 — "игрок выбил связку, такого не может быть").
    // 29.09.2026 (СРОЧНО, полное ТЗ): цикл вернули, но с другой семантикой — не "один эксклюзивный
    // владелец", а "окно доступности то открыто (после 30 дней ожидания), то закрыто (сразу
    // после первой выдачи)" — keyring_owner всё ещё личный (сколько угодно игроков суммарно за
    // всё время), просто получить его можно только в узком открытом окне. Полная проверка — в
    // tests/roulette-global-jackpot-kush-keyring.test.js (структура) и roulette-wheel-visual-keyring-cooldown-impossible.test.js (Monte-Carlo), здесь — только sanity, что личный
    // (не единый глобальный) keyring_owner не откатили обратно к эксклюзивности.
    assert(/\$user\['keyring_owner'\] = 1;\s*\n\s*return \$this->ops->saveUser\(\$user\);/.test(controllerSrc),
        '_tryClaimKeyring — просто сохраняет keyring_owner=1 текущему игроку (личная награда, не единый слот)');
    assert(/time\(\) >= intval\(\$row\['keyring_cycle_ends_at'\]\)/.test(controllerSrc),
        'доступность снова читается из keyring_cycle_ends_at (не хардкод true) — см. полную проверку в roulette-global-jackpot-kush-keyring.test.js (структура) и roulette-wheel-visual-keyring-cooldown-impossible.test.js (Monte-Carlo)');
}

console.log('\nTest 6: pickCup — Связка выдаётся напрямую (без claimKeyring), стаканчики одноразовые');
{
    // 29.09.2026: pickCup() больше не зовёт _tryClaimKeyring() (раньше — двойная запись в БД:
    // отдельный loadUser()/saveUser() поверх уже загруженного $user этой же функции) — теперь
    // keyring_owner ставится прямо на уже загруженный $user, один атомарный saveUser().
    assert(/if\(\$reward === 'keyring'\)\{[\s\S]{0,800}\$user\['keyring_owner'\] = 1;/.test(controllerSrc),
        "pickCup для Связки ставит keyring_owner=1 прямо на загруженный \$user (не через отдельный _tryClaimKeyring())");
    assert(/missed_keyring/.test(controllerSrc), 'при неудачном сохранении — не оставляет игрока без утешительной награды');
    assert(/\$user\['roulette_cups'\] = null;/.test(controllerSrc), 'стаканчики очищаются после выбора — повторный pickCup ничего не даст');
}

console.log('\nTest 7: клиент — джек-пот и ключи больше НЕ решаются локальным per-player счётчиком');
{
    assert(/roulette: \{ exp:0 \}/.test(dvorSrc), '_defaultData().roulette больше не содержит jack/jack_t (был локальный per-player pity)');
    assert(!/jack_t\)\s*this\._data\.roulette\.jack_t/.test(dvorSrc), 'реseed jack_t в _loadData() убран');
    assert(/TS\.php\('roulette\.spin', \{\}, \(res\) => \{/.test(roulSrc), '_spinRoulette спрашивает сервер перед каждым спином');
    // 23.09.2026 (перенос награды обычного спина на сервер): выбор slotIdx (включая условие
    // "ключи доступны только если сервер подтвердил") переехал целиком на сервер — см.
    // roulette.php._rollSlot() и tests/roulette-15-slots-fix.test.js Test 3. Клиент теперь
    // только читает res.slotIdx, сам не решает.
    assert(/const idx = res\.slotIdx;/.test(roulSrc), 'клиент использует slotIdx из ответа сервера, не выбирает локально');
    assert(!/Math\.random\(\) \* 15/.test(roulSrc), 'локальный выбор индекса (Math.random) убран из клиента');
}

console.log('\nTest 8: клиент — джек-пот открывает выбор (реальная сумма / мини-игра), ключи выдаются вместе со спином');
{
    // 15.09.2026: сумма выбора — реальный накопленный jackpot_pool, а не хардкод 500 —
    // см. tests/roulette-real-jackpot-pool.test.js.
    assert(/this\._openJackpotChoice\(\);/.test(roulScreenSrc), 'слот СУПЕРПРИЗ открывает экран выбора с выбором фиксированных 500 рублей или суперигры');
    // 29.09.2026: отдельный TS.php('roulette.claimKeyring', {}) убран целиком — Связка приходит
    // в том же патче, что уже применён applyPatch() в dvor-roulette.js ДО вызова этой функции
    // (см. tests/roulette-global-jackpot-kush-keyring.test.js (структура) и roulette-wheel-visual-keyring-cooldown-impossible.test.js (Monte-Carlo) для полной проверки).
    // Исключаем строки-комментарии (историческая справка "было" внутри дока правки 29.09.2026
    // сама содержит эту строку как цитату) — проверяем только реальный код.
    const roulScreenCode = roulScreenSrc.split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n');
    assert(!/TS\.php\('roulette\.claimKeyring'/.test(roulScreenCode), 'слот "Связка ключей" больше НЕ дёргает отдельный claimKeyring-запрос');
    assert(/jackAmt/.test(roulScreenSrc) === false || !/this\._data\.roulette\.jack/.test(roulScreenSrc),
        'больше не читает удалённое this._data.roulette.jack при резолве');
}

console.log('\nTest 9: мини-игра "9 стаканчиков" реализована на клиенте');
{
    assert(/proto\._openJackpotChoice = function\(\)\{/.test(minigameSrc), '_openJackpotChoice() (500 рублей/мини-игра) определён');
    assert(/proto\._openRouletteMinigame = function\(\)\{/.test(minigameSrc), '_openRouletteMinigame определён');
    assert(/TS\.php\('roulette\.openMinigame', \{\}/.test(minigameSrc), 'открытие мини-игры идёт через сервер (инкремент счётчика Куша)');
    assert(/TS\.php\('roulette\.pickCup', \{idx:i\}/.test(minigameSrc), 'выбор стаканчика подтверждается сервером');
    assert(/for\(let i = 0; i < 9; i\+\+\)\{/.test(minigameSrc), 'ровно 9 стаканчиков');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
