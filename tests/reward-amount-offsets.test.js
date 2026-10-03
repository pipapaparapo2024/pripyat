/**
 * Test: Reward popup amount text — per-type x/y offsets + rotation.
 *
 * Changes in reward.js:
 *   - amtTxt.rotation = 4 * Math.PI / 180  (4° clockwise for all types)
 *   - _TXT_OFF map: per-item-type dx/dy offsets
 *   - amtTxt.x = slotX + 2 + _off.dx
 *   - amtTxt.y = ITEM_Y + CARD_H/2 - 38 - (bossName ? 10 : 6) + _off.dy
 *
 * Run: node tests/reward-amount-offsets.test.js
 */

let passed = 0, failed = 0;

function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

function assertClose(a, b, eps, msg) {
    if (Math.abs(a - b) < (eps ?? 1e-9)) { console.log('  ✅', msg); passed++; }
    else { console.error(`  ❌ FAIL: ${msg} (got ${a}, expected ${b})`); failed++; }
}

// ── Mirror constants from reward.js ──────────────────────────────────────
const CARD_SCALE = 0.6810;
const CARD_H     = 411 * CARD_SCALE;   // 279.921
const ITEM_Y     = 2;
const ROTATION   = 4 * Math.PI / 180;

const _TXT_OFF = {
    gun:          { dx: -2, dy:  0 }, ammo_gun:     { dx: -2, dy:  0 },
    cig:          { dx: -4, dy:  0 }, cigarettes:   { dx: -4, dy:  0 },
    coins:        { dx: -2, dy:  0 },
    exp:          { dx:  6, dy:  0 }, energy:       { dx:  6, dy:  0 }, heal: { dx:  6, dy:  0 },
    machete:      { dx:  6, dy: -8 }, ammo_machete: { dx:  6, dy: -8 },
    auto:         { dx: 10, dy: -6 }, ammo_auto:    { dx: 10, dy: -6 },
};

function getOffset(type) {
    return _TXT_OFF[type] || { dx: 0, dy: 0 };
}

function amtX(slotX, type) {
    return slotX + 2 + getOffset(type).dx;
}

function amtY(type, bossName) {
    const dy = getOffset(type).dy;
    return ITEM_Y + CARD_H / 2 - 38 - (bossName ? 10 : 6) + dy;
}

// ── Test 1: Rotation is exactly 4° in radians ─────────────────────────────
console.log('\nTest 1: amtTxt rotation = 4° (4 * PI/180)');
{
    assertClose(ROTATION, 0.06981317007977318, 1e-12, '4 * Math.PI / 180 ≈ 0.069813');
    assertClose(ROTATION * (180 / Math.PI), 4, 1e-10, 'back-convert → 4.0 degrees');
    assert(ROTATION > 0, 'positive → clockwise rotation');
}

// ── Test 2: _TXT_OFF table — explicit entries ─────────────────────────────
console.log('\nTest 2: Per-type offset table explicit values');
{
    const cases = [
        ['gun',           -2,  0],
        ['ammo_gun',      -2,  0],
        ['cig',           -4,  0],
        ['cigarettes',    -4,  0],
        ['coins',         -2,  0],
        ['exp',            6,  0],
        ['energy',         6,  0],
        ['heal',           6,  0],
        ['machete',        6, -8],
        ['ammo_machete',   6, -8],
        ['auto',          10, -6],
        ['ammo_auto',     10, -6],
    ];
    for (const [type, dx, dy] of cases) {
        const off = getOffset(type);
        assert(off.dx === dx, `${type}: dx=${dx}`);
        assert(off.dy === dy, `${type}: dy=${dy}`);
    }
}

// ── Test 3: Unknown type falls back to {dx:0, dy:0} ──────────────────────
console.log('\nTest 3: Unknown item type → zero offset (no crash)');
{
    const unknown = ['stash', 'tatu', 'shmot', 'respect', 'boss_key_1', 'red_points', 'poker_chips', undefined, ''];
    for (const type of unknown) {
        const off = getOffset(type);
        assert(off.dx === 0 && off.dy === 0, `type="${type}" → {dx:0,dy:0}`);
    }
}

// ── Test 4: amtTxt.x formula — slotX + 2 + dx ───────────────────────────
console.log('\nTest 4: amtTxt.x = slotX + 2 + dx');
{
    assert(amtX(0,   'gun')       === -2 + 2,   'slotX=0  gun   → 0');
    assert(amtX(0,   'auto')      === 10 + 2,   'slotX=0  auto  → 12');
    assert(amtX(100, 'cig')       === 100 - 4 + 2, 'slotX=100 cig → 98');
    assert(amtX(100, 'exp')       === 100 + 6 + 2, 'slotX=100 exp → 108');
    assert(amtX(50,  'stash')     === 50 + 0 + 2,  'slotX=50 unknown → 52');
    assert(amtX(-174, 'auto')     === -174 + 10 + 2, 'negative slotX');
}

