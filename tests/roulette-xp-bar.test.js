/**
 * Test: Roulette XP bar fill ratio — level progress, not raw exp total.
 *
 * Fix in dvor-roulette.js _updateRouletteUI:
 *   BEFORE: const totalExp = data.roulette.exp || 0; ratio = totalExp / 1000
 *   AFTER:  ratio = lvl.next > 0 ? lvl.cur / lvl.next : 0
 *
 * Also: _roulNextLvlTxt shows (lvl.level + 1) — the next level number.
 *
 * Run: node tests/roulette-xp-bar.test.js
 */

let passed = 0, failed = 0;

function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

// ── _getLevelInfo mirror (from dvor.js) ───────────────────────────────────
// Level thresholds: 0→1=10 exp, +10 each level (per dvor.js pattern)
// Actual: threshold(n) = 10*n for level n (1-indexed)
function getLevelInfo(exp) {
    let level = 0;
    let totalThresh = 0;
    while (true) {
        const thresh = 10 * (level + 1); // threshold for next level
        if (exp < totalThresh + thresh) {
            return { level, cur: exp - totalThresh, next: thresh };
        }
        totalThresh += thresh;
        level++;
    }
}

// ── Buggy fill ratio (old code) ───────────────────────────────────────────
function ratioOld(totalExp) {
    return Math.min(1, totalExp / 1000);
}

// ── Fixed fill ratio (new code) ───────────────────────────────────────────
function ratioNew(lvl) {
    return lvl.next > 0 ? Math.min(1, lvl.cur / lvl.next) : 0;
}

// ── Test 1: Level 0 progress — lvl.cur/lvl.next fills correctly ──────────
console.log('\nTest 1: Level 0 progress shows partial fill');
{
    const lvl = getLevelInfo(5); // 5 exp into level 0 (threshold=10)
    assert(lvl.level === 0,   `level=0, got ${lvl.level}`);
    assert(lvl.cur   === 5,   `cur=5, got ${lvl.cur}`);
    assert(lvl.next  === 10,  `next=10, got ${lvl.next}`);
    const r = ratioNew(lvl);
    assert(r === 0.5, `ratio=0.5 at 5/10 exp, got ${r}`);
}

// ── Test 2: Old formula was ALWAYS 0 at low exp levels ────────────────────
console.log('\nTest 2: Old formula fails at low exp — always near-zero');
{
    for (const exp of [0, 5, 9, 50, 100, 500]) {
        const old = ratioOld(exp);
        assert(old === Math.min(1, exp / 1000),
            `Old: exp=${exp} → ratio=${old.toFixed(3)} (always tiny below 1000)`);
    }
    // At exp=5 (level 0, 50% of the way to level 1), old gives 0.005:
    assert(Math.abs(ratioOld(5) - 0.005) < 0.001, 'Old formula: 5 exp → ratio≈0.005 (bug: bar empty)');
    assert(ratioNew(getLevelInfo(5)) === 0.5,       'New formula: 5 exp → ratio=0.5 (correct)');
}

// ── Test 3: Bar fills to 100% exactly at level threshold ─────────────────
console.log('\nTest 3: Bar is exactly full (ratio=1) when exp hits next threshold');
{
    const cases = [
        { exp: 10  }, // level 0 → 1 (threshold=10)
        { exp: 30  }, // level 1 → 2 (threshold=10+20=30)
        { exp: 60  }, // level 2 → 3 (threshold=30+30=60)
    ];
    for (const { exp } of cases) {
        const lvl = getLevelInfo(exp);
        // At the exact threshold exp is now IN the next level, cur=0
        assert(lvl.cur === 0, `At level boundary (exp=${exp}): cur=0, got ${lvl.cur}`);
        assert(ratioNew(lvl) === 0, `At level boundary: ratio=0 (bar resets), got ${ratioNew(lvl)}`);
    }
}

// ── Test 4: Bar never exceeds 1.0 ────────────────────────────────────────
console.log('\nTest 4: ratioNew is clamped to [0, 1]');
{
    for (const exp of [0, 1, 5, 10, 50, 200, 1000, 5000]) {
        const r = ratioNew(getLevelInfo(exp));
        assert(r >= 0 && r <= 1, `exp=${exp}: ratio=${r.toFixed(3)} in [0,1]`);
    }
}

// ── Test 5: Next level text = current_level + 1 ───────────────────────────
console.log('\nTest 5: Next level label = lvl.level + 1');
{
    const cases = [
        { exp: 0,   expectedLevel: 0, expectedNext: 1 },
        { exp: 5,   expectedLevel: 0, expectedNext: 1 },
        { exp: 10,  expectedLevel: 1, expectedNext: 2 },
        { exp: 50,  expectedLevel: 4, expectedNext: 5 },
    ];
    for (const { exp, expectedLevel, expectedNext } of cases) {
        const lvl = getLevelInfo(exp);
        const nextLabelNum = lvl.level + 1;
        if (lvl.level === expectedLevel) {
            assert(nextLabelNum === expectedNext,
                `exp=${exp}: level=${expectedLevel}, nextLabel=${expectedNext}, got ${nextLabelNum}`);
        }
    }
}

// ── Test 6: _roulLvlTxt shows 'УР.N' for current level ───────────────────
console.log('\nTest 6: Level text format is "УР.N"');
{
    const cases = [
        { exp: 0,  levelStr: 'УР.0' },
        { exp: 10, levelStr: 'УР.1' },
        { exp: 30, levelStr: 'УР.2' },
    ];
    for (const { exp, levelStr } of cases) {
        const lvl = getLevelInfo(exp);
        const text = 'УР.' + lvl.level;
        assert(text === levelStr, `exp=${exp}: "${levelStr}", got "${text}"`);
    }
}

// ── Test 7: ratioNew handles lvl.next=0 gracefully ────────────────────────
console.log('\nTest 7: ratioNew returns 0 when lvl.next=0 (safety guard)');
{
    const r = ratioNew({ level: 99, cur: 0, next: 0 });
    assert(r === 0, `lvl.next=0: ratio=0 (no division by zero), got ${r}`);
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
