/**
 * Test: батч 22.09.2026 (по прямому указанию, репорт "в покере и рулетки нет попап
 * предупреждение стоимости открытия сумки") — подтверждение стоимости ПЕРЕД списанием,
 * переиспользует уже существующий _showConfirmPopup (тот же, что у рюкзака, ryukzak.js).
 *
 * Попутно найден и починен блокирующий баг: _showConfirmPopup(text, onYes, onNo) принимал
 * параметр text, но НИГДЕ его не отрисовывал — попап подтверждения показывался БЕЗ вопроса.
 * Затрагивало ВСЕ существующие вызовы (ryukzak.js "Открыть рюкзак за 20 тушёнки?", yashik.js
 * "Забрать награду?"), не только новые вызовы этого батча.
 *
 * Run: node tests/casino-bag-cost-confirm-and-confirm-popup-text-fix.test.js
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

const confirmSrc = readSrc('_client/src/game/shell/popups/confirm.js');
const pokerBagSrc = readSrc('_client/src/game/dvor/dvor-poker-bag.js');
const roulBuySrc  = readSrc('_client/src/game/dvor/dvor-roulette-buy.js');

console.log('\nTest 1: confirm.js — использует универсальный текст, уже вшитый в фон попапа');
{
    const start = confirmSrc.indexOf('proto._showConfirmPopup = function');
    const end   = confirmSrc.indexOf('\n\t\tthis._confirmWin = win;', start);
    const body  = confirmSrc.slice(start, end);
    assert(!/new PIXI\.Text\(text/.test(body), 'не накладывает динамический текст поверх надписи из popup_confirm.png');
    assert(/popup_confirm\.png/.test(body), 'использует общий фон с готовым текстом подтверждения');
}

console.log('\nTest 2: dvor-poker-bag.js — открытие сумки теперь требует подтверждения с указанием стоимости');
{
    const start = pokerBagSrc.indexOf("openBtn.on('pointerdown', ()=>{");
    const end   = pokerBagSrc.indexOf('\n        });', start);
    const body  = pokerBagSrc.slice(start, end);
    assert(/iface\._showConfirmPopup\('Открыть сумку за ' \+ cost \+ ' голубых спичек\?', \(\) => \{/.test(body),
        'вызывает _showConfirmPopup с текстом, явно включающим стоимость (150 спичек)');
    assert(/this\._reallyOpenPokerBag\(cost, have, win\);/.test(body), 'реальное списание вынесено в отдельный метод, вызываемый ТОЛЬКО после согласия');
    assert(!/udata\['roulette_spichki'\] = \(have - cost\)\.toString\(\);\s*\n\s*if\(win\.parent\) win\.parent\.removeChild\(win\);\s*\n\s*this\._pokerBagWin = null;\s*\n\s*if\(this\._pokerWin\) this\._updatePokerUI\(\);\s*\n\s*this\._openPokerBagOpenedScreen\(\);\s*\n\s*\}\);\s*\n\s*win\.addChild\(openBtn\);/.test(pokerBagSrc),
        'старое безусловное списание прямо в pointerdown-обработчике убрано (перенесено в _reallyOpenPokerBag)');

    const reallyStart = pokerBagSrc.indexOf('proto._reallyOpenPokerBag = function');
    const reallyEnd   = pokerBagSrc.indexOf('\n    };', reallyStart);
    const reallyBody  = pokerBagSrc.slice(reallyStart, reallyEnd);
    // 22.09.2026: списание перенесено на сервер (poker.php.openBag(), server-authoritative —
    // см. tests/roulette-poker-spichki-open-server-authoritative.test.js) — client-side
    // мутация udata['roulette_spichki'] убрана, теперь это делает TS.php-запрос.
    assert(/TS\.php\('poker\.openBag', \{\}, \(res\) => \{/.test(reallyBody), '_reallyOpenPokerBag() выполняет фактическое списание через server-authoritative poker.openBag');
    // 23.09.2026: экран результата теперь получает готовую награду от сервера (см. poker.php.
    // openBag()/_rollSlot-подобный ролл наград) — сигнатура выросла до (reward, clientRewards).
    // 25.09.2026 (регресс найден повторным прогоном тестов): следом добавился третий параметр
    // hasTatu (тату-дроп тоже переехал на сервер, см. casino-bag-tatu-shmot-server-authoritative
    // .test.js) — сигнатура вызова выросла ещё раз, до (reward, clientRewards, hasTatu).
    assert(/this\._openPokerBagOpenedScreen\(res\.reward, res\.clientRewards \|\| \[\], !!res\.hasTatu\);/.test(reallyBody), '_reallyOpenPokerBag() открывает экран результата после списания, передавая готовую награду от сервера');
}

console.log('\nTest 3: dvor-roulette-buy.js — открытие кейса тоже требует подтверждения с указанием стоимости');
{
    const start = roulBuySrc.indexOf("openBtn.on('pointerdown', ()=>{");
    const end   = roulBuySrc.indexOf('\n        });', start);
    const body  = roulBuySrc.slice(start, end);
    assert(/iface\._showConfirmPopup\('Открыть кейс за ' \+ cost \+ ' голубых спичек\?', _reallyOpen\);/.test(body),
        'вызывает _showConfirmPopup с текстом, явно включающим стоимость (150 спичек)');
    assert(/const _reallyOpen = \(\) => \{/.test(body), 'реальное списание вынесено в отдельную функцию, вызываемую ТОЛЬКО после согласия');
    assert(/if\(!window\.iface \|\| typeof iface\._showConfirmPopup !== 'function'\)\{ _reallyOpen\(\); return; \}/.test(body),
        'есть безопасный fallback, если iface._showConfirmPopup почему-то недоступен — не блокирует игру полностью');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
