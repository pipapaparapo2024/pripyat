/**
 * Test: 23.09.2026 (по прямому указанию, превентивно — тот же класс логирования, что у
 * блэкджека после репорта "выпала AA хотя pity ещё далеко", конкретного бага в зариках не
 * было) — максимальное логирование в start()/reroll()/resolve() (dice.php) + печать в
 * консоль браузера (dvor-dice-game.js).
 *
 * Run: node tests/dice-max-debug-logging.test.js
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

const dicePhp = readSrc('server/core/controllers/dice.php');
const diceJs  = readSrc('_client/src/game/dvor/dvor-dice-game.js');

console.log('\nTest 1: start() — debug собран (pity, каталог, трассировка бросков) и передан клиенту');
{
    const start = dicePhp.indexOf('function start(){');
    const end   = dicePhp.indexOf('function reroll(){');
    const body  = dicePhp.slice(start, end);
    assert(/\$rawSessionFromDb = isset\(\$user\['dice_session'\]\)/.test(body), 'сырая строка dice_session из БД читается до декодирования');
    assert(/'catalogFull' => \$catalog/.test(body), 'весь каталог попадает в debug');
    assert(/'rollTrace' => \$rollTrace/.test(body), 'трассировка бросков (включая перебросы при 4×6 не по pity) собрана');
    assert(/\$verify = \$this->_verifySaved\(\$user\['dice_session'\]\);/.test(body), 'после saveUser() состояние перечитывается ИЗ БД заново');
    assert(/'debug' => \$debug/.test(body), 'debug передаётся клиенту в ответе ok()');
}

console.log('\nTest 2: reroll() — трассировка попытки (вес кости + возможный переброс премиальной комбинации)');
{
    // 02.10.2026 (по прямому указанию, после находки при разборе полного прогона tests/):
    // старый хард-блок othersAll6 убран вместе со всей pity-системой (см. дата-комментарий в
    // начале dice.php) — трассировка попытки переброса теперь идёт через общий $rollTrace,
    // заполняемый _weightedDie()/_reducePremiumRoll(), а не отдельным форматом "othersAll6=...".
    const start = dicePhp.indexOf('function reroll(){');
    const end   = dicePhp.indexOf('function resolve(){');
    const body  = dicePhp.slice(start, end);
    assert(/\$v = \$this->_weightedDie\(\$catalog, \$rollTrace\);/.test(body), 'новое значение кости берётся через _weightedDie() — трассировка попадает в общий $rollTrace');
    assert(/\$active\['rolls'\] = \$this->_reducePremiumRoll\(\$active\['rolls'\], \$catalog, \$rollTrace\);/.test(body),
        'результат переброса прогоняется через _reducePremiumRoll() — её трассировка (включая возможный полный переброс премиальной комбинации) тоже попадает в $rollTrace');
    assert(/'rollTrace' => \$rollTrace/.test(body), 'rollTrace передаётся клиенту в debug');
    assert(/'debug' => \$debug/.test(body), 'debug передаётся клиенту в ответе ok()');
}

console.log('\nTest 3: resolve() — трассировка таблицы наград');
{
    // 02.10.2026 (по прямому указанию, после находки при разборе полного прогона tests/):
    // pity-счётчика больше нет вообще (см. дата-комментарий в начале dice.php) — resolve()
    // ничего не "обновляет" и не кладёт pityBefore в debug, только читает уже финальные rolls.
    const start = dicePhp.indexOf('function resolve(){');
    const body  = dicePhp.slice(start);
    assert(/\$tableTrace\[\] = "v=\{\$row\['v'\]\} n=\{\$row\['n'\]\} have=\$have enough=" \. \(\$enough\?'1':'0'\) \. " alreadyTaken=" \. \(\$already\?'1':'0'\);/.test(body),
        'каждая строка таблицы наград проверяется и логируется');
    assert(!/pityBefore/.test(body), 'регресс-гвард: pityBefore отсутствует — pity-счётчика больше нет');
    assert(/'debug' => \$debug/.test(body), 'debug передаётся клиенту в ответе ok()');
}

console.log('\nTest 4: клиент печатает debug + метки времени клика во всех трёх запросах');
{
    assert(/function logDiceDebug\(fnLabel, debug\)\{/.test(diceJs), 'общий хелпер logDiceDebug() определён');
    const calls = [...diceJs.matchAll(/logDiceDebug\('([^']+)', res && res\.debug\);/g)].map(m => m[1]);
    assert(calls.some(c => c.includes('start')), 'вызывается в колбэке dice.start');
    assert(calls.some(c => c.includes('reroll')), 'вызывается в колбэке dice.reroll');
    assert(calls.some(c => c.includes('resolve')), 'вызывается в колбэке dice.resolve');
    assert((diceJs.match(/performance\.now\(\)\.toFixed\(1\)/g) || []).length >= 3, 'метки времени клика минимум в 3 местах (бросить/переброс/резолв)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
