/*
 * Регрессия: браузер не является источником рулеточных спичек.
 *
 * Обычные призы уже входят в patch ответа roulette.spin; проигрыш гонки за
 * связку ключей также не может выдавать клиентскую «компенсацию».
 *
 * Run: node tests/roulette-client-match-credit-security.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const screen = read('_client/src/game/dvor/dvor-roulette-screen.js');
const roulette = read('_client/src/game/dvor/dvor-roulette.js');
const controller = read('server/core/controllers/roulette.php');

const keyringBranch = screen.match(/else if\(slot\.type === 'key_bundle'\)\{([\s\S]*?)\n        \} else \{/);
assert(keyringBranch, 'ветка Связки ключей найдена');
assert(!/\b(?:this\.)?_give\(\s*['"]roulette_spichki['"]/.test(keyringBranch[1]),
    'проигрыш гонки за Связку не начисляет спички из клиента');
assert(!/50 спичек/.test(keyringBranch[1]),
    'в ветке Связки нет клиентской компенсации в 50 спичек');

assert(/applyPatch\(res\.patch\);/.test(roulette),
    'баланс после roulette.spin обновляется только серверным patch');
assert(/case 'roulette_spichki':\s*\$this->ops->add\(\$user, 'roulette_spichki', \$slot\['amt'\]\);/.test(controller),
    'обычный приз-спички начисляет roulette.spin на сервере');

console.log('roulette client match-credit security: OK');
