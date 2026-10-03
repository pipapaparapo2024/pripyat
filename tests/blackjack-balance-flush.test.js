/** Платная партия должна дождаться сохранения актуального баланса в БД. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(root, '_client/src/game/dvor/dvor-blackjack.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server/core/controllers/blackjack.php'), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }

const playStart = client.indexOf('proto._playBlackjack = function(){');
const playEnd = client.indexOf('proto._revealBlackjackCards', playStart);
const play = client.slice(playStart, playEnd);
assert(/flushPlayerSave\('blackjack_deal', \(\) => \{/.test(play), 'перед blackjack.deal должен выполняться флаш udata');
assert(play.indexOf("flushPlayerSave('blackjack_deal'") < play.indexOf("TS.php('blackjack.deal'"), 'флаш должен начаться раньше серверной оплаты');
assert(/coins после флаша/.test(play), 'лог должен показывать баланс в момент запроса');
assert(/\[blackjack\.deal\] отказ code=84/.test(server), 'сервер должен логировать фактический баланс при code 84');
assert(/coinsInDb=.*\$this->ops->i\(\$user, 'coins'\)/.test(server), 'лог code 84 должен содержать баланс БД');
console.log('OK: blackjack balance flush checks passed');
