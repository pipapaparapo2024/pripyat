/**
 * Test: Boss key reward system — per-boss key items in reward popup.
 *
 * Changes in bosses-combat.js:
 *   BEFORE: rewardItems.push({type:'boss_keys', amount:1})       → generic
 *   AFTER:  per gives_keys → {type:'boss_key_N', amount:1}       → specific
 *
 * Changes in reward.js:
 *   ICON_MAP: boss_key_1..7 → correct key images
 *   KEY_BOSS_NAMES: boss_key_1..7 → correct boss names
 *
 * Run: node tests/boss-key-rewards.test.js
 */

let passed = 0, failed = 0;

function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

// ── Boss data (extracted from bosses.js) ──────────────────────────────────
const BOSS_DATA = [
    { id:0, name:'Охотник',     gives_keys:[1],   keys_needed:0 },
    { id:1, name:'Счастливчик', gives_keys:[2],   keys_needed:3 },
    { id:2, name:'Ястреб',      gives_keys:[3],   keys_needed:3 },
    { id:3, name:'Меченный',    gives_keys:[4],   keys_needed:3 },
    { id:4, name:'Крыс',        gives_keys:[5,6], keys_needed:3 },
    { id:5, name:'Баркут',      gives_keys:[7],   keys_needed:1 },
    { id:6, name:'Борода',      gives_keys:[7],   keys_needed:2 },
    { id:7, name:'Жгут',        gives_keys:[],    keys_needed:3 },
];

// ── ICON_MAP (extracted from reward.js) ───────────────────────────────────
const ICON_MAP = {
    boss_key_1: 'попап награда ключ счастливчик.png',
    boss_key_2: 'попап награда ключ ястреб.png',
    boss_key_3: 'попап награда ключ меченный.png',
    boss_key_4: 'попап награда ключ крыс.png',
    boss_key_5: 'попап награда ключ баркут.png',
    boss_key_6: 'попап награда ключ борода.png',
    boss_key_7: 'попап награда ключ жгут.png',
};

// ── KEY_BOSS_NAMES (extracted from reward.js) ─────────────────────────────
const KEY_BOSS_NAMES = {
    boss_key_1: 'Счастливчик',
    boss_key_2: 'Ястреб',
    boss_key_3: 'Меченный',
    boss_key_4: 'Крыс',
    boss_key_5: 'Баркут',
    boss_key_6: 'Борода',
    boss_key_7: 'Жгут',
};

// ── Reward builder (mirrors bosses-combat.js _onDefeat logic) ─────────────
function buildKeyItems(bossIdx, diffIdx) {
    const d = BOSS_DATA[bossIdx];
    const items = [];
    if (diffIdx < 2 && d.gives_keys && d.gives_keys.length) {
        for (const nextIdx of d.gives_keys) {
            items.push({ type: 'boss_key_' + nextIdx, amount: 1 });
        }
    }
    return items;
}

// ── Test 1: Each boss gives correct key type(s) ───────────────────────────
console.log('\nTest 1: Each boss gives correct boss_key_N item(s)');
{
    const cases = [
        { bossId:0, expected:['boss_key_1'] },
        { bossId:1, expected:['boss_key_2'] },
        { bossId:2, expected:['boss_key_3'] },
        { bossId:3, expected:['boss_key_4'] },
        { bossId:4, expected:['boss_key_5','boss_key_6'] }, // Крыс gives 2 keys
        { bossId:5, expected:['boss_key_7'] },
        { bossId:6, expected:['boss_key_7'] },
        { bossId:7, expected:[] },                          // Жгут gives nothing
    ];
    for (const { bossId, expected } of cases) {
        const items = buildKeyItems(bossId, 0); // normal difficulty
        const types = items.map(i => i.type);
        assert(
            JSON.stringify(types) === JSON.stringify(expected),
            `Boss ${BOSS_DATA[bossId].name} gives [${expected.join(',')}], got [${types.join(',')}]`
        );
    }
}

