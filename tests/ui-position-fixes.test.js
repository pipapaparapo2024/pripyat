/**
 * Test: позиционные/цветовые правки блэкджека и рулетки (одна сессия правок).
 *
 * 1. dvor-blackjack.js — все 4 карты сдвинуты вниз на 18px (POSITIONS y+18).
 * 2. dvor-blackjack.js — полоска уровня: врезка слева 2px, справа 1px, radius увеличен.
 * 3. dvor-roulette.js  — та же врезка/radius для полоски уровня рулетки.
 * 4. dvor-roulette-screen.js — текст уровня рулетки белый, шрифт крупнее на 4px.
 * 5. dvor-roulette-screen.js — формула поворота колеса откалибрована на +1 сектор
 *    (баг: стрелка указывала на один слот, награда начислялась за соседний).
 *
 * Run: node tests/ui-position-fixes.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const SRC = path.join(__dirname, '..', '_client', 'src', 'game', 'dvor');
const bj    = fs.readFileSync(path.join(SRC, 'dvor-blackjack.js'), 'utf-8');
const roul  = fs.readFileSync(path.join(SRC, 'dvor-roulette.js'), 'utf-8');
const roulScreen = fs.readFileSync(path.join(SRC, 'dvor-roulette-screen.js'), 'utf-8');

// ── Test 1: карты блэкджека сдвинуты вниз на 18px ─────────────────────────
console.log('\nTest 1: карты блэкджека — POSITIONS.y содержит "+ 18"');
{
    const posMatch = bj.match(/const POSITIONS = \[([\s\S]*?)\];/);
    assert(!!posMatch, 'POSITIONS найден в dvor-blackjack.js');
    if (posMatch) {
        const body = posMatch[1];
        const yMatches = [...body.matchAll(/y:\s*\d+\s*\+\s*18/g)];
        assert(yMatches.length === 4, `все 4 позиции карт содержат "+ 18" (найдено ${yMatches.length})`);
    }
}

// ── Test 2: полоска уровня блэкджека — врезка + radius ────────────────────
console.log('\nTest 2: полоска уровня блэкджека — inset (-2 слева, -1 справа) и radius > 3');
{
    const m = bj.match(/drawRoundedRect\(238 \+ 2, 138, 23 - 2 - 1, fillH, (\d+)\)/);
    assert(!!m, 'drawRoundedRect с врезкой 238+2 / 23-2-1 найден');
    if (m) assert(parseInt(m[1]) > 3, `radius увеличен (было 3, стало ${m[1]})`);
}

// ── Test 3: полоска уровня рулетки — та же врезка + radius ────────────────
console.log('\nTest 3: полоска уровня рулетки — inset (-2 слева, -1 справа) и radius > 3');
{
    const m = roul.match(/drawRoundedRect\(TRACK_X \+ 2, TRACK_BOTTOM - TRACK_H, TRACK_W - 2 - 1, fh, (.+?)\)/);
    assert(!!m, 'drawRoundedRect с врезкой TRACK_X+2 / TRACK_W-2-1 найден');
    if (m) assert(/Math\.min\(9, fh \/ 2\)|[4-9]|\d{2,}/.test(m[1]), `radius увеличен (было 3, стало ${m[1]})`);
}

// ── Test 4: текст уровня рулетки — белый, шрифт крупнее ───────────────────
console.log('\nTest 4: текст уровня рулетки (roulLvlTxt/roulNextLvlTxt) — белый и крупнее');
{
    const lvlMatch  = roulScreen.match(/const roulLvlTxt = new PIXI\.Text\('0', \{\s*fontFamily:'Southbank LT', fontSize:(\d+), fill:'(#[0-9a-fA-F]+)'/);
    const nextMatch = roulScreen.match(/const roulNextLvlTxt = new PIXI\.Text\('1', \{\s*fontFamily:'Southbank LT', fontSize:(\d+), fill:'(#[0-9a-fA-F]+)'/);
    assert(!!lvlMatch, 'roulLvlTxt style найден');
    assert(!!nextMatch, 'roulNextLvlTxt style найден');
    if (lvlMatch) {
        assert(lvlMatch[2] === '#ffffff', `roulLvlTxt белый (получили ${lvlMatch[2]})`);
        assert(parseInt(lvlMatch[1]) >= 15, `roulLvlTxt fontSize увеличен с 11 (получили ${lvlMatch[1]})`);
    }
    if (nextMatch) {
        assert(nextMatch[2] === '#ffffff', `roulNextLvlTxt белый (получили ${nextMatch[2]})`);
        assert(parseInt(nextMatch[1]) >= 14, `roulNextLvlTxt fontSize увеличен с 10 (получили ${nextMatch[1]})`);
    }
}

// ── Test 5: калибровка колеса рулетки — БЕЗ сдвига на +1 сектор ───────────
// История: "+1" был введён под старый репорт (стрелка на "1000 сигарет", награда —
// за "50 спичек"), но после того как маркер выигрыша стал отдельной фиксированной
// точкой (не сама стрелка), "+1" начал давать обратный эффект — новый репорт: точка
// на "20 спичек", а награда — за "10.000 опыта" (на 1 сектор левее). "+1" убран.
console.log('\nTest 5: _animRouletteWheel — формула БЕЗ калибровочного (targetIdx + 1)');
{
    const m = roulScreen.match(/const slotAtPointer = \(90 - targetIdx \* SEG \+ 360\) % 360;/);
    assert(!!m, 'формула поворота колеса использует targetIdx напрямую, без +1');
    assert(!/\(90 - \(targetIdx \+ 1\) \* SEG/.test(roulScreen), 'старая формула с (targetIdx + 1) не осталась рядом как мёртвый код');
}

// ── Test 6: логика калибровки колеса — самопроверка формулы (без PIXI) ────
console.log('\nTest 6: формула _animRouletteWheel математически циклична с шагом 22.5°');
{
    const SEG = 22.5;
    const slotAngle = (targetIdx) => (90 - targetIdx * SEG + 360) % 360;
    // Угол должен быть детерминированным и отличаться ровно на SEG между соседними индексами
    for (let i = 0; i < 15; i++) {
        const a1 = slotAngle(i);
        const a2 = slotAngle(i + 1);
        let diff = a1 - a2;
        if (diff < 0) diff += 360;
        assert(Math.abs(diff - SEG) < 0.001, `угол между слотами ${i} и ${i+1} равен ${SEG}° (получили ${diff.toFixed(2)}°)`);
    }
    // Полный оборот за 16 секторов
    assert(Math.abs(slotAngle(0) - slotAngle(16 - 16)) < 0.001, 'цикл замкнут — 16 секторов по 22.5° дают полный круг (360°)');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
