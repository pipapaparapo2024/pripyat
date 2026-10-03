/**
 * Test: 23.09.2026 (по прямому указанию, репорт со скриншотом — "слишком большой отступ
 * сверху [в Моих достижениях], сделай такой же, как в топе по урону").
 *
 * svod-leaderboard.js (Топ по урону/авторитету/достижения — «Общий топ»): первая строка стоит
 * РОВНО у верхней границы видимой области (row.y = i*ROW_H, для строки 0 это 0) — никакого
 * дополнительного отступа внутри viewport нет.
 *
 * svod-achievements.js («Мои достижения»): сверх LIST_TOP (сдвинут вниз ради заголовков/анти-
 * бага утечки соседней карточки — эта причина НЕ трогается) ещё накручивался СВОЙ отдельный
 * CARD_TOP_OFFSET=34px — убран (=0), первая карточка тоже теперь стоит вплотную к верху
 * viewport, тот же принцип, что у лидерборда. LIST_H пересчитан автоматически (формула зависит
 * от CARD_TOP_OFFSET) — по-прежнему вмещает ровно 4 карточки (0 + 4*70 + 3*6 = 298).
 *
 * Run: node tests/svod-achievements-top-gap-matches-leaderboard.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const achSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');
const lbSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-leaderboard.js'), 'utf-8');

console.log('\nTest 1: CARD_TOP_OFFSET убран (=0) — первая карточка без лишнего внутреннего отступа');
{
    assert(/const CARD_TOP_OFFSET = 0;/.test(achSrc), 'CARD_TOP_OFFSET === 0 (было 34)');
    assert(!/const CARD_TOP_OFFSET = 14 \+ 20;/.test(achSrc), 'старое значение (14+20=34) не осталось');
}

console.log('\nTest 2: LIST_H — 25.09.2026: снят редактором позиций напрямую (286), больше не формула на 4 карточки');
{
    // Раньше LIST_H высчитывался формулой (вмещал ровно 4 карточки, 298px). 25.09.2026
    // пользователь вручную уменьшил окно списка через редактор позиций (маска сделана
    // редактируемой, см. svod-scroll.js) до 286px — это НЕ пересчёт по прежней формуле, а
    // прямое значение, независимое от CARD_TOP_OFFSET/CARD_VISIBLE_H/CARD_GAP.
    assert(/const LIST_TOP = 242, LIST_H = 286;/.test(achSrc),
        'LIST_H = 286 — явное значение из редактора позиций (было формулой = 298)');
}

console.log('\nTest 3: LIST_TOP — 25.09.2026: тоже снят редактором позиций напрямую (242)');
{
    assert(/const LIST_TOP = 242,/.test(achSrc),
        'LIST_TOP = 242 (было 169+36+38=243 по формуле, снято отдельно через редактор позиций)');
}

console.log('\nTest 4: sanity — у лидерборда (эталон) первая строка тоже без внутреннего отступа (row.y = i*ROW_H)');
{
    assert(/row\.y = i \* ROW_H;/.test(lbSrc),
        'svod-leaderboard.js: строка i=0 получает row.y=0 — нулевой внутренний отступ, тот же принцип, что теперь применён к достижениям');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
