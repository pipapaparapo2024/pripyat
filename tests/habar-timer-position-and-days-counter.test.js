/**
 * Test: 24.09.2026, по прямому указанию, редактор позиций ("Выбрано: Текст '23:59:37' x:985
 * y:504") — таймер до следующего сбора хабара переставлен на измеренную позицию, плюс новый
 * счётчик "N/30" справа от него (изначально +40px по X, тот же Y).
 *
 * 25.09.2026 (по прямому указанию, редактор позиций — "Выбрано: x:1047 y:504 scale:1.000" для
 * купленного слота 3): смещение счётчика "N/30" уточнено с +40 до +62px по X (Y не менялся) —
 * см. комментарий в habar.js.
 *
 * Также проверяет ответ на прямой вопрос пользователя "сохраняется ли эта информация на
 * сервер" — да, но способ изменился ПОЗЖЕ в тот же день (перенос экономики хабара на сервер,
 * по прямому указанию): раньше habar_days_collected/habar_last_collect_ts писались общим
 * users.save (client-writable, читер мог обнулить кулдаун из консоли). Теперь эти поля СНЯТЫ
 * с client-writable whitelist и пишет их только сервер (habar.php.collectDay(), через
 * Gameops::loadUser()/saveUser()) — клиент их только читает для отображения таймера.
 *
 * Run: node tests/habar-timer-position-and-days-counter.test.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

const habarSrc = read('_client/src/game/habar.js');
const usersSrc = read('server/core/controllers/users.php');

console.log('\nПозиция таймера — уточнена редактором позиций 03.10.2026 (x:971 y:506 для купленного слота Элитный)');
assert(/const TIMER_OFFSET_X = 26, TIMER_OFFSET_Y = 17;/.test(habarSrc), 'новое смещение +26/+17 от BTN_X[i]/BTN_Y[i] (даёт 971/506 для слота 3, было +40/+15)');
assert(/timer\.x = BTN_X\[i\] \+ TIMER_OFFSET_X;/.test(habarSrc), 'X таймера использует новую константу смещения');
assert(/timer\.y = BTN_Y\[i\] \+ TIMER_OFFSET_Y;/.test(habarSrc), 'Y таймера использует новую константу смещения');
assert(/timer\.scale\.set\(1\.258\);/.test(habarSrc), 'таймер получил scale 1.258 (редактор позиций 03.10.2026)');

console.log('\nСчётчик "N/30" — новый текст, правее таймера, тот же Y, та же видимость');
assert(/this\._habarDaysLabels = \[\];/.test(habarSrc), 'массив меток дней инициализирован рядом с массивом таймеров');
assert(/daysTxt\.x = timer\.x \+ 86;/.test(habarSrc), 'X = таймер + 86px (уточнено редактором позиций 03.10.2026, было +62)');
assert(/daysTxt\.y = timer\.y;/.test(habarSrc), 'Y — тот же, что у таймера');
assert(/daysTxt\.scale\.set\(1\.253\);/.test(habarSrc), 'счётчик дней получил scale 1.253 (редактор позиций 03.10.2026)');
assert(/daysTxt\.visible = !canCollect;/.test(habarSrc), 'видимость синхронна с таймером (появляется/исчезает вместе)');
assert(/daysTxt\.text = Math\.min\(collected, 30\) \+ '\/30';/.test(habarSrc), 'текст — N/30, где N = habar_days_collected (капнуто на 30)');

console.log('\nПерсистентность на сервере — прямой ответ на вопрос пользователя (актуализировано после переноса хабара на сервер)');
assert(/TS\.php\('habar\.collectDay', \{\}, \(res\) => \{/.test(habarSrc),
    '_collectDay() шлёт запрос на сервер (habar.collectDay), не пишет habar_days_collected/habar_last_collect_ts сама');
assert(!/'habar_days_collected'/.test(usersSrc.match(/\$allowed\s*=\s*\[[\s\S]*?\];/)?.[0] || usersSrc),
    'habar_days_collected НЕ в client-writable whitelist $allowed (сознательно снято — см. комментарий 24.09.2026 в users.php)');
assert(/habar_days_collected\/habar_last_collect_ts УБРАНЫ из этого списка обратно/.test(usersSrc),
    'в users.php задокументировано, что оба поля намеренно убраны из whitelist (перенос на сервер)');

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);
