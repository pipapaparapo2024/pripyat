/**
 * Bug class (see agent memory incident_checkall_flush_wipes_server_credits): coins/stew/
 * cigarettes stayed in users.php's client-writable $allowed whitelist even after every real
 * currency change moved to server-authoritative controllers (Gameops::add()/deduct()+
 * saveUser(), bypassing this whitelist entirely). Because the fields were still writable, ANY
 * client-side udata mutation (an achievement threshold crossing, optimistic casino UI, a dev
 * tool) could trigger the generic debounced autosave (player-save.js) to flush a STALE local
 * currency snapshot to the server, silently clobbering a fresh server-side credit (VK payment
 * webhook, casino reward, etc.) that landed in the DB moments earlier. This was fixed
 * point-by-point three times already (votes_spent, coins_spent/stew_spent, roulette_spichki —
 * see neighboring comments in users.php) for individual symptoms of the same root cause.
 *
 * Fix (29.09.2026): coins/stew/cigarettes removed from $allowed and $strictNumericFields
 * entirely — users.save() now silently ignores these three keys regardless of what the client
 * sends (users.get()/patch are unaffected, only save() is restricted). The one legitimate
 * client-side writer left (dev-panel currency buttons + GIVE_MILLION/GIVE_CIGS/GIVE_STEW
 * console cheats) is moved to a new narrow dev-only permit, users.devGrantCurrency() — same
 * bypass-whitelist pattern as the pre-existing devGrantWeapons()/devGrantShmot(). Investigation
 * confirmed every OTHER client-side write of these three fields (hapuga.js, gangs.js — both
 * beta-locked/disabled features; dvor.js._give() — only reachable from the explicitly dead
 * dvor-roulette-spin.js; dvor-dice-screen.js buyDicePoints() — optimistic UI only, real
 * persistence goes through dice.buyPoints()+applyPatch(); vassilich.js._applyEffect() — reads
 * udata['inventory'], which no live code path ever populates) was either already dead or purely
 * cosmetic, so removing the whitelist entries breaks no live gameplay feature.
 *
 * 11.10.2026 (live repro — "won 10 blue_points in the cup minigame, roulette screen showed 0;
 * won again next game, showed 9"): dice_points/blue_points/poker_chips were the SAME bug class,
 * just missed in the 29.09.2026 cleanup — all three are credited exclusively server-side
 * (roulette.php spin()/pickCup(), dice.php start()/resolve(), habar.php.collectDay(), via
 * Gameops::add()+saveUser()) yet stayed in $allowed/$strictNumericFields, so any stale client
 * autosave could silently wipe a just-won minigame reward. Fixed the same way — removed from
 * both whitelists, dev buttons (+50/+100/+500, МИЛЛИОН ВСЕГО) routed through the now-widened
 * devGrantCurrency().
 *
 * Run: node tests/currency-whitelist-removed-devgrant-endpoint.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const users      = read('server/core/controllers/users.php');
const devPanel   = read('_client/src/game/shell/overlays/dev_panel.js');
const debugTools = read('_client/src/game/debug-tools.js');

// 1) coins/stew/cigarettes (+ dice_points/blue_points/poker_chips, 11.10.2026) can no longer
// be written through the generic whitelist.
const allowedStart = users.indexOf('$allowed = [');
const allowedBlock  = users.slice(allowedStart, users.indexOf('];', allowedStart));
for(const key of ['coins', 'stew', 'cigarettes', 'dice_points', 'blue_points', 'poker_chips']){
    assert(!new RegExp(`'${key}',`).test(allowedBlock), `users.save cannot write '${key}' via $allowed`);
}

// 2) Same keys no longer need the numeric-cap safety net (they aren't client-writable at all).
const strictStart = users.indexOf('$strictNumericFields = [');
const strictBlock = users.slice(strictStart, users.indexOf('];', strictStart));
for(const key of ['coins', 'stew', 'cigarettes', 'dice_points', 'blue_points', 'poker_chips']){
    assert(!new RegExp(`'${key}',`).test(strictBlock), `'${key}' removed from $strictNumericFields too`);
}

// 3) The new dev-only permit exists and is registered.
assert(/'devGrantCurrency'/.test(users), 'devGrantCurrency is registered in $this->permits');
assert(/function devGrantCurrency\(\)/.test(users), 'devGrantCurrency() function is defined');
const fnStart = users.indexOf('function devGrantCurrency()');
const fnBody  = users.slice(fnStart, users.indexOf('\n        }', fnStart));
assert(/loadUser\(\)/.test(fnBody), 'devGrantCurrency() loads the full row via Gameops::loadUser()');
assert(/saveUser\(\$user\)/.test(fnBody), 'devGrantCurrency() persists via Gameops::saveUser()');
assert(/foreach\(\$allowedTypes as \$type\)/.test(fnBody), 'devGrantCurrency() only accepts a fixed set of currency types');
// 11.10.2026: widened to cover the three minigame-point currencies removed from $allowed above —
// otherwise the dev-panel +50/+100/+500 buttons and МИЛЛИОН ВСЕГО would silently stop working.
for(const key of ['dice_points', 'blue_points', 'poker_chips']){
    assert(new RegExp(`'${key}'`).test(fnBody), `devGrantCurrency() $allowedTypes includes '${key}'`);
}
// All requested deltas must be applied in ONE load+save — not one server round-trip per
// currency — otherwise concurrent calls would race and clobber each other (loadUser() reads
// the full row; saveUser() writes the full row back).
assert(/foreach\(\$deltas as \$type => \$amt\) \$this->ops->add/.test(fnBody),
    'devGrantCurrency() applies every requested currency delta before a single saveUser() call');

// 4) Client dev tools no longer persist currency through the generic whitelist path.
assert(/_grantCurrencyServer/.test(devPanel), 'dev_panel.js defines/uses a devGrantCurrency helper');
assert(/users\.devGrantCurrency/.test(devPanel), 'dev_panel.js calls users.devGrantCurrency');
assert(/users\.devGrantCurrency/.test(debugTools), 'debug-tools.js GIVE_MILLION calls users.devGrantCurrency');

// _addU() must branch coins/stew/cigarettes (+ dice_points/blue_points/poker_chips, 11.10.2026)
// to the server helper instead of the generic saveDevChanges() path used for every other
// (still-whitelisted) field.
const addUStart = devPanel.indexOf('const _addU = ');
const addUBody  = devPanel.slice(addUStart, devPanel.indexOf('\n        };', addUStart));
assert(/_grantCurrencyServer/.test(addUBody), '_addU() routes through _grantCurrencyServer for currency keys');
const serverOnlyListMatch = devPanel.match(/const _SERVER_ONLY_CURRENCIES = \[([^\]]*)\];/);
assert(serverOnlyListMatch, '_SERVER_ONLY_CURRENCIES list is defined');
for(const key of ['coins', 'stew', 'cigarettes', 'dice_points', 'blue_points', 'poker_chips']){
    assert(serverOnlyListMatch[1].includes(`'${key}'`), `_SERVER_ONLY_CURRENCIES includes '${key}'`);
}
assert(addUBody.includes('_SERVER_ONLY_CURRENCIES'), '_addU() branches on the server-only currency list');

// _giveMillion() (dev_panel.js) and GIVE_MILLION (debug-tools.js) must compute a DELTA for all
// six currencies and send them through devGrantCurrency, not assign the absolute '1000000'
// directly to udata (that write would just be silently dropped by users.save() now).
for(const [label, src] of [['dev_panel.js._giveMillion', devPanel], ['debug-tools.js GIVE_MILLION', debugTools]]){
    const deltaLoopMatch = src.match(/\[('coins'|"coins")[^\]]*\]\.forEach\(key\s*=>\s*\{\s*const delta = 1000000/);
    assert(deltaLoopMatch, `${label} computes currency deltas via a forEach loop`);
    const deltaLoopSrc = deltaLoopMatch[0];
    for(const key of ['dice_points', 'blue_points', 'poker_chips']){
        assert(deltaLoopSrc.includes(`'${key}'`), `${label} includes '${key}' in the delta-computation loop`);
    }
    for(const key of ['dice_points', 'blue_points', 'poker_chips']){
        assert(!new RegExp(`udata\\['${key}'\\]\\s*=\\s*M`).test(src),
            `${label} no longer assigns udata['${key}'] = M directly (would be silently dropped)`);
    }
}

console.log('OK: coins/stew/cigarettes/dice_points/blue_points/poker_chips are server-authoritative; dev tools use the widened devGrantCurrency permit.');
