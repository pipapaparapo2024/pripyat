/**
 * Test: покер не должен "терять" выигрыш игрока.
 *
 * Требование пользователя:
 *  1) Пока игроку доступна смена карт и он её ещё не израсходовал — награда НЕ выдаётся
 *     (ждём, пока он явно нажмёт СЫГРАТЬ или потратит все смены).
 *  2) Если игрок израсходовал ВСЕ доступные смены — награда выдаётся автоматически,
 *     не дожидаясь отдельного нажатия СЫГРАТЬ.
 *  3) Если игрок ничего не стал менять и просто нажал ИГРАТЬ ЗАНОВО (за фишку/тушенку) —
 *     старая (неподтверждённая) раздача должна сначала разрешиться и начислить награду
 *     (видимую игроку через тост), и только потом должна начаться новая раздача — раньше
 *     это состояние просто перезатиралось новой раздачей без начисления.
 *
 * Run: node tests/poker-swap-resolve.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-poker-game.js'), 'utf-8'
);

// 18.09.2026 (перенос Покера на сервер, см. tests/poker-server-authoritative.test.js): смена
// теперь честно выполняется на сервере (poker.swap), клиент лишь применяет res.swapsLeft —
// счётчик больше не декрементируется локально (`this._pokerSwapsLeft--`), это устранило бы
// саму возможность рассинхронизации со счётчиком на сервере. Раздача/резолв — тоже запросы
// (poker.deal/poker.resolve), поэтому "разрешить зависшую раздачу, потом раздать новую" теперь
// реализовано ЧЕРЕЗ ОЖИДАНИЕ асинхронного resolve (onDone-колбэк), а не последовательным кодом.

// ── Test 1: _togglePokerSwap авто-резолвит после исчерпания всех смен ────────
console.log('\nTest 1: _togglePokerSwap применяет swapsLeft от сервера и подводит итог, как только смены закончились');
{
    const m = src.match(/proto\._togglePokerSwap = function\(idx\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_togglePokerSwap найден');
    if (m) {
        const body = m[1];
        assert(/this\._pokerSwapsLeft = res\.swapsLeft;/.test(body),
            'счётчик смен берётся из ответа сервера (poker.swap), не декрементируется локально — сервер единственный источник истины');
        assert(/if\(this\._pokerSwapsLeft <= 0\) this\._pokerConfirmNewScreen\(\);/.test(body),
            'как только смены исчерпаны (<=0) — сразу вызывается подведение итога, не дожидаясь ручного СЫГРАТЬ');
    }
}

const playStart = src.indexOf('proto._playPokerNewScreen = function(useChip){');
const playEnd   = src.indexOf('proto._runPokerShuffleAnimation');
const playBody  = src.slice(playStart, playEnd);

// ── Test 2: _playPokerNewScreen не позволяет "потерять" непоказанный выигрыш ─
console.log('\nTest 2: _playPokerNewScreen ждёт разрешения зависшей раздачи (async resolve), потом раздаёт новую');
{
    assert(/if\(this\._pokerState === 1\)\{/.test(playBody),
        'проверяет, не осталась ли предыдущая раздача неподтверждённой (state===1)');
    assert(/this\._pokerConfirmNewScreen\(\(\) => \{/.test(playBody),
        'ждёт завершения резолва старой раздачи через onDone-колбэк, а не запускает deal() сразу параллельно (иначе deal() перезапишет poker_session раньше, чем resolve() успеет его прочитать на сервере)');
    assert(/notify\.showResult\(\{text: this\._pokerResultTxt\.text\}, 1\);/.test(playBody),
        'показывает тостом текст результата (уже выставленный сервером к моменту вызова onDone) — иначе он мгновенно исчезнет под новой раздачей, и игрок его не увидит');
    assert((playBody.match(/doDeal\(\);/g) || []).length === 2,
        'doDeal() вызывается дважды: один раз после тоста (зависшая раздача), один раз напрямую (обычный путь)');
}

// ── Test 3: обычный путь (нет зависшей раздачи) не задет — doDeal() вызывается напрямую ──
console.log('\nTest 3: при отсутствии зависшей раздачи (state !== 1) doDeal() вызывается напрямую, без резолва/тоста');
{
    assert(/\}\s*else\s*\{\s*\n\s*doDeal\(\);\s*\n\s*\}/.test(playBody),
        'ветка "нет зависшей раздачи" — прямой безусловный doDeal(), резолв/тост не вызываются лишний раз');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
