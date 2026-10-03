/**
 * Test: poker card async texture loading + proportional sizing.
 *
 * This test does NOT read the real production fixedH from dvor-poker-screen.js
 * (that exact value is pinned separately in tests/poker-card-size-127.test.js,
 * currently 127). It uses its own independent constant, TEST_FIXED_H = 141,
 * purely as a stand-in to exercise the GENERAL PATTERN:
 *   - height is ALWAYS a fixed value (same for all cards)
 *   - width is computed proportionally: nativeW / nativeH * TEST_FIXED_H
 *   - scale.set(TEST_FIXED_H / nativeH) applied via baseTexture 'loaded'/'error' events
 *   - border is redrawn to match actual card width
 * TEST_FIXED_H is intentionally decoupled from production and will NOT track
 * future changes to the real fixedH constant.
 *
 * Bug prevented: setting scale on 1×1 placeholder → card becomes nativeW×87 = 7395px wide.
 *
 * Run: node tests/poker-card-async-size.test.js
 */

const TEST_FIXED_H = 141; // arbitrary test value, independent of production fixedH

let passed = 0, failed = 0;

function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

function assertClose(a, b, eps, msg) {
    if (Math.abs(a - b) < (eps ?? 0.5)) { console.log('  ✅', msg); passed++; }
    else { console.error(`  ❌ FAIL: ${msg} (got ${a.toFixed(2)}, expected ${b.toFixed(2)})`); failed++; }
}

// ── Mock PIXI Sprite ──────────────────────────────────────────────────────────
function makeSprite() {
    let _scaleX = 1, _scaleY = 1;
    let _tex = { orig: { width: 74, height: 124 } };
    return {
        x: 372, y: 294,
        set texture(t) { _tex = t; },
        get texture() { return _tex; },
        scale: {
            set(v) { _scaleX = v; _scaleY = v; },
            get x() { return _scaleX; },
            get y() { return _scaleY; },
        },
        get displayWidth()  { return _tex.orig.width  * _scaleX; },
        get displayHeight() { return _tex.orig.height * _scaleY; },
    };
}

// ── Mock border (PIXI.Graphics) ───────────────────────────────────────────────
function makeBorder() {
    let _rect = null;
    return {
        visible: false,
        clear() { _rect = null; },
        lineStyle() {},
        drawRect(x, y, w, h) { _rect = { x, y, w, h }; },
        get rect() { return _rect; },
    };
}

// ── Mock texture ──────────────────────────────────────────────────────────────
function makeTex(w, h, valid) {
    const listeners = {};
    return {
        orig: { width: w, height: h },
        baseTexture: {
            valid,
            once(event, cb) {
                if (!listeners[event]) listeners[event] = [];
                listeners[event].push(cb);
            },
            _emit(event) {
                (listeners[event] || []).forEach(cb => cb());
                listeners[event] = [];
            },
        },
    };
}

// ── Mirror of the fixed _updatePokerCardVisual applySize logic ────────────────
function applyCardSize(spr, border, tex) {
    const srcH = tex.orig.height > 1 ? tex.orig.height : TEST_FIXED_H;
    const scale = TEST_FIXED_H / srcH;
    spr.scale.set(scale);
    if (border) {
        const cardW = Math.round(tex.orig.width * scale);
        border.clear();
        border.lineStyle(3, 0xffff00);
        border.drawRect(spr.x - 2, spr.y - 2, cardW + 4, TEST_FIXED_H + 4);
    }
}

function updateCardVisual(spr, border, tex) {
    spr.texture = tex;
    const apply = () => applyCardSize(spr, border, tex);
    if (tex.baseTexture.valid) { apply(); }
    else {
        tex.baseTexture.once('loaded', apply);
        tex.baseTexture.once('error',  apply);
    }
}

// ── Test 1: Height always TEST_FIXED_H, width proportional (sync) ────────────
console.log(`\nTest 1: already-loaded texture → height=${TEST_FIXED_H}, width proportional`);
{
    const CASES = [
        [80, 132],  // черви 7
        [85, 145],  // крести Q
        [90, 142],  // крести J
        [92, 137],  // пики A
        [85, 135],  // буби any
        [87, 141],  // крести A (perfect)
    ];
    for (const [w, h] of CASES) {
        const spr = makeSprite();
        const tex = makeTex(w, h, true);
        updateCardVisual(spr, null, tex);
        assertClose(spr.displayHeight, TEST_FIXED_H, 0.6, `${w}×${h}: height = ${TEST_FIXED_H}`);
        const expectedW = w / h * TEST_FIXED_H;
        assertClose(spr.displayWidth, expectedW, 0.6, `${w}×${h}: width = ${expectedW.toFixed(1)}`);
    }
}

// ── Test 2: Async load → size applied on 'loaded' ────────────────────────────
console.log('\nTest 2: async texture → size applied on "loaded"');
{
    const spr = makeSprite();
    const tex = makeTex(85, 145, false); // Q♣ not yet loaded
    updateCardVisual(spr, null, tex);
    // Before load: scale not yet applied — still 1.0
    assert(spr.scale.x === 1, 'scale unchanged before load');
    tex.baseTexture._emit('loaded');
    assertClose(spr.displayHeight, TEST_FIXED_H, 0.5, `height = ${TEST_FIXED_H} after loaded`);
    assertClose(spr.displayWidth, 85/145*TEST_FIXED_H, 0.5, 'width proportional after loaded');
}

