/**
 * Test: 25.09.2026, найдено при расследовании ДРУГОГО репорта (наградные ссылки — просматривал
 * php_errors.log живого сервера) — poker.php и dice.php._verifySaved() безусловно логировали
 * "ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ" на КАЖДОМ deal()/swap()/resolve()/
 * start(), даже когда данные были полностью корректны.
 *
 * Причина: mismatch считался как $verifyRaw !== $expectedRaw, где $expectedRaw — JSON-строка
 * (только что подготовленная перед saveUser()), а $verifyRaw — результат loadUser() ПОСЛЕ
 * записи, который database.php.trueJSON() уже раскодировал в PHP-МАССИВ (poker_session/
 * dice_session не в исключении $isStringField — и не должны быть, это настоящие JSON-массивы).
 * Строка !== массив — always true, что и порождало ложную тревогу каждый раз (в т.ч. видно в
 * консоли браузера пользователя: "!!! записанное и прочитанное обратно значение разошлись !!!").
 *
 * Тот же класс ошибки уже был разобран и исправлен в Gameops::sameJsonState() (см. её докблок) и
 * уже применялся в blackjack.php — poker.php/dice.php остались на старой самописной проверке
 * при более раннем рефакторинге. Оба переведены на общий sameJsonState().
 *
 * Run: node tests/poker-dice-verifysaved-samejsonstate-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const pokerSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'poker.php'), 'utf-8');
const diceSrc  = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'dice.php'), 'utf-8');
const bjSrc    = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'blackjack.php'), 'utf-8');

console.log('\nTest 1: poker.php._verifySaved() использует Gameops::sameJsonState(), не голое !==');
{
    const start = pokerSrc.indexOf('private function _verifySaved($expectedRaw){');
    assert(start !== -1, '_verifySaved() найден');
    const end = pokerSrc.indexOf('\n        }', start);
    const body = pokerSrc.slice(start, end);

    assert(/'mismatch' => !\$this->ops->sameJsonState\(\$expectedRaw, \$verifyRaw\)/.test(body),
        'mismatch считается через sameJsonState() (устойчиво к строка-vs-массив)');
    assert(!/'mismatch' => \(\$verifyRaw !== \$expectedRaw\)/.test(body),
        'старая голая !== проверка убрана целиком');
}

console.log('\nTest 2: dice.php._verifySaved() — тот же фикс');
{
    const start = diceSrc.indexOf('private function _verifySaved($expectedRaw){');
    assert(start !== -1, '_verifySaved() найден');
    const end = diceSrc.indexOf('\n        }', start);
    const body = diceSrc.slice(start, end);

    assert(/'mismatch' => !\$this->ops->sameJsonState\(\$expectedRaw, \$verifyRaw\)/.test(body),
        'mismatch считается через sameJsonState()');
    assert(!/'mismatch' => \(\$verifyRaw !== \$expectedRaw\)/.test(body),
        'старая голая !== проверка убрана целиком');
}

console.log('\nTest 3: регресс-гвард — blackjack.php (уже был корректен) не тронут, продолжает использовать sameJsonState()');
{
    assert(/!\$this->ops->sameJsonState\(\$user\['blackjack_session'\], \$verifyRaw\)/.test(bjSrc),
        'blackjack.php по-прежнему использует sameJsonState() напрямую (эталон, с которого скопирован фикс)');
}

console.log('\nTest 4: все 3 места вызова _verifySaved() в каждом файле не переименовывались (deal/swap/resolve — poker; start/swap/resolve — dice)');
{
    assert((pokerSrc.match(/\$this->_verifySaved\(/g) || []).length === 3, 'poker.php — ровно 3 вызова _verifySaved() (deal/swap/resolve)');
    assert((diceSrc.match(/\$this->_verifySaved\(/g) || []).length === 3, 'dice.php — ровно 3 вызова _verifySaved() (start/swap/resolve)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