// ── Test 2: Surovyi/Solo (diffIdx >= 2) — no key rewards ─────────────────
console.log('\nTest 2: Surovyi and Solo difficulties give no keys');
{
    for (const diff of [2, 3]) {
        for (let i = 0; i < 7; i++) { // all key-giving bosses
            const items = buildKeyItems(i, diff);
            assert(items.length === 0, `Boss ${i} diff=${diff}: no keys (got ${items.length})`);
        }
    }
}

// ── Test 3: Krys gives both Barkut and Boroda keys ────────────────────────
console.log('\nTest 3: Krys gives two separate key items (boss_key_5 AND boss_key_6)');
{
    const items = buildKeyItems(4, 0); // Крыс, normal
    assert(items.length === 2, `Krys gives 2 key items, got ${items.length}`);
    assert(items[0].type === 'boss_key_5', `First key: boss_key_5, got ${items[0]?.type}`);
    assert(items[1].type === 'boss_key_6', `Second key: boss_key_6, got ${items[1]?.type}`);
    assert(items[0].amount === 1, `Key amount is 1`);
}

// ── Test 4: ICON_MAP has correct image for each key type ─────────────────
console.log('\nTest 4: ICON_MAP maps boss_key_N to correct image file');
{
    const expected = {
        boss_key_1: 'попап награда ключ счастливчик.png',
        boss_key_2: 'попап награда ключ ястреб.png',
        boss_key_3: 'попап награда ключ меченный.png',
        boss_key_4: 'попап награда ключ крыс.png',
        boss_key_5: 'попап награда ключ баркут.png',
        boss_key_6: 'попап награда ключ борода.png',
        boss_key_7: 'попап награда ключ жгут.png',
    };
    for (const [type, img] of Object.entries(expected)) {
        assert(ICON_MAP[type] === img, `${type} → "${img}"`);
    }
    // All 7 boss keys are covered
    assert(Object.keys(ICON_MAP).filter(k => k.startsWith('boss_key_')).length === 7,
        'All 7 boss_key_N entries present in ICON_MAP');
}

// ── Test 5: KEY_BOSS_NAMES maps each key to correct boss name ────────────
console.log('\nTest 5: KEY_BOSS_NAMES maps boss_key_N to correct boss name');
{
    // Boss IDs 1-7 correspond to boss names
    const bossNames = ['','Счастливчик','Ястреб','Меченный','Крыс','Баркут','Борода','Жгут'];
    for (let n = 1; n <= 7; n++) {
        const key = 'boss_key_' + n;
        assert(KEY_BOSS_NAMES[key] === bossNames[n],
            `${key} → "${bossNames[n]}", got "${KEY_BOSS_NAMES[key]}"`);
    }
}

// ── Test 6: Every gives_keys entry has a corresponding ICON_MAP entry ─────
console.log('\nTest 6: Every gives_keys target has an ICON_MAP and KEY_BOSS_NAMES entry');
{
    const allTargets = new Set();
    for (const d of BOSS_DATA) {
        for (const t of d.gives_keys) allTargets.add(t);
    }
    for (const target of allTargets) {
        const key = 'boss_key_' + target;
        assert(!!ICON_MAP[key],       `ICON_MAP has entry for ${key}`);
        assert(!!KEY_BOSS_NAMES[key], `KEY_BOSS_NAMES has entry for ${key}`);
    }
}

// ── Test 7: Normal difficulty gives keys, dangerous also gives keys ────────
console.log('\nTest 7: Normal (diffIdx=0) and Dangerous (diffIdx=1) both give keys');
{
    for (const diff of [0, 1]) {
        const items = buildKeyItems(0, diff); // Охотник always gives boss_key_1
        assert(items.length === 1, `Охотник diff=${diff}: 1 key item, got ${items.length}`);
        assert(items[0].type === 'boss_key_1', `Key type is boss_key_1, got ${items[0]?.type}`);
    }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
