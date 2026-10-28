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

console.log('\nПозиция таймера — 28.10.2026 заменена на 4 индивидуальных значения x (по одному на плашку), вместо единой формулы BTN_X[i]+offset');
assert(/const TIMER_X = \[279, 524, 769, 1014\];/.test(habarSrc), 'x для 4 плашек (Обычный/Пацанский/Авторитетный/Элитный)');
assert(/const TIMER_Y = 508;/.test(habarSrc), 'общий Y для всех 4 плашек');
// 28.10.2026 (БАГ, исправлено тем же днём): x/y из редактора для anchor(0.5,0.5)-объекта — уже
// готовые object.x/y, без доп. +w/2,+h/2 (первая версия правки ошибочно это добавляла).
assert(/timer\.x = TIMER_X\[i\];/.test(habarSrc), 'X таймера присваивается напрямую, без хитбокс-математики');
assert(/timer\.y = TIMER_Y;/.test(habarSrc), 'Y таймера присваивается напрямую, без хитбокс-математики');
assert(!/timer\.x = TIMER_HIT_X/.test(habarSrc), 'старая (ошибочная) формула с TIMER_HIT_X не осталась');
// 20.10.2026 (редактор позиций, по прямому указанию): fontSize поднят 23→28.
assert(/const timer = new PIXI\.Text\('', \{\s*\n\s*fontFamily:'Southbank LT', fontSize:28,/.test(habarSrc),
    'таймер получил новый fontSize:28 (было 23)');
assert(!/timer\.scale\.set\(/.test(habarSrc), 'scale.set() для timer больше не вызывается');

console.log('\nСчётчик "N/30" — восстановлен 28.10.2026 (по прямому указанию, "как раньше было"), в той же строке, что и таймер');
// 20.10.2026: счётчик был убран из UI целиком (как отдельный PIXI.Text daysTxt).
// 28.10.2026 (по прямому указанию — "верни кол-во собранных хабаров N/30 как раньше было,
// умести время и количество в одну строку"): возвращён, но НЕ как второй текстовый объект —
// дописывается в ТОТ ЖЕ timer.text через пробел (см. _updateHabarTimer), поэтому отдельный
// массив меток daysTxt/_habarDaysLabels по-прежнему не существует.
assert(!/this\._habarDaysLabels/.test(habarSrc), 'массив меток дней (daysTxt) по-прежнему не существует — счётчик живёт в timer.text, не в отдельном объекте');
assert(!/const daysTxt = /.test(habarSrc), 'daysTxt как отдельный PIXI.Text по-прежнему не создаётся');
assert(/\+ '\/30'/.test(habarSrc), 'текст вида "N/30" снова формируется (внутри timer.text)');
assert(/const collected = parseInt\(udata\['habar_days_collected'\] \|\| 0\);/.test(habarSrc),
    'habar_days_collected снова читается для отображения');

console.log('\nПерсистентность на сервере — прямой ответ на вопрос пользователя (актуализировано после переноса хабара на сервер)');
assert(/TS\.php\('habar\.collectDay', \{\}, \(res\) => \{/.test(habarSrc),
    '_collectDay() шлёт запрос на сервер (habar.collectDay), не пишет habar_days_collected/habar_last_collect_ts сама');
assert(!/'habar_days_collected'/.test(usersSrc.match(/\$allowed\s*=\s*\[[\s\S]*?\];/)?.[0] || usersSrc),
    'habar_days_collected НЕ в client-writable whitelist $allowed (сознательно снято — см. комментарий 24.09.2026 в users.php)');
assert(/habar_days_collected\/habar_last_collect_ts УБРАНЫ из этого списка обратно/.test(usersSrc),
    'в users.php задокументировано, что оба поля намеренно убраны из whitelist (перенос на сервер)');

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);
