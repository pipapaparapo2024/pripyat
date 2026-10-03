/**
 * Test: 18.09.2026 — отступ первой карточки в "Мои достижения" сверху.
 * По прямому указанию: отступ сверху для первой карточки 10px, шаг между карточками — тоже
 * 10px (последнее уже было — CARD_GAP=10). Раньше первая карточка стояла вплотную к верху
 * списка (card.y = 0 при i=0), без отступа.
 *
 * 21.09.2026 (обновлено вместе с аккордеоном, см. svod-achievements-accordion-expand.test.js) —
 * фиксированная формула card.y = CARD_TOP_OFFSET + i*(CARD_H+CARD_GAP) заменена на динамический
 * расчёт (переменная высота при развороте тем), но сам ОТСТУП по-прежнему берёт начало именно
 * от CARD_TOP_OFFSET (бегущий y инициализируется этим значением) — проверяем это, а не точную
 * старую формулу.
 *
 * Run: node tests/achievement-card-top-offset.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8'
);

// 22.09.2026 (по прямому указанию, редактор позиций): отступ первой карточки сверху сначала
// +4px (10→14), затем ещё +20px (14→34) — см.
// svod-achievements-spacing-name-pos-and-leaderboard-avatar-mask-fix.test.js и
// svod-icon-position-rounding-and-subtab-sync-fix.test.js для полного фикса.
// 23.09.2026 (по прямому указанию — "убери лишний отступ, сделай как в топе по урону"):
// CARD_TOP_OFFSET убран обратно до 0 — первая карточка снова стоит вплотную к верху viewport,
// как строка 0 в svod-leaderboard.js. Формула (бегущий y / totalContentH стартуют от
// CARD_TOP_OFFSET) не менялась — меняется только его значение.
console.log('\nTest 1: CARD_TOP_OFFSET = 0, применён и к бегущей позиции карточек, и к расчёту высоты скролла');
{
    assert(/const CARD_TOP_OFFSET = 0;/.test(src), 'CARD_TOP_OFFSET объявлен и равен 0 (было 34, убран 23.09.2026)');
    assert(/let y = CARD_TOP_OFFSET;/.test(src),
        'бегущий накопитель y (динамический layout) стартует именно с отступа CARD_TOP_OFFSET, а не с 0');
    assert(/let totalContentH = CARD_TOP_OFFSET;/.test(src),
        'начальное значение высоты скролла тоже учитывает отступ (до первого refresh)');
}

console.log('\nTest 2: шаг между карточками (CARD_GAP) уменьшен на 4px — 6px, было 10px');
{
    assert(/const CARD_W = 672, CARD_GAP = 6;/.test(src), 'CARD_GAP=6 (было 10, -4 по указанию)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
