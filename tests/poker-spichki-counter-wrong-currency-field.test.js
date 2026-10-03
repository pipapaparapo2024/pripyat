/**
 * Test: 27.09.2026 (по прямому указанию — репорт "спички не выдаются за покер, у тебя по идее
 * это прописано"). Расследование (в т.ч. байт-в-байт сверка server/core/controllers/poker.php и
 * server/json/poker_config.json с живым сервером 155.212.211.202 по SFTP) подтвердило, что
 * poker.php.resolve() честно начисляет udata['poker_spichki'] (straight/three_of_a_kind/
 * high_card — суммарно ~85% раздач по roll_table) и корректно кладёт его в patch, а клиент
 * (dvor-poker-game.js._resolvePokerNewScreen) корректно применяет applyPatch(res.patch) ДО
 * resumePlayerSave() — награда реально долетает и сохраняется.
 *
 * Настоящая причина жалобы — dvor-poker-screen.js._updatePokerUI(): счётчик "спички" на самом
 * экране покера (this._pokerSpichkiTxt, x=333,y=418 — сразу под счётчиком фишек) копипастой
 * читал ЧУЖУЮ валюту udata['roulette_spichki'] (спички РУЛЕТКИ, отдельное поле udata, см.
 * CLAUDE.md "Поля udata" — poker_spichki и roulette_spichki это два разных поля) вместо
 * udata['poker_spichki']. Игрок видел постоянный счётчик, который не рос от побед в покере
 * (он и не должен расти — это счётчик другой игры), хотя toast с "+50🟣"/"+300🟣"
 * (poker-result-toast-visible-feedback.test.js) на самом деле показывался каждый раз.
 *
 * Run: node tests/poker-spichki-counter-wrong-currency-field.test.js
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

const screenSrc = readSrc('_client/src/game/dvor/dvor-poker-screen.js');

console.log('\nTest 1: счётчик спичек на экране покера читает poker_spichki, а не roulette_spichki');
{
    const line = screenSrc.split('\n').find(l => l.includes('_pokerSpichkiTxt') && l.includes('.text ='));
    assert(!!line, 'строка обновления _pokerSpichkiTxt.text найдена в _updatePokerUI');
    assert(line && /udata\['poker_spichki'\]/.test(line),
        'читает udata[\'poker_spichki\'] (валюта покера, начисляется poker.php.resolve())');
    assert(line && !/udata\['roulette_spichki'\]/.test(line),
        'больше НЕ читает udata[\'roulette_spichki\'] (чужая валюта — спички рулетки, регрессия от 27.09.2026)');
}

console.log('\nTest 2: соседний счётчик фишек (_pokerChipsTxt) не задет фиксом — по-прежнему читает poker_chips');
{
    // 27.09.2026 (фикс собственного теста, найден при полном прогоне tests/ перед деплоем):
    // строка выравнена пробелами под соседнюю "_pokerSpichkiTxt.text = ..." (короче имя —
    // больше пробелов перед "="), поэтому точный '.text =' (один пробел) не совпадал —
    // допускаем любое количество пробелов вокруг "=".
    const line = screenSrc.split('\n').find(l => l.includes('_pokerChipsTxt') && /\.text\s*=/.test(l));
    assert(!!line, 'строка обновления _pokerChipsTxt.text найдена');
    assert(line && /udata\['poker_chips'\]/.test(line), 'по-прежнему читает udata[\'poker_chips\']');
}

console.log('\nTest 3: в dvor-poker-screen.js активный код (не комментарии) больше не читает roulette_spichki');
{
    // 27.09.2026 (фикс собственного теста): бланкетный запрет на саму подстроку "roulette_spichki"
    // ложно бил по объясняющему комментарию рядом с фиксом (описывает СУТЬ бага, который тут же
    // исправлен) — реальная проверка регрессии это отсутствие АКТИВНОГO чтения udata['roulette_spichki'],
    // не запрет упоминать название поля в прозе комментария.
    const activeLines = screenSrc.split('\n').filter(l => !l.trim().startsWith('//'));
    assert(!activeLines.some(l => l.includes("udata['roulette_spichki']")),
        'ни одна активная (не закомментированная) строка экрана покера не читает udata[\'roulette_spichki\'] — это валюта другой игры (рулетки)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
