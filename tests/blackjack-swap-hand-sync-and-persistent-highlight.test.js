const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(root, '_client/src/game/dvor/dvor-blackjack.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server/core/controllers/blackjack.php'), 'utf8');
let failed = 0;
const check = (ok, text) => ok ? console.log('  OK', text) : (console.error('  FAIL', text), failed++);

check(/'hand'\s*=>\s*\$active\['hand'\]/.test(server), 'swap returns the complete authoritative hand');
check(/Array\.isArray\(res\.hand\) && res\.hand\.length === 2/.test(client), 'client accepts complete hand after every swap');
check(/for\(let realIdx = 2; realIdx <= 3; realIdx\+\+\)/.test(client), 'both real card sprites are synchronized');
const highlight = client.slice(client.indexOf('proto._bjShowComboHighlight'), client.indexOf('proto._updateBlackjackUI'));
check(!/setTimeout/.test(highlight) && !/onComplete/.test(highlight), 'winning row does not auto-hide');
check(/this\._bjComboHighlight\.visible = false/.test(client), 'old highlight is cleared when a new game starts');
check(/'валет':\s+352/.test(client), 'JJ maps to its explicit payout row');

if(failed) process.exit(1);
