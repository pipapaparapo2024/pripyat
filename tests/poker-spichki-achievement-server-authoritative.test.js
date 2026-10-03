/**
 * Poker purple matches are a server-owned achievement statistic. A browser
 * must not manufacture poker_spichki and turn it into bullets.
 * Run: node tests/poker-spichki-achievement-server-authoritative.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const poker = read('server/core/controllers/poker.php');
const users = read('server/core/controllers/users.php');
const config = JSON.parse(read('server/json/poker_config.json'));
const achievements = read('_client/src/game/achievements.js');
const pokerGame = read('_client/src/game/dvor/dvor-poker-game.js');

for(const key of ['straight', 'three_of_a_kind', 'high_card']) {
    assert.equal(config.combos[key].type, 'poker_spichki', `${key} pays poker matches`);
}
assert(/'poker_spichki'/.test(poker.match(/\$currencyMap = \[[^\]]+\]/)[0]), 'poker.resolve credits poker matches on server');
assert(/patchKeys = \[[^\]]*'poker_spichki'/.test(poker), 'response patches the server balance');

const allowedStart = users.indexOf('$allowed = [');
const allowed = users.slice(allowedStart, users.indexOf('];', allowedStart));
assert(!/'poker_spichki'/.test(allowed), 'users.save cannot write poker_spichki');
assert(!/udata\['poker_spichki'\]\s*=/.test(achievements), 'achievement client does not manufacture poker matches');
assert(!/spichki:\s*res\.sp/.test(pokerGame), 'poker result does not pass a client-side match increment');

console.log('OK: poker matches and poker achievement thresholds are server-authoritative.');
