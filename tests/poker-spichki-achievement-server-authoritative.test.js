/**
 * Poker purple matches are a server-owned achievement statistic. A browser
 * must not manufacture poker_spichki and turn it into bullets.
 *
 * 20.10.2026 (по прямому указанию — "это должны быть одинаковые спички, исправь"):
 * poker_spichki и roulette_spichki были разведены как отдельные валюты (27.09.2026) — решение
 * пересмотрено, теперь это ОДНА общая валюта. Канонический столбец — roulette_spichki (см.
 * poker.php.openBag()/server/json/poker_config.json) — poker_spichki больше нигде не
 * начисляется и не списывается, старый баланс переносится одноразовой миграцией
 * (tests/_fixtures/schema-history/migrate49.php.txt). Тест обновлён под новый канонический столбец.
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
    assert.equal(config.combos[key].type, 'roulette_spichki', `${key} pays the shared matches currency`);
}
assert(/'roulette_spichki'/.test(poker.match(/\$currencyMap = \[[^\]]+\]/)[0]), 'poker.resolve credits the shared matches currency on server');
assert(/patchKeys = \[[^\]]*'roulette_spichki'/.test(poker), 'response patches the server balance');
assert(!/\$currencyMap = \[[^\]]*'poker_spichki'/.test(poker), 'poker_spichki no longer appears in the award whitelist (dead field, see migrate49.php)');
assert(!/\$patchKeys = \[[^\]]*'poker_spichki'/.test(poker), 'poker_spichki no longer appears in the patch keys');

const allowedStart = users.indexOf('$allowed = [');
const allowed = users.slice(allowedStart, users.indexOf('];', allowedStart));
assert(!/'poker_spichki'/.test(allowed), 'users.save cannot write poker_spichki');
assert(!/udata\['poker_spichki'\]\s*=/.test(achievements), 'achievement client does not manufacture poker matches');
assert(!/spichki:\s*res\.sp/.test(pokerGame), 'poker result does not pass a client-side match increment');

console.log('OK: shared matches currency and poker achievement thresholds are server-authoritative.');
