/**
 * Roulette matches (roulette_spichki) are a server-owned currency, credited only by
 * roulette.php._rollSlot() (spin()). A browser must not manufacture them a second time
 * when reporting the spin to the achievement system.
 *
 * Bug (repro, 28.09.2026): server credits roulette_spichki via Gameops::add() and returns
 * it in the spin() patch, applied via applyPatch() in dvor-roulette.js._spinRoulette() —
 * this already sets udata['roulette_spichki'] to the correct post-award value. Afterwards
 * dvor-roulette-screen.js._resolveRouletteNewScreen() called
 * achievements.onDvorGame('roulette', {spichki: reward.sp}), and achievements.js added
 * reward.sp to udata['roulette_spichki'] AGAIN — doubling the value client-side. Because
 * 'roulette_spichki' was still in users.php's $allowed whitelist, the next debounced
 * autosave (triggered by the very mutation that doubled it) persisted the doubled amount
 * to the DB. This is the exact same bug class already fixed for poker_spichki (see
 * tests/poker-spichki-achievement-server-authoritative.test.js) — the fix just hadn't been
 * applied to roulette yet.
 *
 * Run: node tests/roulette-spichki-achievement-double-count-fix.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const roulette = read('server/core/controllers/roulette.php');
const users = read('server/core/controllers/users.php');
const achievements = read('_client/src/game/achievements.js');
const rouletteScreen = read('_client/src/game/dvor/dvor-roulette-screen.js');

// Server still credits roulette_spichki and patches it back to the client.
assert(/roulette_spichki/.test(roulette), 'roulette.php still handles roulette_spichki');
assert(/patchCurrencies\(\$user,\s*\[[^\]]*'roulette_spichki'/.test(roulette), 'spin() response patches the server balance');

// users.save must not accept roulette_spichki anymore (same treatment as poker_spichki).
// 28.09.2026: matching plain /'roulette_spichki'/ false-positives on the explanatory comment
// left right next to the removed array entry ("... 'roulette_spichki' УБРАНО отсюда же ...").
// A real array item always has a trailing comma immediately after the closing quote; the
// comment's mention doesn't (followed by a space + prose instead).
const allowedStart = users.indexOf('$allowed = [');
const allowed = users.slice(allowedStart, users.indexOf('];', allowedStart));
assert(!/'roulette_spichki',/.test(allowed), 'users.save cannot write roulette_spichki');

// The numeric-cap safety net for client-writable fields no longer needs to list it either.
const strictStart = users.indexOf('$strictNumericFields = [');
const strictBlock = users.slice(strictStart, users.indexOf('];', strictStart));
assert(!/'roulette_spichki',/.test(strictBlock), 'roulette_spichki removed from $strictNumericFields too');

// Achievement client no longer manufactures roulette matches locally.
assert(!/udata\['roulette_spichki'\]\s*=/.test(achievements), 'achievement client does not manufacture roulette matches');

// The roulette screen no longer forwards a client-side match increment to achievements.
assert(!/spichki:\s*reward\s*\?\s*reward\.sp/.test(rouletteScreen), 'roulette result does not pass a client-side match increment');

console.log('OK: roulette matches are server-authoritative, no client-side double count.');