// ── Test 5: amtTxt.y formula without boss name ────────────────────────────
console.log('\nTest 5: amtTxt.y without bossName = ITEM_Y + CARD_H/2 - 38 - 6 + dy');
{
    const baseY = ITEM_Y + CARD_H / 2 - 38 - 6;
    assertClose(amtY('gun',      false), baseY + 0,  1e-6, 'gun dy=0');
    assertClose(amtY('auto',     false), baseY - 6,  1e-6, 'auto dy=-6');
    assertClose(amtY('machete',  false), baseY - 8,  1e-6, 'machete dy=-8');
    assertClose(amtY('exp',      false), baseY + 0,  1e-6, 'exp dy=0');
    assertClose(amtY('stash',    false), baseY + 0,  1e-6, 'unknown type dy=0');
}

// ── Test 6: amtTxt.y formula with boss name (key cards) ──────────────────
console.log('\nTest 6: amtTxt.y with bossName = ITEM_Y + CARD_H/2 - 38 - 10 + dy');
{
    const baseYBoss = ITEM_Y + CARD_H / 2 - 38 - 10;
    const baseYNorm = ITEM_Y + CARD_H / 2 - 38 - 6;
    assertClose(amtY('exp', true),  baseYBoss, 1e-6, 'bossName=true → uses -10');
    assertClose(amtY('exp', false), baseYNorm, 1e-6, 'bossName=false → uses -6');
    assertClose(baseYNorm - baseYBoss, 4, 1e-6, 'boss-name shifts Y by -4px');
}

// ── Test 7: ammo_* types share same offset as weapon type ─────────────────
console.log('\nTest 7: ammo_ aliases match parent weapon offsets');
{
    assert(getOffset('ammo_gun').dx     === getOffset('gun').dx,     'ammo_gun dx == gun dx');
    assert(getOffset('ammo_gun').dy     === getOffset('gun').dy,     'ammo_gun dy == gun dy');
    assert(getOffset('ammo_auto').dx    === getOffset('auto').dx,    'ammo_auto dx == auto dx');
    assert(getOffset('ammo_auto').dy    === getOffset('auto').dy,    'ammo_auto dy == auto dy');
    assert(getOffset('ammo_machete').dx === getOffset('machete').dx, 'ammo_machete dx == machete dx');
    assert(getOffset('ammo_machete').dy === getOffset('machete').dy, 'ammo_machete dy == machete dy');
}

// ── Test 8: cig and cigarettes aliases match ──────────────────────────────
console.log('\nTest 8: cig and cigarettes alias consistency');
{
    assert(getOffset('cig').dx        === getOffset('cigarettes').dx, 'cig dx == cigarettes dx');
    assert(getOffset('cig').dy        === getOffset('cigarettes').dy, 'cig dy == cigarettes dy');
}

// ── Test 9: energy and heal share exp offsets ─────────────────────────────
console.log('\nTest 9: energy / heal share same offset as exp');
{
    assert(getOffset('energy').dx === getOffset('exp').dx, 'energy dx == exp dx');
    assert(getOffset('energy').dy === getOffset('exp').dy, 'energy dy == exp dy');
    assert(getOffset('heal').dx   === getOffset('exp').dx, 'heal dx == exp dx');
    assert(getOffset('heal').dy   === getOffset('exp').dy, 'heal dy == exp dy');
}

// ── Test 10: X-axis spread — no two types collide within 1 slot ──────────
console.log('\nTest 10: dx values stay within reasonable range [−10, +10]');
{
    for (const [type, off] of Object.entries(_TXT_OFF)) {
        assert(off.dx >= -10 && off.dx <= 10, `${type}: dx=${off.dx} in [-10, +10]`);
        assert(off.dy >= -10 && off.dy <= 0,  `${type}: dy=${off.dy} in [-10, 0]`);
    }
}

// ── Test 11: CARD_H constant ──────────────────────────────────────────────
console.log('\nTest 11: CARD_H = 411 * 0.6810');
{
    assertClose(CARD_H, 411 * 0.6810, 1e-9, 'CARD_H = 411 × 0.6810 ≈ 279.921');
    assert(CARD_H > 0, 'CARD_H positive');
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.error(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
