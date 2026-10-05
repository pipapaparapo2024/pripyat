/**
 * Test: 26.09.2026, по прямому репорту ("всё также не работает переброс карты и кубиков") —
 *
 * dvor-dice-game.js._diceConfirmNewScreen() на ЛЮБУЮ ошибку dice.reroll (транзитную сеть/
 * гонку req_key ничуть не хуже, чем настоящее "заряды кончились") безусловно обнулял
 * this._diceSwapsLeft — что ПОЛНОСТЬЮ и НАВСЕГДА отключало переброс кубиков до конца раунда
 * после первой же неудачной попытки, даже если сама причина ошибки уже прошла к следующему
 * клику (см. dev-force-combo-500-and-reqkey-corruption-fix.test.js — один сбойный запрос
 * где-то ещё в сессии мог разово испортить req_key для СЛЕДУЮЩЕГО запроса).
 *
 * poker.swap() (dvor-poker-game.js) уже делает это правильно — обнуляет счётчик смен только
 * на конкретном коде "смены закончились" (83), для любой другой ошибки просто возвращает UI
 * в состояние "готов к повторной попытке". dice.reroll() приведён к тому же паттерну — code 69
 * ("заряды переброса кончились", dice.php.reroll()) обнуляет swapsLeft, всё остальное — нет.
 *
 * Run: node tests/dice-reroll-transient-error-no-permanent-lockout.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const diceGameSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice-game.js'), 'utf-8');
const pokerGameSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker-game.js'), 'utf-8');
const dicePhpSrc   = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'dice.php'), 'utf-8');

console.log('\nTest 1: dvor-dice-game.js — reroll обнуляет swapsLeft только на code 69 (заряды кончились)');
{
    const start = diceGameSrc.indexOf("TS.php('dice.reroll'");
    const body = diceGameSrc.slice(start, start + 3200);
    assert(/if\(err && err\.code === 69\) this\._diceSwapsLeft = 0;/.test(body),
        'обнуление swapsLeft перенесено под условие err.code === 69');
    assert(!/this\._diceSwapsLeft = 0; \/\/ сервер отказал/.test(body),
        'старое безусловное обнуление ("сервер отказал — не зацикливаемся") убрано');
}

console.log('\nTest 2: dice.php.reroll() — код 69 действительно означает "заряды переброса кончились"');
{
    const rerollStart = dicePhpSrc.indexOf('function reroll()');
    // 04.10.2026 (стале-пин, не регрессия — см. аудит гонок состояний): окно расширено, т.к.
    // reroll() теперь целиком обёрнут в _withUserLock(function(){...}) (tests/race-conditions-
    // skills-weapons-ryukzak-casino-04-10.test.js) — сама проверка кода 69 отъехала дальше по
    // файлу, инвариант (код 69 = заряды кончились) не менялся.
    const body = dicePhpSrc.slice(rerollStart, rerollStart + 1200);
    assert(/swapsUsed'\]\) >= intval\(\$active\['swapsAllowed'\]\)\) return \$this->ops->fail\(69\);/.test(body),
        'code 69 — единственный код исчерпания зарядов переброса в reroll()');
}

console.log('\nTest 3: poker.swap() уже использует тот же выборочный паттерн (эталон, не регресс)');
{
    assert(/if\(err && err\.code === 83\) this\._pokerSwapsLeft = 0;/.test(pokerGameSrc),
        'poker.swap — обнуление только на code 83, паттерн-эталон не тронут');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
