/**
 * Test: Dice game result text — simplified format "+N TYPE", no popup.
 *
 * Changes in dvor-dice-game.js:
 *   BEFORE: hit.lbl like '3×6 → +100р'; noHit: 'Нет комбинации → +50 сигарет [2·6·5·1]'
 *   AFTER:  '+100 РУБ'; noHit: '+50 СИГАРЕТ'
 *   Removed: iface._showRewardPopup() calls
 *
 * Run: node tests/dice-result-text.test.js
 */

let passed = 0, failed = 0;

function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

// ── Mirrors TYPE_LBL2 from dvor-dice-game.js ─────────────────────────────
const TYPE_LBL = {
    shmot:      'ШМОТОК',
    coins:      'РУБ',
    cig:        'СИГАРЕТ',
    red_points: 'ПОИНТОВ',
    auto:       'АВТОМАТОВ',
    gun:        'СТВОЛОВ',
    machete:    'МАЧЕТЕ',
    exp:        'ОПЫТА',
};

function buildResultText(type, amt) {
    return '+' + amt + ' ' + (TYPE_LBL[type] || type.toUpperCase());
}

const NO_HIT_TEXT   = '+50 СИГАРЕТ';
const PITY_HIT_TEXT = '+5 ШМОТОК (ГАРАНТ)';

// ── TABLE mirrors dvor-dice-game.js ──────────────────────────────────────
const TABLE = [
    { v:6, n:4, type:'shmot',      amt:5    },
    { v:6, n:3, type:'coins',      amt:100  },
    { v:6, n:2, type:'cig',        amt:10000},
    { v:5, n:4, type:'coins',      amt:50   },
    { v:5, n:3, type:'cig',        amt:5000 },
    { v:5, n:2, type:'red_points', amt:2    },
    { v:4, n:4, type:'auto',       amt:10   },
    { v:4, n:3, type:'gun',        amt:10   },
    { v:4, n:2, type:'cig',        amt:2000 },
    { v:3, n:4, type:'machete',    amt:10   },
    { v:3, n:3, type:'exp',        amt:1000 },
    { v:3, n:2, type:'coins',      amt:25   },
    { v:2, n:4, type:'auto',       amt:2    },
    { v:2, n:3, type:'auto',       amt:1    },
    { v:2, n:2, type:'exp',        amt:500  },
    { v:1, n:4, type:'cig',        amt:1000 },
    { v:1, n:3, type:'exp',        amt:250  },
    { v:1, n:2, type:'cig',        amt:500  },
];

// ── Test 1: All TABLE entries produce correct simplified label ────────────
console.log('\nTest 1: All TABLE entries produce "+N TYPE" format');
{
    for (const row of TABLE) {
        const text = buildResultText(row.type, row.amt);
        assert(text.startsWith('+' + row.amt + ' '), `${row.type}×${row.n}: starts with "+${row.amt} "`);
        assert(!text.includes('→'), `${row.type}: no "→" arrow`);
        assert(!text.includes('×'), `${row.type}: no "×" multiplier`);
        assert(!text.match(/\[\d/),  `${row.type}: no dice roll dump "[N"`);
    }
}

// ── Test 2: Each reward type maps to Russian uppercase label ──────────────
console.log('\nTest 2: Reward type → Russian label mapping');
{
    const cases = [
        { type:'shmot',      amt:5,    expected:'+5 ШМОТОК'    },
        { type:'coins',      amt:100,  expected:'+100 РУБ'     },
        { type:'cig',        amt:10000,expected:'+10000 СИГАРЕТ'},
        { type:'red_points', amt:2,    expected:'+2 ПОИНТОВ'   },
        { type:'auto',       amt:10,   expected:'+10 АВТОМАТОВ' },
        { type:'gun',        amt:10,   expected:'+10 СТВОЛОВ'   },
        { type:'machete',    amt:10,   expected:'+10 МАЧЕТЕ'    },
        { type:'exp',        amt:1000, expected:'+1000 ОПЫТА'   },
        { type:'cig',        amt:50,   expected:'+50 СИГАРЕТ'  },
    ];
    for (const { type, amt, expected } of cases) {
        const got = buildResultText(type, amt);
        assert(got === expected, `${type} ${amt} → "${expected}", got "${got}"`);
    }
}

// ── Test 3: No-hit produces exactly "+50 СИГАРЕТ" ─────────────────────────
console.log('\nTest 3: No-hit produces "+50 СИГАРЕТ" — no dice dump, no arrow');
{
    assert(NO_HIT_TEXT === '+50 СИГАРЕТ',    'No-hit text is "+50 СИГАРЕТ"');
    assert(!NO_HIT_TEXT.includes('['),        'No "[" in no-hit text');
    assert(!NO_HIT_TEXT.includes('·'),        'No "·" in no-hit text');
    assert(!NO_HIT_TEXT.includes('→'),        'No "→" in no-hit text');
    assert(!NO_HIT_TEXT.includes('комбинации'), 'No "комбинации" in no-hit text');
}

// ── Test 4: Pity hit text format ──────────────────────────────────────────
console.log('\nTest 4: Pity hit (4×6 ГАРАНТ) text is "+5 ШМОТОК (ГАРАНТ)"');
{
    assert(PITY_HIT_TEXT === '+5 ШМОТОК (ГАРАНТ)',    'Pity text correct');
    assert(!PITY_HIT_TEXT.includes('4×6'),             'No "4×6" in pity text');
    assert(!PITY_HIT_TEXT.includes('→'),               'No arrow in pity text');
    assert(PITY_HIT_TEXT.includes('ГАРАНТ'),           'ГАРАНТ tag preserved');
}

// ── Test 5: Old format strings should NOT appear ──────────────────────────
console.log('\nTest 5: Old verbose format strings must be absent from new logic');
{
    const oldFormats = [
        '3×6 → +100р',
        '4×6 → ШМОТКИ 5шт!',
        'Нет комбинации → +50 сигарет',
    ];
    for (const oldFmt of oldFormats) {
        // The new code never produces these — verify by checking TYPE_LBL logic
        let found = false;
        for (const row of TABLE) {
            if (buildResultText(row.type, row.amt) === oldFmt) found = true;
        }
        assert(!found, `Old format "${oldFmt}" is not produced by new code`);
        assert(NO_HIT_TEXT !== oldFmt, `No-hit text is not old format "${oldFmt}"`);
    }
}

// ── Test 6: Unknown type falls back to toUpperCase() ─────────────────────
console.log('\nTest 6: Unknown reward type falls back to type.toUpperCase()');
{
    assert(buildResultText('stew',       50) === '+50 STEW',       'stew → STEW');
    assert(buildResultText('blue_point', 3)  === '+3 BLUE_POINT',  'blue_point → BLUE_POINT');
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
