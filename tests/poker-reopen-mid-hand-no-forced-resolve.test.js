/**
 * Test: 29.09.2026, репорт игрока — "если выйти из казино во время раздачи карт или костей,
 * когда ещё есть возможность сменить кубик/карту, и снова зайти (в том числе через
 * перезагрузку страницы) — игра как бы ничего не сохраняет, так быть не должно".
 *
 * tests/dvor-session-resume-poker-dice-blackjack.test.js (25.09.2026) уже закрыл ОДНУ причину
 * этого симптома — восстановление раздачи ПОСЛЕ ПЕРЕЗАГРУЗКИ СТРАНИЦЫ (poker.getSession/
 * dice.getSession/blackjack.status + client-side _pokerRestoreSession/_diceRestoreSession/
 * _bjRestoreSession). Этот тест закрывает ВТОРУЮ, отдельную причину, которая осталась даже
 * после того фикса — конкретно и только в покере, БЕЗ какой-либо перезагрузки:
 *
 * dvor-poker.js._openPokerScreen() — если экран покера закрыт (кнопкой ВЫХОД, переключением на
 * другую вкладку Двора и т.п.) ПОСРЕДИ незавершённой раздачи (this._pokerState === 1, раздача
 * ещё жива в JS-памяти этого же объекта Dvor, страница не перезагружалась), при ПОВТОРНОМ
 * открытии экрана раньше стоял вызов this._pokerConfirmNewScreen() — а это тот же метод, что и
 * кнопка ПОДТВЕРДИТЬ: он немедленно шлёт poker.resolve() на сервер и ЗАВЕРШАЕТ раздачу целиком,
 * даже если у игрока ещё оставались доступные смены карт. То есть просто выйти на лобби Двора и
 * зайти в покер обратно молча ЗАБИРАЛО у игрока оставшиеся смены и подводило итог за него —
 * именно то поведение, которое пользователь описал как "игра ничего не меняет/не сохраняет
 * возможные действия".
 *
 * Зарики и блэкджек этой ошибки никогда не имели — при this._diceState===1/this._bjPlaying===true
 * повторное открытие их экранов просто ничего не делает (раздача продолжает висеть как есть,
 * что и требуется) — это поведение и взято за образец правильного фикса.
 *
 * Фикс: вместо принудительного resolve — просто перерисовать текущее (уже корректное в памяти)
 * состояние теми же функциями, что использует _pokerRestoreSession() при восстановлении после
 * перезагрузки (_pokerUpdateCards()/_updatePokerSwapButtons()) — экран покажет ровно ту же
 * раздачу с ровно тем же остатком смен, ничего не отправляя на сервер и не завершая партию.
 *
 * Run: node tests/poker-reopen-mid-hand-no-forced-resolve.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root    = path.join(__dirname, '..');
const pokerJs = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker.js'), 'utf-8');
const diceJs  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice.js'), 'utf-8');
const bjJs    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-blackjack.js'), 'utf-8');

console.log('\nTest 1: dvor-poker.js._openPokerScreen() — повторное открытие экрана посреди активной раздачи (state===1) БОЛЬШЕ НЕ вызывает принудительный resolve');
{
    const start = pokerJs.indexOf('proto._openPokerScreen = function(){');
    assert(start !== -1, '_openPokerScreen найден');
    const end = pokerJs.indexOf('\n    };', start);
    const body = pokerJs.slice(start, end);

    const stateBranchIdx = body.indexOf('if(this._pokerState === 1){');
    assert(stateBranchIdx !== -1, 'ветка "раздача уже активна" (this._pokerState === 1) присутствует');

    const sessionCheckIdx = body.indexOf("else if(!this._pokerSessionChecked){");
    assert(sessionCheckIdx !== -1, 'ветка восстановления после перезагрузки (_pokerSessionChecked) присутствует рядом');

    const stateBranchBody = body.slice(stateBranchIdx, sessionCheckIdx);
    assert(!/_pokerConfirmNewScreen\(\)/.test(stateBranchBody),
        'КРИТИЧНО: ветка state===1 больше НЕ вызывает _pokerConfirmNewScreen() (тот самый принудительный resolve)');
    assert(/this\._pokerUpdateCards\(\);/.test(stateBranchBody),
        'вместо этого перерисовывает карты — _pokerUpdateCards()');
    assert(/this\._updatePokerSwapButtons\(\);/.test(stateBranchBody),
        'и обновляет кнопки/счётчик смен — _updatePokerSwapButtons()');
}

console.log('\nTest 2: регресс-гвард — _pokerConfirmNewScreen (принудительный resolve) остаётся доступным ТОЛЬКО как ручное действие игрока (кнопка ПОДТВЕРДИТЬ / исчерпание смен), не удалён как функция');
{
    assert(/proto\._pokerConfirmNewScreen = function\(onDone\)\{/.test(
        fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker-game.js'), 'utf-8')
    ), '_pokerConfirmNewScreen всё ещё определена (кнопка ПОДТВЕРДИТЬ и авто-resolve при 0 смен по-прежнему работают)');
}

console.log('\nTest 3: зарики/блэкджек — образец правильного поведения не тронут (при активной раздаче повторное открытие экрана ничего принудительно не завершает)');
{
    // Дайс: единственная проверка при открытии — читать сессию с сервера, если ещё не читали
    // за эту загрузку страницы; никакого "если уже играем — завершить" ответвления нет вообще.
    const diceOpenStart = diceJs.indexOf('proto._openDiceScreen = function(){');
    const diceOpenEnd   = diceJs.indexOf('\n    };', diceOpenStart);
    const diceOpenBody  = diceJs.slice(diceOpenStart, diceOpenEnd);
    assert(!/resolve/i.test(diceOpenBody), 'dvor-dice.js._openDiceScreen() не содержит вызовов resolve — открытие экрана никогда не завершает бросок само по себе');

    const bjOpenStart = bjJs.indexOf('proto._openBlackjackScreen = function(){');
    const bjOpenEnd   = bjJs.indexOf('\n    };', bjOpenStart);
    const bjOpenBody  = bjJs.slice(bjOpenStart, bjOpenEnd);
    assert(!/resolve/i.test(bjOpenBody), 'dvor-blackjack.js._openBlackjackScreen() не содержит вызовов resolve — открытие экрана никогда не завершает раздачу само по себе');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
