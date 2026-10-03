/**
 * Test: Boss fight weapon attack count display — shows qty÷mult, МАКС removed.
 *
 * Changes in bosses_fight.js _refreshWeaponBtns:
 *   BEFORE: dmgLbl.text = formatKK((base+flat)*mult)  — shows damage
 *           totalOpts = opts.length + 1               — included МАКС slot
 *   AFTER:  dmgLbl.text = floor(qty/mult)+'x'         — shows attack count
 *           totalOpts = opts.length                   — МАКС removed
 *
 * Run: node tests/boss-attack-count.test.js
 */

let passed = 0, failed = 0;

function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

// ── Mirror of bosses.MULT_OPTIONS ────────────────────────────────────────
const MULT_OPTIONS = [1, 10, 50, 100, 500, 1000];

// Attack count formula (matches new _refreshWeaponBtns)
function attackCount(qty, mult) {
    return mult > 0 ? Math.floor(qty / mult) : 0;
}

// Multiplier label (matches new _refreshWeaponBtns)
function multLabel(mi) {
    const mult = MULT_OPTIONS[mi] || 1;
    return mult >= 1000 ? '×1K' : '×' + mult;
}

// Cycle index — МАКС removed, wraps within opts.length
function cycleMultIdx(currentIdx) {
    return (currentIdx + 1) % MULT_OPTIONS.length;
}

// ── Test 1: Attack count formula floor(qty/mult) ──────────────────────────
console.log('\nTest 1: Attack count = floor(qty / mult)');
{
    const cases = [
        { qty:100,  mult:1,    expected:100  },
        { qty:100,  mult:10,   expected:10   },
        { qty:100,  mult:50,   expected:2    },
        { qty:100,  mult:100,  expected:1    },
        { qty:100,  mult:500,  expected:0    },
        { qty:1000, mult:1000, expected:1    },
        { qty:999,  mult:1000, expected:0    },
        { qty:55,   mult:10,   expected:5    }, // floor, not round
        { qty:0,    mult:1,    expected:0    },
        { qty:1,    mult:1,    expected:1    },
    ];
    for (const { qty, mult, expected } of cases) {
        const got = attackCount(qty, mult);
        assert(got === expected, `qty=${qty} ÷ mult=${mult} = ${expected}, got ${got}`);
    }
}

// ── Test 2: attackCount with zero qty shows 0 (no label shown) ────────────
console.log('\nTest 2: Zero qty produces 0 attacks (label hidden)');
{
    for (const mult of MULT_OPTIONS) {
        assert(attackCount(0, mult) === 0, `qty=0 mult=${mult}: 0 attacks`);
    }
}

// ── Test 3: МАКС index no longer exists in cycle ──────────────────────────
console.log('\nTest 3: Multiplier cycle stays within MULT_OPTIONS — no МАКС slot');
{
    let idx = 0;
    const visited = [];
    for (let i = 0; i < MULT_OPTIONS.length * 2 + 2; i++) {
        visited.push(idx);
        idx = cycleMultIdx(idx);
    }
    const maxSlot = MULT_OPTIONS.length; // old МАКС was at this index
    assert(!visited.includes(maxSlot), `Index ${maxSlot} (МАКС) never reached`);
    // Cycle must return to 0 after opts.length steps
    assert(visited[MULT_OPTIONS.length] === 0, 'Cycle wraps back to index 0');
    assert(visited[MULT_OPTIONS.length * 2] === 0, 'Cycle wraps again at 2×length');
}

// ── Test 4: Multiplier labels for each opt index ──────────────────────────
console.log('\nTest 4: Multiplier labels — ×1, ×10, ×50, ×100, ×500, ×1K');
{
    const expected = ['×1', '×10', '×50', '×100', '×500', '×1K'];
    for (let mi = 0; mi < MULT_OPTIONS.length; mi++) {
        assert(multLabel(mi) === expected[mi], `Index ${mi}: "${expected[mi]}", got "${multLabel(mi)}"`);
    }
}

// ── Test 5: Attack count shown as "Nx" string ──────────────────────────────
console.log('\nTest 5: Label format is "Nx" (e.g. "5x"), empty string when 0');
{
    function labelFor(qty, mi) {
        const mult    = MULT_OPTIONS[mi] || 1;
        const attacks = attackCount(qty, mult);
        return attacks > 0 ? String(attacks) + 'x' : '';
    }
    assert(labelFor(100, 0)  === '100x', 'qty=100 ×1  → "100x"');
    assert(labelFor(100, 1)  === '10x',  'qty=100 ×10 → "10x"');
    assert(labelFor(55,  1)  === '5x',   'qty=55  ×10 → "5x" (floor)');
    assert(labelFor(100, 4)  === '',     'qty=100 ×500 → "" (0 attacks, hidden)');
    assert(labelFor(0,   0)  === '',     'qty=0 ×1 → "" (hidden)');
}

// ── Test 6: МАКС mode not reachable — mi never exceeds opts.length-1 ──────
console.log('\nTest 6: Any mi in [0, opts.length-1] is valid, opts.length is not reachable');
{
    const maxValidIdx = MULT_OPTIONS.length - 1;
    for (let mi = 0; mi <= maxValidIdx; mi++) {
        const mult = MULT_OPTIONS[mi];
        assert(mult !== undefined, `Index ${mi} has a defined multiplier (${mult})`);
    }
    assert(MULT_OPTIONS[MULT_OPTIONS.length] === undefined, 'Index opts.length is undefined (МАКС gone)');
}

// ── Test 7: Large quantities — floor truncates correctly ──────────────────
console.log('\nTest 7: Large quantities truncate correctly');
{
    assert(attackCount(10000, 100)  === 100, '10000 ÷ 100 = 100');
    assert(attackCount(99999, 1000) === 99,  '99999 ÷ 1000 = 99 (floor)');
    assert(attackCount(1,     1000) === 0,   '1 ÷ 1000 = 0');
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
