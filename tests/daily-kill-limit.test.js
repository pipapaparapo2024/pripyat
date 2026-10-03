/**
 * Test: Daily kill limit — max 7 kills per boss per day, resets at midnight.
 *
 * Logic in bosses-combat.js _attack():
 *   if(today !== this.dailyDate){ this.dailyDate=today; this.dailyKills=[...]; }
 *   if(this.dailyKills[idx] >= this.DAILY_KILL_LIMIT) → blocked
 *   ...
 *   this.dailyKills[idx]++;
 *
 * Run: node tests/daily-kill-limit.test.js
 */

let passed = 0, failed = 0;

function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const DAILY_KILL_LIMIT = 7;
const NUM_BOSSES       = 8;

// ── Minimal state + attack gate (mirrors bosses-combat.js) ───────────────
function makeState(date = '2026-09-05') {
    return {
        dailyDate:  date,
        dailyKills: new Array(NUM_BOSSES).fill(0),
    };
}

function canAttack(state, bossIdx, today) {
    if (today !== state.dailyDate) {
        state.dailyDate  = today;
        state.dailyKills = new Array(NUM_BOSSES).fill(0);
    }
    return state.dailyKills[bossIdx] < DAILY_KILL_LIMIT;
}

function recordKill(state, bossIdx, today) {
    if (today !== state.dailyDate) {
        state.dailyDate  = today;
        state.dailyKills = new Array(NUM_BOSSES).fill(0);
    }
    state.dailyKills[bossIdx]++;
}

// ── Test 1: 7 kills allowed, 8th blocked ─────────────────────────────────
console.log('\nTest 1: Up to 7 kills per day allowed, 8th is blocked');
{
    const s   = makeState();
    const day = '2026-09-05';
    for (let i = 0; i < DAILY_KILL_LIMIT; i++) {
        assert(canAttack(s, 0, day), `Kill ${i+1} of ${DAILY_KILL_LIMIT} allowed`);
        recordKill(s, 0, day);
    }
    assert(!canAttack(s, 0, day), `Kill ${DAILY_KILL_LIMIT + 1} blocked`);
}

// ── Test 2: Limit is per-boss (boss 0 maxed doesn't block boss 1) ─────────
console.log('\nTest 2: Kill limit is per-boss — maxing boss 0 does not affect boss 1');
{
    const s   = makeState();
    const day = '2026-09-05';
    for (let i = 0; i < DAILY_KILL_LIMIT; i++) recordKill(s, 0, day);

    assert(!canAttack(s, 0, day), 'Boss 0 is maxed out');
    assert( canAttack(s, 1, day), 'Boss 1 is still available');
}

// ── Test 3: New day resets all kill counts ────────────────────────────────
console.log('\nTest 3: Kill counts reset on the next calendar day');
{
    const s   = makeState('2026-09-05');
    const day = '2026-09-05';
    for (let i = 0; i < DAILY_KILL_LIMIT; i++) recordKill(s, 0, day);
    assert(!canAttack(s, 0, day), 'Boss 0 maxed today');

    const tomorrow = '2026-09-06';
    assert(canAttack(s, 0, tomorrow), 'Boss 0 available again tomorrow');
    assert(s.dailyDate === tomorrow,  'dailyDate updated to tomorrow');
    assert(s.dailyKills[0] === 0,     'Kill counter reset to 0');
}

// ── Test 4: All 8 bosses each have an independent counter ────────────────
console.log('\nTest 4: All 8 bosses can be killed up to 7 times independently');
{
    const s   = makeState();
    const day = '2026-09-05';
    for (let boss = 0; boss < NUM_BOSSES; boss++) {
        for (let kill = 0; kill < DAILY_KILL_LIMIT; kill++) recordKill(s, boss, day);
    }
    for (let boss = 0; boss < NUM_BOSSES; boss++) {
        assert(s.dailyKills[boss] === DAILY_KILL_LIMIT,
            `Boss ${boss}: exactly ${DAILY_KILL_LIMIT} kills recorded`);
        assert(!canAttack(s, boss, day),
            `Boss ${boss}: blocked after ${DAILY_KILL_LIMIT} kills`);
    }
}

// ── Test 5: First kill of the day always allowed (fresh state) ────────────
console.log('\nTest 5: First kill of the day always allowed');
{
    for (let boss = 0; boss < NUM_BOSSES; boss++) {
        const s = makeState();
        assert(canAttack(s, boss, '2026-09-05'), `Boss ${boss}: first attack allowed`);
    }
}

// ── Test 6: Kill counter increments correctly ─────────────────────────────
console.log('\nTest 6: Kill counter increments by 1 per kill');
{
    const s   = makeState();
    const day = '2026-09-05';
    for (let i = 1; i <= 5; i++) {
        recordKill(s, 2, day);
        assert(s.dailyKills[2] === i, `After ${i} kills: counter = ${i}, got ${s.dailyKills[2]}`);
    }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
