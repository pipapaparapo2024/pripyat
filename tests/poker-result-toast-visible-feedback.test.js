/**
 * Test: батч 22.09.2026 (по прямому указанию, репорт "покер. слетели шансы, не выдаёт
 * награду") — расследование показало, что poker.php.resolve() ВСЕГДА честно начисляет
 * награду, сама механика (шансы/RNG) не сломана. Причина жалобы — _pokerResultTxt никогда не
 * добавлялся ни в один PIXI-контейнер, использовался ТОЛЬКО как строка для тоста в ОДНОМ
 * отдельном сценарии (повторный клик ИГРАТЬ поверх незавершённой раздачи, см.
 * _playPokerNewScreen). Обычное завершение раздачи не показывало игроку итог вообще, только
 * подсветку таблицы — из-за этого казалось, что награда не выдаётся, хотя сервер её честно
 * начислял каждый раз.
 *
 * Run: node tests/poker-result-toast-visible-feedback.test.js
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

const pokerGameSrc = readSrc('_client/src/game/dvor/dvor-poker-game.js');

console.log('\nTest 1: обычное завершение раздачи (_resolvePokerNewScreen) теперь показывает тост с итогом, не только подсветку');
{
    const start = pokerGameSrc.indexOf("TS.php('poker.resolve', {}, (res) => {");
    const end   = pokerGameSrc.indexOf('}, (err) => {', start);
    const body  = pokerGameSrc.slice(start, end);

    assert(/if\(this\._pokerResultTxt\) this\._pokerResultTxt\.text = '🃏 ' \+ res\.lbl \+ \(res\.sp \? '  \+'\+res\.sp\+'🟣' : ''\);/.test(body),
        '_pokerResultTxt.text по-прежнему заполняется итоговой строкой');
    assert(/if\(window\.notify && this\._pokerResultTxt && this\._pokerResultTxt\.text\) notify\.showResult\(\{text: this\._pokerResultTxt\.text\}, 1\);/.test(body),
        'новый тост показывает ту же строку игроку — раньше строка нигде не рендерилась при обычном резолве');
    assert(/this\._pokerShowComboHighlight\(res\.combo\);/.test(body), 'подсветка строки таблицы по-прежнему сохранена (не заменена, а дополнена тостом)');
}

console.log('\nTest 2: сценарий авто-резолва (повторный клик ИГРАТЬ поверх незавершённой раздачи) не сломан — та же строка, тот же тост, без дублирования');
{
    const start = pokerGameSrc.indexOf('if(this._pokerState === 1){');
    const end   = pokerGameSrc.indexOf('} else {', start);
    const body  = pokerGameSrc.slice(start, end);
    assert(/if\(window\.notify && this\._pokerResultTxt && this\._pokerResultTxt\.text\)\{/.test(body),
        'авто-резолв всё ещё показывает тост со старым итогом ПЕРЕД началом новой раздачи');
    assert(/notify\.showResult\(\{text: this\._pokerResultTxt\.text\}, 1\);/.test(body), 'использует тот же showResult, что и обычный путь');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
