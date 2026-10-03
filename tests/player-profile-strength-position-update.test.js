/**
 * Test: 24.09.2026, по прямому указанию, скриншот редактора позиций — "Выбрано: Текст '0'
 * x:117 y:301 scale:1.000 rot:-3°" (визитка игрока, значение СИЛЫ). Было x:144.5 y:342.5 rot:-2°.
 *
 * Run: node tests/player-profile-strength-position-update.test.js
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), 'utf8');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

const idx = src.indexOf("const strTxt = new PIXI.Text(String(profile.strength || 0), CARD_VALUE_STYLE);");
assert(idx !== -1, 'strTxt найден');
const body = src.slice(idx, idx + 300);

console.log('\nПозиция/поворот значения СИЛЫ уточнены редактором позиций');
assert(/strTxt\.x = 117; strTxt\.y = 301;/.test(body), 'x:117 y:301 (было 144.5/342.5)');
assert(/strTxt\.rotation = -3 \* Math\.PI \/ 180;/.test(body), 'поворот -3° (было -2°)');
assert(!/strTxt\.x = 144\.5/.test(src), 'старое значение x не осталось нигде в файле');
assert(/this\._profileStrTxt = strTxt;/.test(src), 'ссылка для мгновенного обновления после "качнуть" сохранена (не тронута этим фиксом)');

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);
