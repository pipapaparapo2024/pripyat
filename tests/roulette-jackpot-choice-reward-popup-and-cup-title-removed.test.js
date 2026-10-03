/**
 * Test: 26.09.2026, по прямому репорту (со скриншотами) — два независимых фикса мини-игры
 * стаканчиков (dvor-roulette-minigame.js):
 *
 * 1) Кнопка ЗАБРАТЬ в выборе "забрать 500р / рискнуть" (_openJackpotChoice) раньше только тихо
 *    меняла мелкий this._roulResultTxt на основном экране рулетки — если игрок не смотрел туда
 *    в момент клика, выглядело так, будто "попап награды не появляется вообще". Путь через
 *    риск (стаканчики) уже показывал полноценные попапы (_openConsolationPrize/_openJackpotPrize)
 *    с новыми ассетами — не хватало ровно этого, самого простого пути. Теперь использует тот же
 *    стандартный попап награды, что и везде в игре (iface._showRewardPopup).
 *
 * 2) Заголовок "ВЫБЕРИ СТАКАНЧИК" над рядом стаканчиков убран по прямому указанию.
 *
 * Run: node tests/roulette-jackpot-choice-reward-popup-and-cup-title-removed.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-minigame.js'), 'utf-8');

console.log('\nTest 1: заголовок "ВЫБЕРИ СТАКАНЧИК" убран целиком');
{
    assert(!/ВЫБЕРИ СТАКАНЧИК/.test(src), 'строка "ВЫБЕРИ СТАКАНЧИК" нигде не осталась в файле');
}

console.log('\nTest 2: кнопка ЗАБРАТЬ (гарантированный приз) показывает стандартный попап награды');
{
    const start = src.indexOf('proto._openJackpotChoice = function()');
    const end   = src.indexOf('\n    };', start);
    const body  = src.slice(start, end);
    const takeBtnStart = body.indexOf("takeBtn.on('pointerdown'");
    const takeBtnBody  = body.slice(takeBtnStart);

    assert(/TS\.php\('roulette\.claimPrize'/.test(takeBtnBody), 'по-прежнему честно запрашивает приз у сервера');
    assert(/applyPatch\(res\.patch\)/.test(takeBtnBody), 'применяет патч сервера');
    assert(/if\(window\.iface\) iface\._showRewardPopup\(\[\{type:'coins', amount: jackpotAmount\}\]\);/.test(takeBtnBody),
        'показывает стандартный попап награды (iface._showRewardPopup) с типом coins и суммой jackpotAmount');
    assert(/else if\(this\._roulResultTxt\)/.test(takeBtnBody),
        'старое обновление this._roulResultTxt оставлено как фолбэк, если iface недоступен, не как основной путь');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
