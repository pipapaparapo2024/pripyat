/**
 * Test: 26.09.2026, по прямому репорту ("в /var/log/php_errors.log на каждом спине рулетки для
 * uid=657771445 повторяется PHP Warning: Array to string conversion ... roulette.php on line
 * 186") + подтверждено живыми логами (grep '[roulette.spin]' /var/log/php_errors.log) — это
 * НЕ просто лог-шум: slotResult для этого uid на КАЖДОМ спине был {"slotIdx":0,"reward":null}
 * вместо честного mt_rand(0,14), т.е. рулетка была молча зафорсена на пустой слот.
 *
 * Прямая проверка в БД (SELECT dev_force_roulette FROM users WHERE id=657771445) показала
 * ЧИСТОЕ значение '' — никакой порченой строки "Array" в БД нет. Настоящая причина —
 * Database::trueJSON() (server/core/models/database.php): для ЛЮБОГО поля, не входящего в
 * $isStringField, пустая строка ('' == null в PHP) молча подменяется на пустой МАССИВ []
 * ПРЯМО ПРИ ЧТЕНИИ из БД (тот же механизм, что уже чинили для nick/nickname/roulette_winner
 * 18-25.09.2026). Ни один из 4 личных одноразовых dev-force флагов
 * (dev_force_dice/dev_force_poker/dev_force_blackjack/dev_force_roulette,
 * users.php.setDevCombo()) не был в этом списке-исключении:
 *   $a = ''; ($a == null) === true → $a = []; strval($a) === "Array" (PHP: strval(массив)
 *   ВСЕГДА возвращает буквально "Array", не пустую строку) → intval("Array") === 0.
 * Итог — каждый контроллер, читающий свой dev_force_* через strval($user[...] ?? ''), видел
 * "Array" вместо ожидаемой пустой строки и включал форс с индексом/значением 0 для ЛЮБОГО
 * игрока с дефолтным (неиспользованным) флагом:
 *   - roulette.php.spin(): forceIdx=0 → КАЖДЫЙ спин попадал в пустой слот 0 (без честного mt_rand)
 *   - blackjack.php.deal(): dev_force_blackjack="Array" затирал настоящий pity-forcedRank
 *     (спасало только отдельное совпадающее исправление в _dealRealPair())
 *   - poker.php.deal(): targetCombo="Array" — 200 попыток впустую, честная раздача мимо
 *     весового _rollCombo()
 *   - dice.php.resolve(): forceIdx=0 → каждый бросок форсился на table[0]
 *
 * Фикс — в ДВУХ точках:
 *  1) database.php::trueJSON() — все 4 dev_force_* поля добавлены в $isStringField (источник
 *     бага закрыт сразу для всех 4 игр).
 *  2) roulette.php.spin() — defense-in-depth по аналогии с blackjack._dealRealPair(): сырое
 *     значение "Array" ИЛИ intval() вне диапазона слотов (0-14) игнорируется, форс не
 *     применяется, спин остаётся честным mt_rand, аномалия логируется для диагностики.
 *
 * Run: node tests/roulette-devforce-array-corruption-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const dbSrc       = fs.readFileSync(path.join(root, 'server', 'core', 'models', 'database.php'), 'utf-8');
const rouletteSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');

console.log('\nTest 1: Database::trueJSON() — все 4 dev_force_* флага в $isStringField (источник порчи закрыт для dice/poker/blackjack/roulette разом)');
{
    const start = dbSrc.indexOf('function trueJSON($array){');
    assert(start !== -1, 'trueJSON() найден');
    // 27.09.2026 (фикс собственного теста, найден при полном прогоне tests/ перед деплоем):
    // фиксированное окно в 4000 символов было откалибровано ДО того, как энергетический фикс
    // (energy-truejson-array-corruption-fix.test.js) добавил большой поясняющий комментарий
    // перед той же строкой $isStringField — окно перестало доставать до dev_force_*/
    // roulette_winner, ложный FAIL на полностью корректном коде. Срез теперь до конца самой
    // функции (следующее объявление function).
    const nextFnIdx = dbSrc.indexOf('function ', start + 10);
    const body = dbSrc.slice(start, nextFnIdx !== -1 ? nextFnIdx : start + 8000);
    for (const field of ['dev_force_dice', 'dev_force_poker', 'dev_force_blackjack', 'dev_force_roulette']) {
        assert(body.includes(`$keys[$i] === '${field}'`), `'${field}' исключён из JSON/массив-декодирования (== null → [] больше не срабатывает)`);
    }
    // Старые исключения не должны быть случайно затёрты правкой.
    for (const field of ['name', 'balabol', 'nick', 'nickname', 'roulette_winner']) {
        assert(body.includes(`'${field}'`), `старое исключение '${field}' на месте`);
    }
}

console.log('\nTest 2: roulette.php.spin() — defense-in-depth: "Array"/вне диапазона игнорируется, форс не применяется');
{
    const start = rouletteSrc.indexOf('function spin(){');
    assert(start !== -1, 'spin() найден');
    const end = rouletteSrc.indexOf('$link = $this->_rawLink();', start);
    const body = rouletteSrc.slice(start, end);

    assert(/if\(\$devForceRouletteRaw === 'Array'\)\{/.test(body), 'явная проверка на буквальное "Array" (strval() от массива)');
    assert(/error_log\('\[roulette\.spin\] !!! dev_force_roulette пришёл МАССИВОМ/.test(body), 'аномалия "Array" логируется для диагностики');
    assert(/if\(\$idx >= 0 && \$idx < count\(\$this->SPIN_SLOTS\)\) \$devForceIdx = \$idx;/.test(body), 'idx применяется, только если попадает в реальный диапазон SPIN_SLOTS');
    assert(/error_log\('\[roulette\.spin\] !!! dev_force_roulette вне диапазона слотов/.test(body), 'выход за диапазон тоже логируется');
    // devForceIdx должен остаться null (не 0!) для обоих аномальных случаев — честный mt_rand ниже отработает как обычно.
    const arrayBranch = body.slice(body.indexOf("=== 'Array'"), body.indexOf("$user['dev_force_roulette'] = '';"));
    assert(!/\$devForceIdx\s*=\s*0/.test(arrayBranch), 'ветка "Array" НЕ присваивает devForceIdx=0 (иначе форс всё равно сработал бы на слот 0)');
}

console.log('\nTest 3: honest fallback — при отсутствующем/некорректном devForceIdx _rollSlot() всё равно вызывается с честным mt_rand (не 0)');
{
    // devForceIdx остаётся null → _rollSlot() уходит в ветку $jackpot/$keyringAvailable с mt_rand(0,14), не в "DEV FORCE".
    assert(/if\(\$forceIdx !== null\)\{/.test(rouletteSrc), '_rollSlot() форсирует только если $forceIdx СТРОГО не null');
    assert(/\$idx = mt_rand\(0, 14\);/.test(rouletteSrc), 'честная ветка mt_rand(0,14) присутствует и используется, когда форс не активен');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
