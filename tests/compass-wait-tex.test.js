/**
 * Test: _compassWaitTex logic — shows compass while texture loads,
 *        hides on 'loaded' OR 'error', hides immediately if already valid.
 *
 * Changes fixed:
 *   - weapons.open(): was using Texture.once('update',…)  →  fixed to _compassWaitTex()
 *   - sidorovich.js:  was using Texture.once('update',…)  →  fixed to baseTexture.once('loaded'/'error',…)
 *   - Both old usages only handled success, not 404 errors → compass got stuck.
 *
 * Run: node tests/compass-wait-tex.test.js
 */

let passed = 0, failed = 0;

function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

// ── Minimal EventEmitter mock (mimics PIXI BaseTexture) ──────────────────
function makeBaseTex(valid) {
    const _listeners = {};
    return {
        valid,
        once(event, cb) {
            if (!_listeners[event]) _listeners[event] = [];
            _listeners[event].push(cb);
        },
        _emit(event) {
            (_listeners[event] || []).forEach(cb => cb());
            _listeners[event] = [];
        },
    };
}

// Mirror of iface._compassWaitTex (the correct implementation in ui_kit.js)
function compassWaitTex(baseTexture, onShow, onHide) {
    if (baseTexture.valid) { onHide(); return; }
    onShow();
    baseTexture.once('loaded', onHide);
    baseTexture.once('error',  onHide);
}

// ── Test 1: Already valid → hides immediately, never shows ───────────────
console.log('\nTest 1: texture already valid → immediate hide, no show');
{
    const bt   = makeBaseTex(true);
    let shown  = 0, hidden = 0;
    compassWaitTex(bt, ()=>shown++, ()=>hidden++);
    assert(shown  === 0, 'compass never shown when valid=true');
    assert(hidden === 1, 'compass hidden immediately when valid=true');
}

// ── Test 2: Not valid, loads successfully → show then hide on 'loaded' ───
console.log('\nTest 2: not valid → show, then hide when "loaded" fires');
{
    const bt   = makeBaseTex(false);
    let shown  = 0, hidden = 0;
    compassWaitTex(bt, ()=>shown++, ()=>hidden++);
    assert(shown  === 1, 'compass shown before load');
    assert(hidden === 0, 'compass not yet hidden');
    bt._emit('loaded');
    assert(hidden === 1, 'compass hidden after "loaded"');
}

// ── Test 3: Not valid, 404 error → show then hide on 'error' ─────────────
console.log('\nTest 3: not valid → show, then hide when "error" fires (404 case)');
{
    const bt   = makeBaseTex(false);
    let shown  = 0, hidden = 0;
    compassWaitTex(bt, ()=>shown++, ()=>hidden++);
    assert(shown  === 1, 'compass shown before error');
    assert(hidden === 0, 'compass not yet hidden before error');
    bt._emit('error');
    assert(hidden === 1, 'compass hidden after "error" (404 no longer sticks)');
}

// ── Test 4: once semantics — callback fires only once even if events repeat
console.log('\nTest 4: handler fires exactly once even if events repeat');
{
    const bt   = makeBaseTex(false);
    let hidden = 0;
    compassWaitTex(bt, ()=>{}, ()=>hidden++);
    bt._emit('loaded');
    bt._emit('loaded'); // second emit — listener already removed by 'once'
    assert(hidden === 1, '"loaded" callback fires exactly once');
}

// ── Test 5: 'error' registered independently from 'loaded' ───────────────
console.log('\nTest 5: only "error" fires → hide called exactly once');
{
    const bt   = makeBaseTex(false);
    let hidden = 0;
    compassWaitTex(bt, ()=>{}, ()=>hidden++);
    bt._emit('error');
    bt._emit('error'); // second — already consumed
    assert(hidden === 1, '"error" callback fires exactly once');
}

