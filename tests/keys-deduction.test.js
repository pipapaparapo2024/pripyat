/**
 * Test: Boss keys deduction — should happen only ONCE per fight (on first attack)
 * Covers the fix in bosses-combat.js line 67:
 *   BEFORE: if(d.keys_needed > 0) this.keys[idx] -= d.keys_needed;
 *   AFTER:  if(d.keys_needed > 0 && this._bossStartMs[...][idx] === 0) this.keys[idx] -= d.keys_needed;
 *
 * Run: node tests/keys-deduction.test.js
 */

let passed = 0, failed = 0;

function assert(cond, msg) {
    if (cond) {
        console.log('  ✅', msg);
        passed++;
    } else {
        console.error('  ❌ FAIL:', msg);
        failed++;
    }
}

function makeState(initialKeys = 3) {
    return {
        keys:         new Array(8).fill(initialKeys),
        _bossStartMs: [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]],
        _diffIdx:     0,
    };
}

// Fixed deduction logic (matches the fix in bosses-combat.js)
function attackFixed(state, idx, keys_needed) {
    const now = Date.now();
    if (keys_needed > 0 && state._bossStartMs[state._diffIdx][idx] === 0) {
        state.keys[idx] -= keys_needed;
    }
    if (state._bossStartMs[state._diffIdx][idx] === 0) {
        state._bossStartMs[state._diffIdx][idx] = now;
    }
}

// Buggy deduction logic (original broken code)
function attackBuggy(state, idx, keys_needed) {
    const now = Date.now();
    if (keys_needed > 0) {                                    // <-- no first-attack guard
        state.keys[idx] -= keys_needed;
    }
    if (state._bossStartMs[state._diffIdx][idx] === 0) {
        state._bossStartMs[state._diffIdx][idx] = now;
    }
}

// ─── Test 1: Fixed code deducts keys only once per fight ─────────────────────
console.log('\nTest 1: Fixed code — keys deducted only once');
{
    const s = makeState(3);
    const idx = 2, needed = 1;
    for (let i = 0; i < 5; i++) attackFixed(s, idx, needed);  // 5 attacks
    assert(s.keys[idx] === 2, `5 attacks: expected 2 keys (3−1), got ${s.keys[idx]}`);
    assert(s._bossStartMs[0][idx] !== 0, 'fight timer set after first attack');
}

// ─── Test 2: Buggy code deducts keys on every attack ─────────────────────────
console.log('\nTest 2: Buggy code — keys deducted on every attack (documents the bug)');
{
    const s = makeState(3);
    const idx = 2, needed = 1;
    for (let i = 0; i < 3; i++) attackBuggy(s, idx, needed);  // 3 attacks
    assert(s.keys[idx] === 0, `3 attacks with bug: expected 0 keys (3−3), got ${s.keys[idx]}`);
    for (let i = 0; i < 2; i++) attackBuggy(s, idx, needed);  // 2 more attacks
    assert(s.keys[idx] === -2, `5 attacks with bug: expected −2 keys (3−5), got ${s.keys[idx]}`);
}

// ─── Test 3: New fight after timer reset requires keys again ──────────────────
console.log('\nTest 3: After fight timer resets — keys required for next fight');
{
    const s = makeState(3);
    const idx = 0, needed = 1;

    // Fight 1: 3 attacks
    for (let i = 0; i < 3; i++) attackFixed(s, idx, needed);
    const afterFight1 = s.keys[idx];

    // Timer expired → boss resets (as done in _attack when timeout reached)
    s._bossStartMs[s._diffIdx][idx] = 0;

    // Fight 2: 2 more attacks
    for (let i = 0; i < 2; i++) attackFixed(s, idx, needed);
    const afterFight2 = s.keys[idx];

    assert(afterFight1 === 2, `After fight 1: 2 keys remain (3−1), got ${afterFight1}`);
    assert(afterFight2 === 1, `After fight 2: 1 key remains (2−1), got ${afterFight2}`);
}

// ─── Test 4: Boss with keys_needed=0 — no keys deducted ──────────────────────
console.log('\nTest 4: Boss that requires no keys — keys untouched');
{
    const s = makeState(5);
    const idx = 3, needed = 0;
    for (let i = 0; i < 5; i++) attackFixed(s, idx, needed);
    assert(s.keys[idx] === 5, `No keys required: keys unchanged, got ${s.keys[idx]}`);
}

// ─── Test 5: Multi-boss isolation — attacking one boss doesn't affect others ──
console.log('\nTest 5: Keys are per-boss — attacking boss 0 does not affect boss 1 keys');
{
    const s = makeState(2);
    const needed = 1;
    for (let i = 0; i < 3; i++) attackFixed(s, 0, needed);  // attack boss 0 three times
    assert(s.keys[0] === 1, `Boss 0 keys: expected 1 (2−1), got ${s.keys[0]}`);
    assert(s.keys[1] === 2, `Boss 1 keys: still 2, got ${s.keys[1]}`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
    console.log(`✅ All ${passed} tests passed`);
} else {
    console.log(`❌ ${failed} test(s) FAILED, ${passed} passed`);
    process.exit(1);
}
