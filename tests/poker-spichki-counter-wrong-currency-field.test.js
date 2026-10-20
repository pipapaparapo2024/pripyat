/**
 * Test: 27.09.2026 (по прямому указанию — репорт "спички не выдаются за покер, у тебя по идее
 * это прописано"). Расследование (в т.ч. байт-в-байт сверка server/core/controllers/poker.php и
 * server/json/poker_config.json с живым сервером 155.212.211.202 по SFTP) подтвердило, что
 * poker.php.resolve() честно начисляет валюту (straight/three_of_a_kind/high_card — суммарно
 * ~85% раздач по roll_table) и корректно кладёт её в patch, а клиент
 * (dvor-poker-game.js._resolvePokerNewScreen) корректно применяет applyPatch(res.patch) ДО
 * resumePlayerSave() — награда реально долетает и сохраняется.
 *
 * Тогда настоящая причина жалобы была в dvor-poker-screen.js._updatePokerUI(): счётчик
 * "спички" на экране покера копипастой читал ЧУЖУЮ (на тот момент) валюту roulette_spichki
 * вместо poker_spichki — poker_spichki и roulette_spichki были РАЗНЫМИ полями.
 *
 * 20.10.2026 (по прямому указанию — "это должны быть одинаковые спички, исправь"): решение
 * пересмотрено — обе валюты ОБЪЕДИНЕНЫ в одну общую (канонический столбец roulette_spichki, см.
 * poker.php.openBag()/server/json/poker_config.json). Счётчик на экране покера СНОВА читает
 * udata['roulette_spichki'] — на этот раз НЕ регрессия 27.09.2026, а буквально одна и та же
 * валюта с рулеткой (poker_spichki — мёртвое поле, старый баланс перенесён server/migrate49.php).
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

console.log('\nTest 1: счётчик спичек на экране покера читает roulette_spichki (общая валюта, объединена 20.10.2026)');
{
    const line = screenSrc.split('\n').find(l => l.includes('_pokerSpichkiTxt') && l.includes('.text ='));
    assert(!!line, 'строка обновления _pokerSpichkiTxt.text найдена в _updatePokerUI');
    assert(line && /udata\['roulette_spichki'\]/.test(line),
        'читает udata[\'roulette_spichki\'] (общая валюта покера и рулетки после объединения 20.10.2026)');
    assert(line && !/udata\['poker_spichki'\]/.test(line),
        'больше не читает мёртвое поле udata[\'poker_spichki\'] (старый баланс перенесён server/migrate49.php)');
}

console.log('\nTest 2: соседний счётчик фишек (_pokerChipsTxt) не задет фиксом — по-прежнему читает poker_chips');
{
    // 27.09.2026 (фикс собственного теста, найден при полном прогоне tests/ перед деплоем):
    // строка выравнена пробелами под соседнюю "_pokerSpichkiTxt.text = ..." (короче имя —
    // больше пробелов перед "="), поэтому точный '.text =' (один пробел) не совпадал —
    // допускаем любое количество пробелов вокруг "=".
    const line = screenSrc.split('\n').find(l => l.includes('_pokerChipsTxt') && /\.text\s*=/.test(l));
    assert(!!line, 'строка обновления _pokerChipsTxt.text найдена');
    assert(line && /udata\['poker_chips'\]/.test(line), 'по-прежнему читает udata[\'poker_chips\'] (отдельная от спичек валюта, не задета объединением)');
}

console.log('\nTest 3: в dvor-poker-screen.js активный код (не комментарии) больше не читает мёртвое poker_spichki');
{
    const activeLines = screenSrc.split('\n').filter(l => !l.trim().startsWith('//'));
    assert(!activeLines.some(l => l.includes("udata['poker_spichki']")),
        'ни одна активная (не закомментированная) строка экрана покера не читает мёртвое поле udata[\'poker_spichki\']');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
