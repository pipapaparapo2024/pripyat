/**
 * Test: 23.09.2026 (по прямому указанию, превентивно — тот же класс логирования, что у
 * блэкджека) — максимальное логирование в spin()/openCase()/openMinigame()/
 * pickCup() (roulette.php) + печать в консоль браузера (dvor-roulette*.js).
 * 29.09.2026: claimKeyring() удалён (был эксплойтом, см. tests/roulette-global-jackpot-kush-keyring.test.js (структура) и roulette-wheel-visual-keyring-cooldown-impossible.test.js (Monte-Carlo)),
 * выдача связки колеса ушла в spin(), отдельный debug-вывод для неё больше не нужен.
 *
 * 10.10.2026 (СРОЧНО, по прямому указанию — проверка присланного ТЗ "Игроки не должны видеть:
 * текущее количество прокрутов/момент Джек-пота; текущий счётчик Куша/момент его появления/под
 * каким стаканчиком он находится" + подтверждение репорта "debug реально сливается в консоль
 * браузера"): $debug в spin()/openMinigame()/pickCup() буквально содержал ВСЁ перечисленное
 * (globalCounterAfterIncrement/globalThreshold — счётчик джекпота; kushCounter/kushThreshold/
 * hasKush — счётчик куша; 'cups'/'allCups' — ПОЛНУЮ раскладку 9 стаканчиков) и ЭТИ ТРИ метода
 * отдавали debug клиенту В ОТВЕТЕ, а клиент тут же печатал его в console.log — то есть ЛЮБОЙ
 * игрок, открыв консоль браузера, видел всё перечисленное в ТЗ как "не должны видеть". Фикс —
 * $debug остаётся ТОЛЬКО в error_log() (серверная диагностика, игроку не видна никак), поле
 * 'debug' убрано из ответа всех трёх методов, соответствующие console.log() на клиенте убраны.
 * openCase() (dvor-roulette-buy.js) НЕ трогался — его debug (reward/hasTatu/pkg_idx и т.п.) не
 * содержит ничего из списка "не должны видеть" по этому ТЗ.
 *
 * Run: node tests/roulette-max-debug-logging.test.js
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

const roulPhp        = readSrc('server/core/controllers/roulette.php');
const roulJs          = readSrc('_client/src/game/dvor/dvor-roulette.js');
const roulMinigameJs  = readSrc('_client/src/game/dvor/dvor-roulette-minigame.js');
const roulScreenJs    = readSrc('_client/src/game/dvor/dvor-roulette-screen.js');
const roulBuyJs       = readSrc('_client/src/game/dvor/dvor-roulette-buy.js');

console.log('\nTest 1: spin() — трассировка глобального джекпот-счётчика (roulette_state) и слот-ролла в error_log; клиенту debug БОЛЬШЕ НЕ отдаётся (обе ветки — rawLink-fallback и обычная)');
{
    const start = roulPhp.indexOf('function spin(){');
    const end   = roulPhp.indexOf('private function _rollSlot(');
    const body  = roulPhp.slice(start, end);
    assert(/'globalCounterAfterIncrement' => \$counter, 'globalThreshold' => \$threshold/.test(body),
        'глобальный счётчик/порог (roulette_state, общий на всех игроков) по-прежнему попадает в $debug (для error_log)');
    assert(/'jackpotResetInfo' => \$jackpotResetInfo/.test(body), 'сброс джекпота (если сработал) логируется отдельно');
    assert((body.match(/error_log\('\[roulette\.spin\] ' \. json_encode\(\$debug\)/g) || []).length === 2,
        'обе ветки (rawLink-fallback + обычная) по-прежнему пишут $debug в error_log (серверная диагностика не урезана; есть ещё 2 ДРУГИХ error_log в spin() — guard-логи dev_force_roulette, не про это)');
    assert(!/'debug' => \$debug\]/.test(body),
        '10.10.2026: debug БОЛЬШЕ НЕ попадает в ответ клиенту ни в одной из двух веток output()/return output()');
}

console.log('\nTest 2: _rollSlot() — трассировка попыток избежать зарезервированных индексов (0/12)');
{
    const start = roulPhp.indexOf('private function _rollSlot(');
    // 29.09.2026: claimKeyring() удалён (был эксплойтом) — следующая функция после _rollSlot()
    // теперь _tryClaimKeyring() (внутренний хелпер pickCup()), используем её как новую границу.
    const end   = roulPhp.indexOf('private function _tryClaimKeyring(){');
    const body  = roulPhp.slice(start, end);
    // 29.09.2026 (ФИНАЛЬНОЕ уточнение тем же днём — "шанс 1/1000000, буквально на миллион
    // один выигравший"): "keyring доступен" ветка перестала быть отдельным циклом mt_rand —
    // теперь это одноразовый редкий ролл (не цикл), логируется отдельной строкой "СРАБОТАЛ".
    // Обычный цикл (do/while) остался ОДИН — общий для "недоступен" и "редкий ролл не сработал".
    assert(/if\(\$trace !== null\) \$trace\[\] = "keyring доступен \(КД истёк\), редкий ролл 1\/\{\$this->KEYRING_CHANCE_DENOM\} СРАБОТАЛ → idx=0";/.test(body),
        'редкий ролл keyring (1/1000000) логируется отдельной строкой при срабатывании');
    assert(/if\(\$trace !== null\) \$trace\[\] = "попытка#\$attempt idx=\$idx \(keyring недоступен ИЛИ редкий ролл не сработал — избегаем 12 и 0\)";/.test(body),
        'каждая попытка обычного ролла слота логируется (keyring недоступен ИЛИ редкий ролл не сработал)');
}

console.log('\nTest 3: openMinigame()/pickCup() — раскладка стаканчиков и итог выбора по-прежнему в error_log, но БОЛЬШЕ НЕ в ответе клиенту');
{
    assert(/'kushCounter' => \$kushCounter, 'kushThreshold' => \$kushThreshold, 'hasKush' => \$hasKush,/.test(roulPhp),
        'openMinigame(): куш-счётчик/порог/результат по-прежнему попадает в $debug (для error_log)');
    assert(/'cups' => \$cups,/.test(roulPhp), 'openMinigame(): полная раскладка 9 стаканчиков по-прежнему логируется (сервер знает, что реально положил)');
    assert(/\$debugBase = \['fn' => 'pickCup'/.test(roulPhp), 'pickCup(): debugBase по-прежнему собран с полным состоянием (включая allCups)');
    assert(/error_log\('\[roulette\.pickCup\] ' \. json_encode\(\$debugBase \+ \['result' => 'kush'\]\)\);/.test(roulPhp), 'pickCup(): ветка kush по-прежнему логируется');
    assert(/error_log\('\[roulette\.pickCup\] ' \. json_encode\(\$debugBase \+ \['result' => 'keyring', 'gotKeyring' => \$got\]\)\);/.test(roulPhp), 'pickCup(): ветка keyring по-прежнему логируется (включая исход гонки)');

    // 10.10.2026: ни одна из веток ответа клиенту (openMinigame() output() + все 4 исхода
    // pickCup() — kush/keyring-успех/keyring-провал/утешительный приз) больше не несёт 'debug'.
    const miniStart = roulPhp.indexOf('function openMinigame(){');
    const miniEnd   = roulPhp.indexOf('function pickCup(){');
    const miniBody  = roulPhp.slice(miniStart, miniEnd);
    assert(/output\(\['ok' => true\]\);/.test(miniBody), "openMinigame(): ответ клиенту — голый {ok:true}, без debug/cups");

    const pickStart = roulPhp.indexOf('function pickCup(){');
    const pickEnd   = roulPhp.length;
    const pickBody  = roulPhp.slice(pickStart, pickEnd);
    const okCalls = pickBody.match(/\$this->ops->ok\(\[[\s\S]*?\]\);/g) || [];
    assert(okCalls.length === 4, 'pickCup(): найдены все 4 ветки ответа клиенту (kush/keyring/missed_keyring/consolation)');
    assert(okCalls.every(c => !/'debug'/.test(c)), 'pickCup(): ни в одной из 4 веток ответа клиенту больше нет debug/debugBase');
}

console.log('\nTest 4: 10.10.2026 — клиент БОЛЬШЕ НЕ печатает debug для spin/openMinigame/pickCup (сервер его и не отдаёт), метки времени клика остались как были');
{
    assert(!/ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА \(debug\)/.test(roulJs),
        'dvor-roulette.js (spin) БОЛЬШЕ НЕ печатает debug — поля всё равно нет в ответе сервера');
    assert(/КЛИК крутить/.test(roulJs), 'dvor-roulette.js по-прежнему логирует момент клика (не debug-печать, не трогалось)');
    assert(!/ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА \(debug\)/.test(roulMinigameJs),
        'dvor-roulette-minigame.js (openMinigame/pickCup) БОЛЬШЕ НЕ печатает debug — поля всё равно нет в ответе сервера');
    assert(/КЛИК стаканчик/.test(roulMinigameJs), 'dvor-roulette-minigame.js по-прежнему логирует момент клика по стаканчику (не трогалось)');
    // 29.09.2026: отдельный TS.php('roulette.claimKeyring', ...) с собственным debug-принтом
    // убран (был эксплойтом) — выдача связки уходит в тот же ответ spin().
    //
    // 10.10.2026: openCase() (dvor-roulette-buy.js) НЕ входит в это ТЗ (его debug не содержит
    // счётчиков джекпота/куша/раскладки стаканчиков) — печать debug там осталась как была.
    assert(/ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА \(debug\)/.test(roulBuyJs), 'dvor-roulette-buy.js (openCase) — debug-печать НЕ трогалась, вне охвата этого ТЗ');
    assert(/КЛИК открыть кейс/.test(roulBuyJs), 'dvor-roulette-buy.js (openCase) логирует момент клика');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