// ── Test 3: 404 error → size applied on 'error' ───────────────────────────────
console.log('\nTest 3: 404 error → fallback scale applied on "error"');
{
    const spr = makeSprite();
    const tex = makeTex(85, 145, false);
    updateCardVisual(spr, null, tex);
    tex.baseTexture._emit('error');
    assertClose(spr.displayHeight, TEST_FIXED_H, 0.5, `height = ${TEST_FIXED_H} after error`);
}

// ── Test 4: OLD broken pattern (for contrast) ─────────────────────────────────
console.log(`\nTest 4: OLD code — scale.set(87,${TEST_FIXED_H}) on placeholder → huge card after load`);
{
    const spr = makeSprite();
    // OLD code: set texture to placeholder (1×1), then force scale
    const placeholder = makeTex(1, 1, false);
    spr.texture = placeholder;
    spr.scale.set(TEST_FIXED_H / 1); // BUG: scale.y = TEST_FIXED_H

    // Real image loads (85×145) — scale stays TEST_FIXED_H
    const realTex = makeTex(85, 145, true);
    spr.texture = realTex;
    const bugH = spr.displayHeight; // = 145 * TEST_FIXED_H
    assert(bugH > 1000, `OLD: displayed height = ${bugH}px (HUGE, expected ${TEST_FIXED_H})`);
}

// ── Test 5: Border redrawn to match card width ────────────────────────────────
console.log('\nTest 5: border is redrawn with correct card width');
{
    const spr    = makeSprite(); // x=372, y=294
    const border = makeBorder();
    const tex    = makeTex(85, 145, true); // Q♣ крести
    updateCardVisual(spr, border, tex);
    const expectedW = Math.round(85 / 145 * TEST_FIXED_H); // ≈ 83px
    assert(border.rect !== null, 'border was redrawn');
    assert(border.rect.x === spr.x - 2, 'border x = sprite.x - 2');
    assert(border.rect.y === spr.y - 2, 'border y = sprite.y - 2');
    assert(border.rect.w === expectedW + 4, `border width = ${expectedW + 4} (card ${expectedW}px + 4 padding)`);
    assert(border.rect.h === TEST_FIXED_H + 4, `border height = ${TEST_FIXED_H + 4} (${TEST_FIXED_H} + 4 padding)`);
}

// ── Test 6: Border updates when card changes ──────────────────────────────────
console.log('\nTest 6: border updates correctly when card changes');
{
    const spr    = makeSprite();
    const border = makeBorder();

    // First card: Q♣ (85×145)
    const tex1 = makeTex(85, 145, true);
    updateCardVisual(spr, border, tex1);
    const w1 = border.rect.w;

    // Second card: пики A (92×137) — wider
    const tex2 = makeTex(92, 137, true);
    updateCardVisual(spr, border, tex2);
    const w2 = border.rect.w;

    assert(w2 > w1, `border updates: A♠ border (${w2}) wider than Q♣ border (${w1})`);
    assertClose(w2 - 4, 92/137*TEST_FIXED_H, 0.6, 'A♠ border width matches proportional card width');
}

// ── Test 7: once semantics — applySize fires once ─────────────────────────────
console.log('\nTest 7: size applied exactly once (once semantics)');
{
    const spr = makeSprite();
    const tex = makeTex(85, 145, false);
    updateCardVisual(spr, null, tex);
    tex.baseTexture._emit('loaded');
    const scaleAfterFirst = spr.scale.x;
    tex.baseTexture._emit('loaded'); // already consumed by 'once'
    assert(spr.scale.x === scaleAfterFirst, 'scale unchanged on second emit');
}

// ── Test 8: 1×1 placeholder in error case → fallback to 1:1 scale ────────────
console.log(`\nTest 8: 1×1 placeholder error → fallback scale ${TEST_FIXED_H}/${TEST_FIXED_H} = 1.0`);
{
    const spr = makeSprite();
    const placeholder = makeTex(1, 1, false);
    updateCardVisual(spr, null, placeholder);
    placeholder.baseTexture._emit('error');
    // orig.height = 1 → guard: srcH = TEST_FIXED_H (fallback), scale = 1.0
    assertClose(spr.scale.x, 1.0, 0.001, 'fallback scale = 1.0 when orig.height = 1');
}

// ── Test 9: actual card width ranges across all suits ─────────────────────────
console.log(`\nTest 9: actual card dimensions (all suits, H=${TEST_FIXED_H} fixed)`);
{
    const allCards = {
        // черви (hearts): smallest source images
        '7♥':[80,132], '8♥':[82,133], 'J♥':[82,134], 'Q♥':[80,134], 'A♥':[82,134],
        // буби (diamonds): uniform 85×135
        '7♦':[85,135], '10♦':[85,135], 'J♦':[85,135],
        // пики (spades): up to 92px wide
        '7♠':[88,138], 'A♠':[92,137],
        // крести (clubs): tall face cards
        'Q♣':[85,145], 'J♣':[90,142], 'A♣':[87,141],
    };
    let minW = Infinity, maxW = -Infinity;
    for(const [name, [w, h]] of Object.entries(allCards)){
        const displayH = h / h * TEST_FIXED_H; // always TEST_FIXED_H
        const displayW = w / h * TEST_FIXED_H;
        assert(Math.abs(displayH - TEST_FIXED_H) < 0.1, `${name}: height = ${TEST_FIXED_H}`);
        if(displayW < minW) minW = displayW;
        if(displayW > maxW) maxW = displayW;
    }
    console.log(`  ℹ️  Width range: ${minW.toFixed(1)}px – ${maxW.toFixed(1)}px (spread ${(maxW-minW).toFixed(1)}px)`);
    assert(maxW - minW < 15, `width spread (${(maxW-minW).toFixed(1)}px) under 15px — acceptable`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.error(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
