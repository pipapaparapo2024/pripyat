/** Проверка: Database::trueJSON() возвращает JSON как PHP-массив, поэтому строковое !==
 * давало ложную тревогу при каждом сохранении bosses_data и blackjack_session. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
function assert(condition, message) { if (!condition) throw new Error(message); passed++; }

const gameops = read('server/core/models/gameops.php');
const bosses = read('server/core/controllers/bosses.php');
const blackjack = read('server/core/controllers/blackjack.php');

assert(/function sameJsonState\(\$saved, \$loaded\)/.test(gameops), 'Gameops должен нормализовать JSON перед сравнением');
assert(/\$saved == \$loaded/.test(gameops), 'сравнение должно игнорировать порядок ключей после декодирования');
assert((bosses.match(/sameJsonState\(\$user\['bosses_data'\], \$verifyRaw\)/g) || []).length === 2,
    'attack() и claimKill() должны использовать нормализованное сравнение');
assert((blackjack.match(/sameJsonState\(\$user\['blackjack_session'\], \$verifyRaw\)/g) || []).length === 3,
    'deal(), swap() и resolve() должны использовать нормализованное сравнение');
assert(!/\$verifyRaw !== \$user\['bosses_data'\]/.test(bosses), 'в bosses не должно остаться ложного строгого сравнения');
assert(!/\$verifyRaw !== \$user\['blackjack_session'\]/.test(blackjack), 'в blackjack не должно остаться ложного строгого сравнения');

console.log(`OK: ${passed} JSON save-verification checks passed`);
