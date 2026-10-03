/**
 * Test: батч 19.09.2026 (по прямому указанию) — пункт 1 ниже ОТМЕНЁН батчем 22.09.2026, а
 * затем ЧАСТИЧНО ВЕРНУТ (уже, отдельно) батчем 22.09.2026 позже в тот же день. См. актуальное
 * состояние в Test 1.
 *
 *  1) [ОТМЕНЕНО 22.09.2026, затем ЧАСТИЧНО ВОЗВРАЩЕНО 22.09.2026] Репорт "не показываются
 *     награды за пары 9/пары 10 и т.д. (блэкджек)": вводился общий попап награды
 *     (iface._showRewardPopup) для ЛЮБОЙ пары. Репорт того же дня ("с каких пор вообще
 *     выводится попап награды в играх во дворе, такого быть не должно, верни как было раньше —
 *     просто прямоугольник вокруг того, что выиграл игрок") откатил это — рядовые пары снова
 *     получают только подсветку строки таблицы (_bjShowComboHighlight), без попапа. Позже,
 *     отдельным батчем ("нужно окно награды шмотки при АА, КК, QQ") — попап ВОЗВРАЩЁН, но
 *     СТРОГО УЖЕ: только когда res.shmot===true (только туз/король/дама, см.
 *     blackjack_config.json payouts), никогда для остальных пар. Test 1 ниже проверяет именно
 *     эту сузенную форму — попап вызывается, но обязательно внутри `if(res.shmot`.
 *  2) Репорт "купил хабар, но попап с наградой показался не поверх вкладки хабара": порядок
 *     операций в _buyAndOpen() вызывал _collectDay() (показывает попап награды, addChild в
 *     КОНЕЦ layer2_mc) ДО пересборки экрана хабара (которая тоже делает
 *     root.layer2_mc.addChild(this._pixiWin)) — свежесобранный экран оказывался ПОВЕРХ уже
 *     показанного попапа. Порядок изменён: сначала пересборка экрана, потом _collectDay().
 *
 * Run: node tests/blackjack-reward-popup-and-habar-zorder-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bjSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-blackjack.js'), 'utf-8');
const habarSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'habar.js'), 'utf-8');

console.log('\nTest 1: dvor-blackjack.js._resolveBlackjack — рядовые пары БЕЗ попапа (только подсветка), AA/KK/QQ — со своим попапом шмотки');
{
    const start = bjSrc.indexOf('proto._resolveBlackjack = function(){');
    const end   = bjSrc.indexOf("}, (err) => {", start);
    const body  = bjSrc.slice(start, end);
    assert(/this\._bjShowComboHighlight\(bestRank\);/.test(body), 'единственная безусловная обратная связь по результату раздачи — подсветка строки таблицы');
    // 22.09.2026 (второй раз в тот же день, отдельный батч — "нужно окно награды шмотки при
    // АА, КК, QQ"): попап ВЕРНУЛСЯ, но строго под условием res.shmot — не для любой пары.
    const popupIdx = body.indexOf('iface._showRewardPopup(');
    assert(popupIdx > -1, 'попап награды шмотки для AA/KK/QQ (iface._showRewardPopup) присутствует');
    const guardBefore = body.slice(Math.max(0, popupIdx - 600), popupIdx);
    assert(/if\(res\.shmot/.test(guardBefore), 'попап награды вызывается ТОЛЬКО внутри if(res.shmot ...) — не для любой пары');
}

console.log('\nTest 2: _bjResultTxt по-прежнему существует (не удалять поле — используется другим кодом), но текст сброшен, не дублирует попап');
{
    assert(/if\(this\._bjResultTxt\) this\._bjResultTxt\.text = '';/.test(bjSrc), '_bjResultTxt.text сбрасывается в пустую строку (не показывает невидимый дублирующий текст)');
}

console.log('\nTest 3: habar.js._buyAndOpen — пересборка экрана ПЕРЕД _collectDay(), не после');
{
    const start = habarSrc.indexOf('_buyAndOpen(idx){');
    const end   = habarSrc.indexOf('\n    }', habarSrc.indexOf('_collectDay(){'));
    const body  = habarSrc.slice(start, end);
    const rebuildIdx = body.indexOf('this._buildPixiWin();');
    const collectIdx = body.lastIndexOf('this._collectDay();');
    assert(rebuildIdx !== -1 && collectIdx !== -1 && rebuildIdx < collectIdx,
        '_buildPixiWin() (пересборка экрана + повторный addChild в layer2_mc) вызывается ДО _collectDay() (которая показывает попап награды) — попап гарантированно окажется топовым');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
