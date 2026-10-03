/**
 * Test: батч 25.09.2026 (репорт: "бирка с ценой (1 монета) мигает во время игры в блэкджек,
 * прямо поверх кнопки ВСКРЫТЬСЯ") —
 *
 * Причина: _renderBlackjackDailyStatus() вызывается раз в секунду через _bjDailyTimer
 * (обратный отсчёт "БЕСПЛАТНО ЧЕРЕЗ hh:mm:ss") и безусловно выставлял
 * _bjFreeLbl.visible=true / _bjPriceSpr.visible=!isFree на КАЖДОМ тике — это перебивало явное
 * скрытие обеих меток при старте раунда (this._bjPlaying=true) уже на следующей секунде,
 * отсюда и "моргание" бирки прямо поверх игрового стола/кнопки ВСКРЫТЬСЯ.
 *
 * Фикс: пока раунд идёт (this._bjPlaying===true) — метод выходит сразу, не трогая обе метки.
 *
 * Run: node tests/blackjack-price-badge-blink-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-blackjack.js'), 'utf-8');

console.log('\n1) _renderBlackjackDailyStatus() выходит сразу, если раунд уже идёт (this._bjPlaying)');
{
    const start = src.indexOf('proto._renderBlackjackDailyStatus = function');
    const end   = src.indexOf('\n    };', start);
    const body  = src.slice(start, end);

    const guardIdx = body.indexOf('if(this._bjPlaying) return;');
    assert(guardIdx !== -1, 'guard "if(this._bjPlaying) return;" присутствует в теле функции');

    const freeLblIdx  = body.indexOf('_bjFreeLbl.visible = true');
    const priceSprIdx = body.indexOf('_bjPriceSpr.visible = !isFree');
    assert(guardIdx !== -1 && freeLblIdx !== -1 && guardIdx < freeLblIdx,
        'guard стоит РАНЬШЕ выставления _bjFreeLbl.visible (раунд блокирует весь остальной код функции)');
    assert(guardIdx !== -1 && priceSprIdx !== -1 && guardIdx < priceSprIdx,
        'guard стоит РАНЬШЕ выставления _bjPriceSpr.visible');
}

console.log('\n2) this._bjPlaying реально существует и управляется стартом/концом раунда (не только что придуманное поле)');
{
    assert(/this\._bjPlaying = true;/.test(src), 'this._bjPlaying = true выставляется при старте раунда (после ответа сервера на blackjack.play)');
    assert(/this\._bjPlaying = false;/.test(src), 'this._bjPlaying = false выставляется при завершении раунда');
}

console.log('\n3) Реальный прогон через мини-интерпретатор — тик таймера ПОСЛЕ старта раунда не включает бирку обратно');
{
    // Минимальная симуляция состояния объекта proto без PIXI — проверяем именно ЛОГИКУ метода,
    // а не паттерн-матчинг текста.
    const start = src.indexOf('proto._renderBlackjackDailyStatus = function');
    const end   = src.indexOf('\n    };', start);
    const fnBody = src.slice(start + 'proto._renderBlackjackDailyStatus = '.length, end + '\n    };'.length - 1);

    const ctx = {
        _bjPlaying: true,
        _bjServerFree: false,
        _bjNextFreeAt: 0,
        _bjFreeLbl:  { visible: false, text: '' },
        _bjPriceSpr: { visible: false },
    };
    const fn = eval('(' + fnBody + ')');
    fn.call(ctx);
    assert(ctx._bjFreeLbl.visible === false, 'во время раунда _bjFreeLbl остаётся скрытым после вызова (реальный вызов функции, не текстовый поиск)');
    assert(ctx._bjPriceSpr.visible === false, 'во время раунда _bjPriceSpr остаётся скрытым после вызова');

    // После окончания раунда — метод снова работает как обычно (показывает бирку, если не бесплатно).
    ctx._bjPlaying = false;
    fn.call(ctx);
    assert(ctx._bjPriceSpr.visible === true, 'после конца раунда (_bjPlaying=false) бирка снова показывается по обычной логике (!isFree)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
