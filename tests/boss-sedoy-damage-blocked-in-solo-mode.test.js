/**
 * Репорт (30.09.2026, по прямому указанию): урон Седого нельзя использовать в Соло-режиме
 * (bosses._diffIdx === 3, "один на один") — Седой не должен помогать добивать босса, это
 * ломает саму суть режима. При попытке клика по кнопке "Седой" в Соло должен показываться
 * попап ошибки в духе "братух, мы же договорились один на один, справляйся как-нибудь сам",
 * а не реальный удар.
 *
 * Два независимых места блока (как и у остальных boss-экономик, см. Gameops-паттерн):
 *  1. Клиент (bosses_fight.js._useSedoyDamage) — блокирует ДО сетевого запроса, показывает
 *     notify.showResult(...) с фразой Седого, не даёт даже отправить bosses.useSedoy.
 *  2. Сервер (bosses.php.useSedoy()) — тот же блок по diff_idx, fail(90). Обязателен отдельно
 *     от клиентского: модифицированный клиент мог бы звать bosses.useSedoy с diff_idx=3 в обход
 *     UI-проверки, если бы сервер её не дублировал.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CLIENT_FILE = path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js');
const SERVER_FILE = path.join(__dirname, '..', 'server', 'core', 'controllers', 'bosses.php');

const clientSrc = fs.readFileSync(CLIENT_FILE, 'utf-8');
const serverSrc = fs.readFileSync(SERVER_FILE, 'utf-8');

// --- Клиент ---------------------------------------------------------------

// Блок должен стоять ВНУТРИ _useSedoyDamage, ДО первого сетевого вызова TS.php('bosses.useSedoy', ...)
const useSedoyBody = clientSrc.slice(
    clientSrc.indexOf('proto._useSedoyDamage = function'),
    clientSrc.indexOf("TS.php('bosses.useSedoy'")
);
assert.ok(
    /bosses\._diffIdx\s*===\s*3/.test(useSedoyBody),
    '_useSedoyDamage должен проверять bosses._diffIdx === 3 (Соло) ДО отправки запроса на сервер'
);
assert.ok(
    /notify\.showResult\(\{text:'[^']*(договор|один на один|сам)[^']*'\}/i.test(useSedoyBody),
    '_useSedoyDamage должен показывать notify.showResult с фразой про "один на один" при попытке ударить Седым в Соло'
);
// return сразу после проверки — не должно доходить до реальной логики удара ниже по функции
const soloBlockIdx = useSedoyBody.search(/bosses\._diffIdx\s*===\s*3/);
const returnAfterIdx = useSedoyBody.indexOf('return;', soloBlockIdx);
assert.ok(
    soloBlockIdx >= 0 && returnAfterIdx > soloBlockIdx && (returnAfterIdx - soloBlockIdx) < 200,
    'после проверки Соло-режима должен идти немедленный return — блок не должен проваливаться в реальную логику удара'
);

// Код ошибки 90 должен быть замаплен в человекочитаемое сообщение в error-колбэке того же метода
const useSedoyFull = clientSrc.slice(
    clientSrc.indexOf('proto._useSedoyDamage = function'),
    clientSrc.indexOf('proto._updateBossFightHpDisplay')
);
assert.ok(
    /90:\s*'[^']*(договор|один на один|сам)[^']*'/i.test(useSedoyFull),
    'error-колбэк _useSedoyDamage должен маппить код 90 на фразу про "один на один" (на случай, если запрос всё же ушёл на сервер)'
);

// --- Сервер -----------------------------------------------------------------

const useSedoyPhp = serverSrc.slice(
    serverSrc.indexOf('function useSedoy()'),
    serverSrc.indexOf('function ', serverSrc.indexOf('function useSedoy()') + 20)
);
assert.ok(
    /if\s*\(\s*\$diffIdx\s*===\s*3\s*\)\s*return\s*\$this->ops->fail\(90\)/.test(useSedoyPhp),
    'server useSedoy() должен возвращать fail(90) при $diffIdx === 3 (Соло) — независимая от клиента защита'
);
// Проверка diffIdx===3 обязана идти РАНЬШЕ loadUser()/списания sedoy_dmg_left — не тратим
// урон Седого и не трогаем БД, если запрос всё равно будет отклонён.
const diffCheckPos = useSedoyPhp.search(/\$diffIdx\s*===\s*3/);
const loadUserPos = useSedoyPhp.indexOf('loadUser()');
assert.ok(
    diffCheckPos >= 0 && loadUserPos > diffCheckPos,
    'проверка Соло-режима на сервере должна идти ДО loadUser()/списания урона Седого'
);

console.log('OK: boss-sedoy-damage-blocked-in-solo-mode.test.js');
