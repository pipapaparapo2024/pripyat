/**
 * Test: баг по репорту (картинка 14, "два вальта не отображаются") — гонка между кликом по
 * "ГОТОВО" и ещё летящим запросом blackjack.swap.
 *
 * Сценарий: игрок кликает по нижней карте (запускает blackjack.swap, ставит _bjReqInFlight=
 * true), не дожидаясь ответа сервера, сразу жмёт "ГОТОВО". Раньше _bjFinishSwap() безусловно
 * отключал карты, прятал кнопку ГОТОВО и вызывал _resolveBlackjack() — но тот сам молча
 * выходил по guard'у _bjReqInFlight (ещё true от swap), НИЧЕГО не отправляя на сервер. Итог:
 * зависшее состояние — финальная пара честно видна на столе, но подсветка таблицы выплат не
 * показывается, а нажать больше нечего (кнопка ГОТОВО уже скрыта, карты неинтерактивны).
 *
 * Фикс: guard _bjReqInFlight теперь проверяется В НАЧАЛЕ _bjFinishSwap(), ДО отключения UI —
 * клик по ГОТОВО во время ещё летящего swap просто игнорируется (кнопка/карты остаются
 * доступны), повторный клик после ответа сервера сработает как обычно.
 *
 * Run: node tests/bj-finish-swap-inflight-race-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-blackjack.js'), 'utf-8'
);

console.log('\nTest 1: _bjFinishSwap() проверяет _bjReqInFlight ДО отключения UI (не после)');
{
    const start = src.indexOf('proto._bjFinishSwap = function(){');
    const end   = src.indexOf('\n    };', start);
    const body  = src.slice(start, end);
    assert(start !== -1, '_bjFinishSwap найдена');

    const guardIdx  = body.indexOf('if(this._bjReqInFlight) return;');
    const loopIdx    = body.indexOf('for(let i = 0; i < 4; i++){');
    const doneHideIdx= body.indexOf('this._bjDoneBtn.visible = false;');
    const resolveIdx = body.indexOf('this._resolveBlackjack();');

    assert(guardIdx !== -1, 'guard _bjReqInFlight присутствует в _bjFinishSwap');
    assert(guardIdx !== -1 && loopIdx !== -1 && guardIdx < loopIdx, 'guard стоит ДО цикла отключения карт (raньше отключал карты безусловно)');
    assert(guardIdx !== -1 && doneHideIdx !== -1 && guardIdx < doneHideIdx, 'guard стоит ДО скрытия кнопки ГОТОВО');
    assert(guardIdx !== -1 && resolveIdx !== -1 && guardIdx < resolveIdx, 'guard стоит ДО вызова _resolveBlackjack()');
}

console.log('\nTest 2: путь автозавершения (когда swapsLeft исчерпан) не задет — вызывается из УЖЕ завершённого swap-колбэка');
{
    const swapStart = src.indexOf('proto._swapBlackjackCard = function(idx){');
    const swapEnd   = src.indexOf('\n    };', src.indexOf('_refreshSwapsDisplay();', swapStart));
    const swapBody  = src.slice(swapStart, swapEnd);
    assert(/this\._bjReqInFlight = false;[\s\S]*if\(this\._bjSwapsLeft <= 0\)\{\s*this\._bjFinishSwap\(\);/.test(swapBody),
        'автовызов _bjFinishSwap() при исчерпании смен происходит ПОСЛЕ this._bjReqInFlight=false — новый guard его не блокирует');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
