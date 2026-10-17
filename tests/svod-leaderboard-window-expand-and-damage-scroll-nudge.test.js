/**
 * Test: 17.10.2026, по прямому указанию (уточнено в диалоге через AskUserQuestion):
 *
 *  1) Окно списка «Топ по авторитету» (Общий топ/Друзья) и «Топ по достижениям → Общий топ»
 *     расширено до x:356,y:236,w:669,h:286 (x/y/w уже совпадали с ROW_X/LIST_TOP/ROW_W —
 *     менялась только высота, 242→286). «Топ по урону» — пользователь явно подтвердил НЕ
 *     трогать, остаётся 242.
 *  2) «Топ по урону»: пользователь настаивал, что трек/бегунок/стрелки реально стоят в других
 *     пикселях, чем у авторитета/достижений (несмотря на общую функцию/координаты) — по его
 *     прямому указанию сдвинуты на 2px влево (trackX/arrowX 1035/1034 → 1033/1032), только
 *     для cat===0 (урон), авторитет/достижения не тронуты.
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

console.log('\nTest 1: svod-leaderboard.js — LIST_H_EXPANDED=286, viewH берёт tabCfg.listH с фолбэком на дефолт (242)');
{
    assert(/const LIST_H_EXPANDED = 286;/.test(lbSrc), 'LIST_H_EXPANDED = 286 объявлена');
    assert(/viewH: tabCfg\.listH \|\| LIST_H,/.test(lbSrc), 'viewH = tabCfg.listH || LIST_H — без override остаётся прежним (242)');
}

console.log('\nTest 2: svod.js — respect (авторитет) и ach (cat:5, достижения) передают listH:286, damage (урон) — НЕ передаёт');
{
    const respectStart = svodSrc.indexOf("key === 'respect'");
    const respectEnd   = svodSrc.indexOf("key === 'damage'");
    assert(/listH: 286,/.test(svodSrc.slice(respectStart, respectEnd)), 'respect передаёт listH:286');

    const damageStart = svodSrc.indexOf("key === 'damage'");
    const damageEnd   = svodSrc.indexOf("key === 'ach'");
    assert(!/listH:/.test(svodSrc.slice(damageStart, damageEnd)), 'damage (урон) НЕ передаёт listH — остаётся дефолтным 242');

    const achStart = svodSrc.indexOf("cat: 5, bg:");
    const achBlock = svodSrc.slice(achStart, achStart + 400);
    assert(/listH: 286,/.test(achBlock), 'ach (cat:5, достижения → Общий топ) передаёт listH:286');
}

console.log('\nTest 3: svod-leaderboard.js — «Топ по урону» (cat===0) получает трек/стрелку на -2px по X, остальные — дефолт');
{
    assert(/const DAMAGE_SCROLL_TRACK_X = SCROLL_TRACK_X - 2, DAMAGE_SCROLL_ARROW_X = SCROLL_ARROW_X - 2;/.test(lbSrc),
        'DAMAGE_SCROLL_TRACK_X/ARROW_X = SCROLL_TRACK_X/ARROW_X - 2');
    assert(/trackX: tabCfg\.cat === 0 \? DAMAGE_SCROLL_TRACK_X : SCROLL_TRACK_X,/.test(lbSrc),
        'trackX условный — DAMAGE_SCROLL_TRACK_X только для cat===0 (урон)');
    assert(/arrowX: tabCfg\.cat === 0 \? DAMAGE_SCROLL_ARROW_X : SCROLL_ARROW_X,/.test(lbSrc),
        'arrowX условный — DAMAGE_SCROLL_ARROW_X только для cat===0 (урон)');
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