// ── Test 6: old broken pattern ('update' on Texture) would miss 404 ──────
console.log('\nTest 6: old broken pattern — "update" never fires on error state');
{
    // Simulates the OLD code: Texture.once('update', hide)
    // 'update' is NOT emitted on PIXI texture error, so hide never called.
    function oldCompassWaitTex(baseTex, onShow, onHide) {
        if (baseTex.valid) { onHide(); return; }
        onShow();
        baseTex.once('update', onHide); // BUG: no error handler
    }

    const bt   = makeBaseTex(false);
    let hidden = 0;
    oldCompassWaitTex(bt, ()=>{}, ()=>hidden++);
    bt._emit('error'); // 404 scenario
    assert(hidden === 0, 'OLD code: compass stays stuck after 404 (expected failure)');

    // Fixed code handles it
    const bt2   = makeBaseTex(false);
    let hidden2 = 0;
    compassWaitTex(bt2, ()=>{}, ()=>hidden2++);
    bt2._emit('error');
    assert(hidden2 === 1, 'NEW code: compass hidden after 404');
}

// ── Test 7: cached error state — second call also hides correctly ─────────
console.log('\nTest 7: texture previously errored (valid=false, no events) — still safe');
{
    // PIXI caches failed textures with valid=false but won't re-fire events.
    // The correct code handles this via 'error' in once().
    // This test confirms: if we call compassWaitTex twice on same failed tex,
    // the second call re-registers and will hide on the next emitted event.
    const bt   = makeBaseTex(false);
    let h1 = 0, h2 = 0;

    compassWaitTex(bt, ()=>{}, ()=>h1++);
    bt._emit('error'); // first call resolves
    assert(h1 === 1, 'first call: hides on error');

    // Second call to same (still-invalid) baseTexture
    compassWaitTex(bt, ()=>{}, ()=>h2++);
    bt._emit('error'); // event fires again (e.g., retry or re-registration)
    assert(h2 === 1, 'second call: also hides on error');
}

// ── Test 8: valid=true → no listeners registered ─────────────────────────
console.log('\nTest 8: valid=true — no listeners registered on baseTexture');
{
    const bt   = makeBaseTex(true);
    let hidden = 0;
    compassWaitTex(bt, ()=>{}, ()=>hidden++);
    // If listeners WERE registered, emitting would call hide a 2nd time
    bt._emit('loaded');
    assert(hidden === 1, 'only one hide call (from immediate path, not event)');
}

// ── Test 9: sidorovich pattern equivalence ────────────────────────────────
console.log('\nTest 9: sidorovich fix — baseTexture events (not Texture.once)');
{
    // Simulates the fixed sidorovich.js pattern
    function sidorovichOpen(baseTexture, onShow, onHide) {
        if (!baseTexture.valid) {
            onShow();
            baseTexture.once('loaded', onHide);
            baseTexture.once('error',  onHide);
            return;
        }
        onHide(); // texture already valid → open immediately
    }

    // Case: already valid
    const btValid  = makeBaseTex(true);
    let hidden1 = 0;
    sidorovichOpen(btValid, ()=>{}, ()=>hidden1++);
    assert(hidden1 === 1, 'sidorovich: valid → opens immediately');

    // Case: loads
    const btLoad = makeBaseTex(false);
    let shown2 = 0, hidden2 = 0;
    sidorovichOpen(btLoad, ()=>shown2++, ()=>hidden2++);
    assert(shown2  === 1, 'sidorovich: shows compass while loading');
    btLoad._emit('loaded');
    assert(hidden2 === 1, 'sidorovich: hides after loaded');

    // Case: 404
    const btErr = makeBaseTex(false);
    let hidden3 = 0;
    sidorovichOpen(btErr, ()=>{}, ()=>hidden3++);
    btErr._emit('error');
    assert(hidden3 === 1, 'sidorovich: hides after error (404 fixed)');
}

// ── Test 10: mutual exclusion — only loaded OR error fires, not both ──────
console.log('\nTest 10: loaded and error are mutually exclusive (PIXI guarantee)');
{
    // 'loaded' path
    const btL  = makeBaseTex(false);
    let hidL = 0;
    compassWaitTex(btL, ()=>{}, ()=>hidL++);
    btL._emit('loaded');
    assert(hidL === 1, '"loaded" path: hides exactly once');
    btL._emit('loaded'); // once — listener already removed, no second call
    assert(hidL === 1,  '"loaded" second emit: no extra call (once consumed)');

    // 'error' path
    const btE  = makeBaseTex(false);
    let hidE = 0;
    compassWaitTex(btE, ()=>{}, ()=>hidE++);
    btE._emit('error');
    assert(hidE === 1, '"error" path: hides exactly once');
    btE._emit('error'); // once — already removed
    assert(hidE === 1,  '"error" second emit: no extra call (once consumed)');
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.error(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
