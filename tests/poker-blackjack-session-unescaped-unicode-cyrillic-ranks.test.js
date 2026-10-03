/**
 * Test: батч 24.09.2026 (по прямому указанию + скриншот — выпала "две пары" (2♠2♦3♠3♦K♣), но
 * подсветилась не та ячейка и начислена награда "старшая карта" (50 спичек) вместо "две пары"
 * (5 стволов); вопрос "можешь ли ты вообще определять комбинации в покере?").
 *
 * Разбор консольного лога подтвердил: deal()'s debug.actualComboAtDeal = "two_pair" (верно,
 * для СВЕЖЕСГЕНЕРИРОВАННОЙ, ещё не сохранённой руки), а resolve()'s combo = "high_card" —
 * для ТОЙ ЖЕ САМОЙ руки (swapsUsed=0), уже прошедшей через БД. _evaluateHand() не менялась и
 * не виновата — сломан был round-trip: json_encode($session) БЕЗ JSON_UNESCAPED_UNICODE
 * экранирует кириллицу рангов ("двойка" и т.п.) как "\uXXXX", а database.php.toSQL() вставляет
 * эту строку в SQL-литерал без mysqli_real_escape_string() — MySQL молча съедает обратный слэш
 * у нераспознанного escape-символа "\u", и при следующем чтении ранг превращается в мусорную
 * строку ("u0434..." вместо "двойка"), ничего не матчащую в RANKS каталога → всегда high_card.
 * Тот же класс уязвимости нашёлся и в blackjack_session (тоже хранит кириллические ранги).
 *
 * Run: node tests/poker-blackjack-session-unescaped-unicode-cyrillic-ranks.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const pokerSrc     = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'poker.php'), 'utf-8');
const blackjackSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'blackjack.php'), 'utf-8');

console.log('\nTest 1: все 3 записи poker_session используют JSON_UNESCAPED_UNICODE');
{
    const writes = (pokerSrc.match(/\$user\['poker_session'\] = json_encode\(\$session[^)]*\);/g) || []);
    assert(writes.length === 3, 'найдено ровно 3 записи poker_session (deal/swap/resolve)');
    assert(writes.every(w => w.includes('JSON_UNESCAPED_UNICODE')), 'КРИТИЧНО: каждая запись poker_session передаёт JSON_UNESCAPED_UNICODE — иначе кириллица рангов бьётся при SQL round-trip');
}

console.log('\nTest 2: регресс-гвард — не осталось ни одной записи poker_session БЕЗ флага');
{
    assert(!/\$user\['poker_session'\] = json_encode\(\$session\);/.test(pokerSrc), 'нет записей poker_session со старой (без флага) сигнатурой json_encode');
}

console.log('\nTest 3: все 4 записи blackjack_session используют JSON_UNESCAPED_UNICODE (тот же класс бага, тот же фикс)');
{
    const writes = (blackjackSrc.match(/\$user\['blackjack_session'\] = json_encode\(\$session[^)]*\);/g) || []);
    assert(writes.length === 4, 'найдено ровно 4 записи blackjack_session');
    assert(writes.every(w => w.includes('JSON_UNESCAPED_UNICODE')), 'КРИТИЧНО: каждая запись blackjack_session передаёт JSON_UNESCAPED_UNICODE');
    assert(!/\$user\['blackjack_session'\] = json_encode\(\$session\);/.test(blackjackSrc), 'нет записей blackjack_session со старой (без флага) сигнатурой json_encode');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
