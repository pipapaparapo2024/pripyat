/**
 * Test: 23.09.2026 (по прямому указанию, репорт "выпала AA хотя pity ещё далеко", 2 честные
 * последовательные смены без гонки кликов — построчный разбор deal()/swap()/resolve() дыру не
 * нашёл) — максимальное логирование добавлено в двух местах:
 *
 * 1) server/core/controllers/blackjack.php — error_log() (Правило №8) + поле debug в КАЖДОМ
 *    ответе (deal/swap/resolve): сырой blackjack_session из БД до декодирования, каталог
 *    рангов/премиум-рангов, pity-счётчики, попытка-за-попыткой трассировка циклов розыгрыша/
 *    смены, явная пометка isPremiumPairAfter/isPremiumWin/usedFallback.
 * 2) _client/src/game/dvor/dvor-blackjack.js — logBlackjackDebug() печатает res.debug ОТДЕЛЬНО
 *    раскрытым объектом (не JSON.stringify-строкой) в консоль браузера при каждом deal/swap/
 *    resolve, отдельным console.error если сервер сам пометил находку.
 *
 * Это НЕ фикс (причина ещё не найдена) — чисто диагностика, чтобы при следующем повторении
 * бага сразу было видно причину и в серверном error_log, и в консоли браузера у пользователя.
 *
 * Run: node tests/blackjack-max-debug-logging.test.js
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

const bjPhp = readSrc('server/core/controllers/blackjack.php');
const bjJs  = readSrc('_client/src/game/dvor/dvor-blackjack.js');

console.log('\nTest 1: deal() — debug-поле собрано и передано в ответ, error_log вызван');
{
    const start = bjPhp.indexOf('function deal(){');
    const end   = bjPhp.indexOf('function swap(){');
    const body  = bjPhp.slice(start, end);
    assert(/\$rawSessionFromDb = isset\(\$user\['blackjack_session'\]\)/.test(body), 'сырая строка blackjack_session из БД читается до декодирования');
    assert(/'forcedRankTrace'\s*=>\s*\$forcedTrace/.test(body), 'пошаговая трассировка проверки pity-порога (qq/kk/aa) собрана');
    assert(/'dealTrace'\s*=>\s*\$dealTrace/.test(body), 'пошаговая трассировка _dealRealPair() (попытка за попыткой) собрана');
    assert(/'catalogFull'\s*=>\s*\$catalog/.test(body), 'весь каталог (не только ranks/premium_ranks) попадает в debug');
    assert(/'microtime'\s*=>\s*microtime\(true\)/.test(body), 'microtime(true) — точность выше секунды, для сверки порядка запросов');
    assert(/'rawParams'\s*=>\s*\$this->registry\['user_params'\]/.test(body), 'сырые параметры запроса логируются');
    assert(/\$verifyUser = \$this->ops->loadUser\(\['id', 'blackjack_session'\]\);/.test(body),
        'после saveUser() состояние перечитывается ИЗ БД заново — не доверяем локальной переменной');
    assert(/'saveVerifyMismatch'\s*=>\s*!\$this->ops->sameJsonState\(\$user\['blackjack_session'\], \$verifyRaw\)/.test(body),
        'сверяет записанное и перечитанное JSON-состояние по данным, а не по строке и PHP-массиву');
    assert(/error_log\('\[blackjack\.deal\] ' \. json_encode\(\$debug\)/.test(body), 'error_log() вызывается с полным debug-объектом');
    assert(/'debug' => \$debug/.test(body), 'debug передаётся клиенту в ответе ok()');
}

console.log('\nTest 2: swap() — попытка-за-попыткой трассировка цикла, явная пометка дыры');
{
    const start = bjPhp.indexOf('function swap(){');
    const end   = bjPhp.indexOf('function resolve(){');
    const body  = bjPhp.slice(start, end);
    assert(/\$swapTrace\[\] = "attempt#\$attempt rank=\$rank rejectOld=" \. \(\$rejectOld\?'1':'0'\) \. " rejectMatch=" \. \(\$rejectMatch\?'1':'0'\);/.test(body),
        'каждая попытка цикла (rank, rejectOld, rejectMatch) логируется отдельно');
    assert(/'isPremiumPairAfter'\s*=>\s*\(\$active\['hand'\]\[0\] === \$active\['hand'\]\[1\] && in_array\(\$active\['hand'\]\[0\], \$PREMIUM, true\)\)/.test(body),
        'debug явно вычисляет isPremiumPairAfter — если пара премиум и получена БЕЗ forcedRank, это и есть дыра');
    assert(/ЭТО ТА САМАЯ ДЫРА/.test(body), 'error_log содержит явную пометку находки, если она когда-нибудь сработает');
    assert(/'catalogFull'\s*=>\s*\$catalog/.test(body), 'весь каталог (не только ranks/premium_ranks) попадает в debug');
    assert(/'microtime'\s*=>\s*microtime\(true\)/.test(body), 'microtime(true) — точность выше секунды');
    assert(/\$verifyUser = \$this->ops->loadUser\(\['id', 'blackjack_session'\]\);/.test(body),
        'после saveUser() состояние перечитывается ИЗ БД заново');
    assert(/'debug'     => \$debug/.test(body), 'debug передаётся клиенту в ответе ok()');
}

console.log('\nTest 3: resolve() — debug содержит итоговое состояние и forcedKey для сверки');
{
    const start = bjPhp.indexOf('function resolve(){');
    const body  = bjPhp.slice(start);
    assert(/'isPremiumWin'\s*=>\s*\$isPremiumWin/.test(body), 'debug содержит isPremiumWin (bestRank — премиум-ранг)');
    assert(/'forcedKey'\s*=>\s*\$forcedKey/.test(body), 'debug содержит forcedKey — был ли выигрыш легитимно форсирован pity');
    assert(/'catalogFull'\s*=>\s*\$catalog/.test(body), 'весь каталог попадает в debug');
    assert(/\$verifyUser = \$this->ops->loadUser\(\['id', 'blackjack_session'\]\);/.test(body),
        'после saveUser() состояние перечитывается ИЗ БД заново');
    assert(/'debug'        => \$debug/.test(body), 'debug передаётся клиенту в ответе ok()');
}

console.log('\nTest 4: клиент печатает debug отдельно раскрытым объектом при всех трёх запросах + метки времени клика');
{
    assert(/function logBlackjackDebug\(fnLabel, debug\)\{/.test(bjJs), 'общий хелпер logBlackjackDebug() определён');
    assert(/console\.log\('\[dvor-blackjack\.' \+ fnLabel \+ '\] ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА \(debug\):', debug\);/.test(bjJs),
        'печатает debug как объект (не JSON.stringify) — разворачивается в devtools');

    const calls = [...bjJs.matchAll(/logBlackjackDebug\('([^']+)', res && res\.debug\);/g)].map(m => m[1]);
    assert(calls.some(c => c.includes('deal')), 'вызывается в колбэке blackjack.deal');
    assert(calls.some(c => c.includes('swap')), 'вызывается в колбэке blackjack.swap');
    assert(calls.some(c => c.includes('resolve')), 'вызывается в колбэке blackjack.resolve');

    // 23.09.2026 (по прямому указанию — "залогируй вообще всё"): метки времени самого КЛИКА
    // (не ответа сервера) — независимая от памяти игрока проверка порядка/скорости кликов,
    // сверяется с microtime в debug-ответе сервера.
    assert(/КЛИК раздать.*performance\.now\(\)/.test(bjJs), '_playBlackjack логирует момент клика (performance.now/Date.now)');
    assert(/КЛИК смена idx=.*performance\.now\(\)/.test(bjJs), '_swapBlackjackCard логирует момент клика по каждой смене');
    assert(/КЛИК готово.*performance\.now\(\)/.test(bjJs), '_bjFinishSwap логирует момент клика по ГОТОВО');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
