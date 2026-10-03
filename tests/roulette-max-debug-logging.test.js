/**
 * Test: 23.09.2026 (по прямому указанию, превентивно — тот же класс логирования, что у
 * блэкджека) — максимальное логирование в spin()/openCase()/openMinigame()/
 * pickCup() (roulette.php) + печать в консоль браузера (dvor-roulette*.js).
 * 29.09.2026: claimKeyring() удалён (был эксплойтом, см. tests/roulette-global-jackpot-kush-keyring.test.js (структура) и roulette-wheel-visual-keyring-cooldown-impossible.test.js (Monte-Carlo)),
 * выдача связки колеса ушла в spin(), отдельный debug-вывод для неё больше не нужен.
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

console.log('\nTest 1: spin() — трассировка глобального джекпот-счётчика (roulette_state) и слот-ролла');
{
    const start = roulPhp.indexOf('function spin(){');
    const end   = roulPhp.indexOf('private function _rollSlot(');
    const body  = roulPhp.slice(start, end);
    assert(/'globalCounterAfterIncrement' => \$counter, 'globalThreshold' => \$threshold/.test(body),
        'глобальный счётчик/порог (roulette_state, общий на всех игроков) попадает в debug');
    assert(/'jackpotResetInfo' => \$jackpotResetInfo/.test(body), 'сброс джекпота (если сработал) логируется отдельно');
    assert(/'debug' => \$debug\] \+ \$slotResult\)/.test(body), 'debug передаётся клиенту в ответе');
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

console.log('\nTest 3: openMinigame()/pickCup() — раскладка стаканчиков и итог выбора в debug');
{
    assert(/'kushCounter' => \$kushCounter, 'kushThreshold' => \$kushThreshold, 'hasKush' => \$hasKush,/.test(roulPhp),
        'openMinigame(): куш-счётчик/порог/результат в debug');
    assert(/'cups' => \$cups,/.test(roulPhp), 'openMinigame(): полная раскладка 9 стаканчиков логируется (сервер знает, что реально положил)');
    assert(/\$debugBase = \['fn' => 'pickCup'/.test(roulPhp), 'pickCup(): debugBase собран с полным состоянием');
    assert(/error_log\('\[roulette\.pickCup\] ' \. json_encode\(\$debugBase \+ \['result' => 'kush'\]\)\);/.test(roulPhp), 'pickCup(): ветка kush логируется');
    assert(/error_log\('\[roulette\.pickCup\] ' \. json_encode\(\$debugBase \+ \['result' => 'keyring', 'gotKeyring' => \$got\]\)\);/.test(roulPhp), 'pickCup(): ветка keyring логируется (включая исход гонки)');
}

console.log('\nTest 4: клиент печатает debug + метки времени клика во всех точках входа');
{
    assert(/ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА \(debug\)/.test(roulJs), 'dvor-roulette.js (spin) печатает debug');
    assert(/КЛИК крутить/.test(roulJs), 'dvor-roulette.js логирует момент клика');
    assert(/ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА \(debug\)/.test(roulMinigameJs), 'dvor-roulette-minigame.js (openMinigame/pickCup) печатает debug');
    assert(/КЛИК стаканчик/.test(roulMinigameJs), 'dvor-roulette-minigame.js логирует момент клика по стаканчику');
    // 29.09.2026: отдельный TS.php('roulette.claimKeyring', ...) с собственным debug-принтом
    // убран (был эксплойтом) — выдача связки уходит в тот же ответ spin(), чей debug уже
    // проверен выше (dvor-roulette.js, "ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА"), отдельный вывод для
    // dvor-roulette-screen.js этой веткой больше не нужен.
    assert(/КЛИК открыть кейс/.test(roulBuyJs), 'dvor-roulette-buy.js (openCase) логирует момент клика');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
