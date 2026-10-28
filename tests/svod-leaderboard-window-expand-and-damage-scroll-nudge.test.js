/**
 * Test: 17.10.2026 (по прямому указанию) → ОТМЕНЕНО/унифицировано 28.10.2026.
 *
 * Было (17.10.2026): «Топ по авторитету»/«Топ по достижениям» получили расширенное окно списка
 * (h:286, через tabCfg.listH), «Топ по урону» остался на 242 и отдельно получил трек/стрелку
 * скролла со сдвигом -2px по X (DAMAGE_SCROLL_TRACK_X/ARROW_X) — то есть «урон» был НАМЕРЕННО
 * особым случаем, а не образцом.
 *
 * 28.10.2026 (по прямому указанию — унификация скролла Сводки, подтверждено явно: "беру точные
 * координаты у Топ по урону... ставлю те же самые у Топ по авторитету/Топ по достижениям/Мои
 * достижения"): расхождение признано багом визуального несовпадения между вкладками, а не
 * фичей — роли поменялись местами. Теперь «урон» — ЭТАЛОН: единое окно списка
 * x:354,y:238,w:669,h:263 и единый trackX/arrowX:1033/1032 для ВСЕХ трёх вкладок топа (плюс
 * аккордеона «Мои достижения» в svod-achievements.js). tabCfg.listH и DAMAGE_SCROLL_TRACK_X/
 * ARROW_X убраны из кода целиком.
 *
 * Run: node tests/svod-leaderboard-window-expand-and-damage-scroll-nudge.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const lbSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-leaderboard.js'), 'utf-8');
const svodSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod.js'), 'utf-8');

console.log('\nTest 1: svod-leaderboard.js — ЕДИНОЕ окно списка (354,238,669,263) для всех вкладок, LIST_H_EXPANDED/tabCfg.listH убраны');
{
    assert(!/const LIST_H_EXPANDED/.test(lbSrc), 'LIST_H_EXPANDED больше не объявляется — расхождение высот убрано');
    assert(!/viewH:\s*tabCfg\.listH/.test(lbSrc), 'viewH больше не читает tabCfg.listH — один LIST_H на всех');
    assert(/const ROW_X = 354;/.test(lbSrc), 'ROW_X = 354 (единое значение)');
    assert(/const LIST_TOP = 238;/.test(lbSrc), 'LIST_TOP = 238 (единое значение)');
    assert(/const LIST_H = 263;/.test(lbSrc), 'LIST_H = 263 (единое значение, заменяет 242/286)');
    assert(/viewH: LIST_H,/.test(lbSrc), 'viewH всегда = LIST_H, без условного override');
}

console.log('\nTest 2: svod.js — respect/ach больше НЕ передают listH (параметр убран как мёртвый вместе с унификацией)');
{
    assert(!/listH: 286,/.test(svodSrc), 'listH:286 нигде не передаётся — высота теперь одна для всех вкладок');
}

console.log('\nTest 3: svod-leaderboard.js — «Топ по урону» больше НЕ особый случай: единый trackX/arrowX для всех вкладок (эталон — бывшие значения «урона», 1033/1032)');
{
    assert(!/DAMAGE_SCROLL_TRACK_X/.test(lbSrc), 'DAMAGE_SCROLL_TRACK_X убрана — расхождение по X устранено');
    assert(!/DAMAGE_SCROLL_ARROW_X/.test(lbSrc), 'DAMAGE_SCROLL_ARROW_X убрана');
    assert(/const SCROLL_TRACK_X = 1033, SCROLL_ARROW_X = 1032;/.test(lbSrc),
        'единый trackX/arrowX = 1033/1032 (бывшие "урон"-only значения, теперь эталон для всех)');
    assert(/trackX: SCROLL_TRACK_X,/.test(lbSrc), 'trackX передаётся без условия по tabCfg.cat');
    assert(/arrowX: SCROLL_ARROW_X,/.test(lbSrc), 'arrowX передаётся без условия по tabCfg.cat');
}

console.log('\nTest 4: svod.js — damage (урон, cat:0) конфиг не менялся сверх необходимого (secondScope/bg/cat как раньше)');
{
    const damageStart = svodSrc.indexOf("key === 'damage'");
    const damageEnd   = svodSrc.indexOf("key === 'ach'");
    const block = svodSrc.slice(damageStart, damageEnd);
    assert(/cat: 0, bg: 'задний фон топы по урону\.png', valueLabel: 'УРОН',/.test(block), 'damage tabCfg.cat/bg/valueLabel не менялись');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
