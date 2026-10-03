/**
 * Test: 23.09.2026 (по прямому указанию, превентивно — тот же класс логирования, что у
 * блэкджека) — максимальное логирование в deal()/swap()/resolve()/openBag() (poker.php) +
 * печать в консоль браузера (dvor-poker-game.js/dvor-poker-bag.js).
 *
 * Run: node tests/poker-max-debug-logging.test.js
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

const pokerPhp    = readSrc('server/core/controllers/poker.php');
const pokerGameJs = readSrc('_client/src/game/dvor/dvor-poker-game.js');
const pokerBagJs  = readSrc('_client/src/game/dvor/dvor-poker-bag.js');

console.log('\nTest 1: deal() — debug сверяет сгенерированную руку с запрошенной комбинацией');
{
    const start = pokerPhp.indexOf('function deal(){');
    const end   = pokerPhp.indexOf('function swap(){');
    const body  = pokerPhp.slice(start, end);
    assert(/\$comboTrace = \[\];/.test(body), 'трассировка roll_table (_rollCombo) собрана');
    assert(/\$actualComboAtDeal = \$this->_evaluateHand\(\$catalog, \$hand\);/.test(body),
        'сгенерированная рука независимо перепроверяется _evaluateHand() — если разойдётся с targetCombo, видно сразу');
    assert(/'comboMismatchAtDeal' => \(\$actualComboAtDeal !== \$targetCombo\)/.test(body), 'явный флаг расхождения');
    assert(/\$verify = \$this->_verifySaved\(\$user\['poker_session'\]\);/.test(body), 'после saveUser() состояние перечитывается ИЗ БД заново');
    assert(/'debug' => \$debug/.test(body), 'debug передаётся клиенту в ответе ok()');
}

console.log('\nTest 2: swap() — трассировка попыток замены карты (не дублирует, реально другая)');
{
    const start = pokerPhp.indexOf('function swap(){');
    const end   = pokerPhp.indexOf('function resolve(){');
    const body  = pokerPhp.slice(start, end);
    assert(/\$swapTrace\[\] = "attempt#\$attempt cand=" \. json_encode\(\$cand\) \. " sameAsOld=" \. \(\$sameAsOld\?'1':'0'\) \. " dup=" \. \(\$dup\?'1':'0'\);/.test(body),
        'каждая попытка замены логируется (кандидат, sameAsOld, dup)');
    assert(/'usedFallback' => \$usedFallback/.test(body), 'фолбэк (200 попыток исчерпаны) явно помечен в debug');
    assert(/'debug' => \$debug/.test(body), 'debug передаётся клиенту в ответе ok()');
}

console.log('\nTest 3: resolve() — итоговая рука/комбинация/выплата в debug');
{
    const start = pokerPhp.indexOf('function resolve(){');
    const body  = pokerPhp.slice(start);
    assert(/'comboPayout' => \$c/.test(body), 'выплата по итоговой комбинации попадает в debug');
    assert(/\$verify = \$this->_verifySaved\(\$user\['poker_session'\]\);/.test(body), 'после saveUser() состояние перечитывается ИЗ БД заново');
    assert(/'debug' => \$debug/.test(body), 'debug передаётся клиенту в ответе ok()');
}

console.log('\nTest 4: клиент печатает debug + метки времени клика (deal/swap/resolve/openBag)');
{
    assert(/function logPokerDebug\(fnLabel, debug\)\{/.test(pokerGameJs), 'общий хелпер logPokerDebug() определён в dvor-poker-game.js');
    const calls = [...pokerGameJs.matchAll(/logPokerDebug\('([^']+)', res && res\.debug\);/g)].map(m => m[1]);
    assert(calls.some(c => c.includes('deal')), 'вызывается в колбэке poker.deal');
    assert(calls.some(c => c.includes('swap')), 'вызывается в колбэке poker.swap');
    assert(calls.some(c => c.includes('resolve')), 'вызывается в колбэке poker.resolve');
    assert(/ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА \(debug\)/.test(pokerBagJs), 'openBag (dvor-poker-bag.js) тоже печатает debug');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
