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
// 08.10.2026 (фикс пикселизации текста): fontSize:18×scale(1.258) заменены на итоговый
// fontSize:23 без scale.
assert(/const timer = new PIXI\.Text\('', \{\s*\n\s*fontFamily:'Southbank LT', fontSize:23,/.test(habarSrc),
    'таймер получил итоговый fontSize:23 (18×1.258), не через scale');
assert(!/timer\.scale\.set\(/.test(habarSrc), 'scale.set() для timer больше не вызывается');

console.log('\nСчётчик "N/30" — убран целиком 20.10.2026 (по прямому указанию: "количество сборов можешь записывай, но не выставляй на экран")');
// 20.10.2026: срок действия хабара перестал зависеть от числа сборов (теперь 30 КАЛЕНДАРНЫХ
// дней от habar_bought_ts, см. habar-30-days-from-purchase-msk-daily-reset.test.js) — счётчик
// "N/30" на экране терял смысл и мог вводить в заблуждение (число сборов ≠ оставшиеся дни),
// поэтому убран из UI целиком. Сервер по-прежнему пишет habar_days_collected (статистика).
assert(!/this\._habarDaysLabels/.test(habarSrc), 'массив меток дней (daysTxt) больше не существует');
assert(!/const daysTxt = /.test(habarSrc), 'daysTxt как PIXI.Text больше не создаётся');
assert(!/\+ '\/30'/.test(habarSrc), 'текст вида "N/30" нигде не формируется');

console.log('\nПерсистентность на сервере — прямой ответ на вопрос пользователя (актуализировано после переноса хабара на сервер)');
assert(/TS\.php\('habar\.collectDay', \{\}, \(res\) => \{/.test(habarSrc),
    '_collectDay() шлёт запрос на сервер (habar.collectDay), не пишет habar_days_collected/habar_last_collect_ts сама');
assert(!/'habar_days_collected'/.test(usersSrc.match(/\$allowed\s*=\s*\[[\s\S]*?\];/)?.[0] || usersSrc),
    'habar_days_collected НЕ в client-writable whitelist $allowed (сознательно снято — см. комментарий 24.09.2026 в users.php)');
assert(/habar_days_collected\/habar_last_collect_ts УБРАНЫ из этого списка обратно/.test(usersSrc),
    'в users.php задокументировано, что оба поля намеренно убраны из whitelist (перенос на сервер)');

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);
