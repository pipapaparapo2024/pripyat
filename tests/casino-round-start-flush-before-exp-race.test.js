/**
 * Test: 28.09.2026, повторный репорт — "всё ещё проблема того что не сохраняются опыт и
 * уровень в азартных играх".
 *
 * Корень (после разбора): this._addExp(game, n) (dvor.js) в конце каждого раунда пишет
 * udata['dvor_games_data'] локально и сам зовёт flushPlayerSave(reason) — НО НЕ ЖДЁТ его
 * завершения (не блокирует игрока, не await'ит колбэк). Если игрок стартует СЛЕДУЮЩИЙ раунд
 * сразу же (частый сценарий — зарики/рулетка особенно быстрые, авто-режим рулетки почти
 * гарантированно успевает), запрос старта следующего раунда (dice.start / poker.deal /
 * blackjack.deal / roulette.spin) может долететь до сервера РАНЬШЕ, чем предыдущий flush.
 * Каждый из этих four endpoint'ов на сервере читает ПОЛНУЮ строку игрока через
 * Gameops::loadUser() (в т.ч. ещё СТАРЫЙ, без только что заработанного опыта, dvor_games_data)
 * и в конце своей обработки пишет её же обратно через saveUser() — если ЭТА запись коммитится
 * ПОСЛЕ того, как долетел flush с новым опытом, свежий опыт тихо затирается старым снимком.
 * Тот же класс гонки, что уже описан в памяти агента (incident_checkall_flush_wipes_server_
 * credits), только в обратную сторону: не клиентский флаш затирает серверную запись, а
 * серверная запись СЛЕДУЮЩЕГО запроса затирает клиентский флаш ПРЕДЫДУЩЕГО раунда.
 *
 * Асимметрия защиты ДО этого фикса (обнаружена при разборе):
 *   - dice.start      — был suspend/resume,        НЕ было flush-перед-запросом
 *   - poker.deal       — был suspend/resume,        НЕ было flush-перед-запросом
 *   - blackjack.deal   — был flush-перед-запросом,  НЕ было suspend/resume
 *   - roulette.spin    — НЕ было НИ ОДНОЙ защиты
 * Итог: 3 из 4 игр были уязвимы хотя бы с одной стороны, поэтому фикс от 0ad3f47
 * ("сохранение казино-опыта" — добавил только flushPlayerSave в сам _addExp) не закрыл
 * проблему полностью — не хватало именно защиты со стороны СЛЕДУЮЩЕГО раунда.
 *
 * Фикс: у всех четырёх round-start endpoint'ов теперь ОБЕ защиты —
 * flushPlayerSave(reason, () => { suspendPlayerSave(...); TS.php(...) }) — тот же
 * составной приём, что уже применён в zone.php.fillCheckpoint()/yashik.openBox().
 *
 * Run: node tests/casino-round-start-flush-before-exp-race.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game', 'dvor');
const fileCache = {};
function readFile(name){
    if (!fileCache[name]) fileCache[name] = fs.readFileSync(path.join(root, name), 'utf-8');
    return fileCache[name];
}

// { файл, endpoint, flushLabel, suspendLabel }
const CASES = [
    { file: 'dvor-dice-game.js',   endpoint: "TS.php('dice.start'",      flushLabel: 'dice_start_flush_prev_exp',      suspendLabel: 'dice_start' },
    { file: 'dvor-poker-game.js',  endpoint: "TS.php('poker.deal'",      flushLabel: 'poker_deal_flush_prev_exp',      suspendLabel: 'poker_deal' },
    { file: 'dvor-blackjack.js',   endpoint: "TS.php('blackjack.deal'",  flushLabel: 'blackjack_deal',                 suspendLabel: 'blackjack_deal' },
    { file: 'dvor-roulette.js',    endpoint: "TS.php('roulette.spin'",   flushLabel: 'roulette_spin_flush_prev_exp',   suspendLabel: 'roulette_spin' },
];

for (const { file, endpoint, flushLabel, suspendLabel } of CASES) {
    console.log(`\nTest: ${file} — ${endpoint.replace("TS.php('", '').replace("'", '')} (round-start)`);
    const src = readFile(file);

    const callIdx = src.indexOf(endpoint);
    assert(callIdx > -1, `вызов ${endpoint} найден`);
    if (callIdx === -1) continue;

    // 1) flushPlayerSave(flushLabel) стоит ПЕРЕД вызовом — гарантирует, что опыт/данные
    //    предыдущего раунда (записанные this._addExp() в dvor.js) уже долетели до сервера,
    //    прежде чем стартует новый раунд, который перезапишет ПОЛНУЮ строку игрока. Окно 2000
    //    символов — с запасом, некоторые endpoint'ы (poker.deal) уже несли длинный
    //    предшествующий комментарий про гонку poker_session до этой правки.
    const before = src.slice(Math.max(0, callIdx - 2000), callIdx);
    const flushRe = new RegExp(`flushPlayerSave\\('${flushLabel}', \\(\\) => \\{`);
    assert(flushRe.test(before), `flushPlayerSave('${flushLabel}') оборачивает запрос — ждёт сохранения предыдущего раунда`);

    // 2) suspendPlayerSave(suspendLabel) тоже стоит перед вызовом (внутри flush-колбэка) —
    //    защищает direct-write ЭТОГО запроса от встречного автосейва во время его полёта.
    const suspendRe = new RegExp(`suspendPlayerSave\\('${suspendLabel}'\\)`);
    assert(suspendRe.test(before), `suspendPlayerSave('${suspendLabel}') вызывается перед запросом`);

    // 3) resumePlayerSave вызывается минимум дважды (успех + ошибка) в пределах разумного окна
    //    после вызова — иначе suspend "зависнет" навсегда при сетевой ошибке.
    const after = src.slice(callIdx, callIdx + 3500);
    const resumeRe = new RegExp(`resumePlayerSave\\('${suspendLabel}'\\)`, 'g');
    const resumeCount = (after.match(resumeRe) || []).length;
    assert(resumeCount >= 2, `resumePlayerSave('${suspendLabel}') встречается минимум дважды (успех + ошибка), найдено: ${resumeCount}`);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
