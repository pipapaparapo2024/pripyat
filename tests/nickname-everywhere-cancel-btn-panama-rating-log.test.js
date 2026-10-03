/**
 * Test: 17.09.2026 (одиннадцатый батч) — репорт пользователя:
 *
 *  1) Рейтинг урона в бою с боссом иногда показывает пустые строки — расследование показало,
 *     что server-side логирование (error_log в bosses.rating()) молчало с 30.08.2026: пул
 *     PHP-FPM переопределяет error_log через php_admin_value (нельзя перекрыть ini_set() из
 *     кода) на путь /var/log/php_errors.log, которого не существовало — файл создан вручную
 *     (touch + chown www-data), теперь server-side логи снова пишутся. Добавлено доп.
 *     клиентское логирование в _loadBossFightRating (текущее значение curCycleDmg в памяти
 *     + результат users.save) для следующей диагностики.
 *
 *  2) Кнопка ОТМЕНА в попапе «ТОРМОЗИ» (нет оружия) — позиция снята редактором позиций,
 *     применена и к спрайту, и к хит-зоне (были на одной точке раньше — держим синхронно).
 *
 *  3) Панама СССР — поднята на 1px (manDy 15→14) по прямому указанию.
 *
 *  4) Игровой ник (не имя VK) теперь показывается во всех рейтингах, где отображается имя:
 *     Сводка (топ по авторитету/урону/достижениям) и рейтинг урона в бою с боссом. top.php и
 *     bosses.php (rating/killers) теперь дополнительно отдают nick с сервера. Экраны, где
 *     сейчас показывается только ФОТО без имени (bosses_select «убивший», zone_screen «рамка
 *     уважения») — сервер тоже отдаёт nick (на будущее), но менять там нечего, имя не рисуется.
 *
 * Run: node tests/nickname-everywhere-cancel-btn-panama-rating-log.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const bossesFightSrc = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const shmotSrc        = readSrc('_client/src/game/shmot.js');
const svodLbSrc        = readSrc('_client/src/game/svod/svod-leaderboard.js');
const topPhp            = readSrc('server/core/controllers/top.php');
const bossesPhp          = readSrc('server/core/controllers/bosses.php');

console.log('\nTest 1: _loadBossFightRating — упрощена 22.09.2026 (curCycleDmg/users.save-флаш убраны, см. boss-attack-server-authoritative-and-timing-friend-rule.test.js)');
{
    const start = bossesFightSrc.indexOf('proto._loadBossFightRating = function(bossIdx){');
    const end   = bossesFightSrc.indexOf('\n    };', start);
    const body  = bossesFightSrc.slice(start, end);
    assert(!/curCycleDmg/.test(body), 'больше не логирует curCycleDmg — поле убрано как источник правды (rating() теперь читает boss_damage_log напрямую)');
    assert(!/TS\.php\('users\.save'/.test(body), 'флаш users.save перед запросом рейтинга убран — данные в boss_damage_log уже гарантированно свежие');
    assert(/this\._fetchBossFightRating\(bossIdx\);/.test(body), 'по-прежнему сразу запрашивает рейтинг');
}

console.log('\nTest 2: попап ТОРМОЗИ — кнопка ОТМЕНА (визуальная подсветка) и её хит-зона (кликабельная область)');
{
    const start = bossesFightSrc.indexOf('proto._openNoWeaponPopup = function()');
    const end   = bossesFightSrc.indexOf('this._noWpnWin = win;');
    const body  = bossesFightSrc.slice(start, end);
    assert(/отменаActiv\.x = 655; отменаActiv\.y = 352;/.test(body), 'отменаActiv (вспышка-подсветка при клике): x=655 y=352 (снято редактором позиций 17.09.2026, этой правкой не тронуто)');
    // 28.09.2026: хит-зона откалибрована редактором позиций НЕЗАВИСИМО от вспышки-подсветки
    // выше (реальная кликабельная область теперь не выводится из позиции спрайта отменаActiv,
    // а снята напрямую по факту, где на фоновой картинке нарисована кнопка) — координаты двух
    // элементов больше не обязаны совпадать численно.
    assert(/makeParallelogramHit\(win, 666, 388, 219, 36, 18\)/.test(body), 'hitCancel — параллелограммная кликабельная зона (28.09.2026: позиция уточнена редактором позиций)');
}

// 23.09.2026: id:24 «Панама СССР» удалена целиком батчем "убери все шмотки, которые покупаются
// за монеты/тушёнку" (дублировала дроп-вещь «Панама (Охотник)») — позиционный разбор manDy
// неактуален, тест теперь регресс-гвард на отсутствие id:24.
console.log('\nTest 3: Панама СССР (id:24) удалена батчем 23.09.2026');
{
    const line = shmotSrc.split('\n').find(l => l.includes('id:24') && l.includes('Панама СССР'));
    assert(!line, 'предмет id:24 отсутствует в shmot.js (удалён — дублировал «Панама (Охотник)»)');
}

console.log('\nTest 4: сервер отдаёт игровой ник (nick) во всех рейтингах');
{
    assert(/\['id', \$field, 'exp', 'nick'\]/.test(topPhp), 'top.get() выбирает nick из БД');
    assert(/'nick'=>strval\(\$r\['nick'\] \?\? ''\)/.test(topPhp), 'top.get() отдаёт nick в каждой строке');

    // 22.09.2026 (второй раз — rating() дальше разбит на общий _ratingTop(), переиспользуемый
    // claimKill() для попапа победы, см. boss-victory-popup-top-and-double-kill-count-fix.
    // test.js): композиция ника переехала внутрь _ratingTop(), _ratingTop() определена ПЕРЕД
    // rating() в файле — окно расширено, чтобы захватить обе функции разом.
    const ratingStart = bossesPhp.indexOf('private function _ratingTop(');
    const ratingEnd   = bossesPhp.indexOf('function killers()');
    const ratingBody  = bossesPhp.slice(ratingStart, ratingEnd);
    assert(/array\('bosses_data', 'friends', 'nick'\)/.test(ratingBody), 'bosses.rating() выбирает СВОЙ nick из БД');
    assert(/strval\(\$me\['nick'\] \?\? ''\)/.test(ratingBody), 'bosses.rating() передаёт СВОЙ nick в _ratingTop()');
    assert(/array\('id', 'nick'\)/.test(ratingBody), 'bosses.rating() отдельно выбирает nick друзей из БД');
    assert(/'nick' => \$nicks\[\$fid\] \?\? ''/.test(ratingBody), '_ratingTop() отдаёт nick друзей в каждой строке');

    const killersStart = bossesPhp.indexOf('function killers()');
    const killersEnd   = bossesPhp.indexOf('function recordKill()');
    const killersBody  = bossesPhp.slice(killersStart, killersEnd);
    assert(/LEFT JOIN `\{\$utb\}` u ON u\.`id` = bl\.`user_id`/.test(killersBody),
        'bosses.killers() джойнится с users для nick (своя таблица boss_last_kill его не хранит)');
}

console.log('\nTest 5: клиент предпочитает игровой ник имени VK во всех местах, где имя реально рисуется');
{
    // Сводка — обе ветки _loadLeaderboard (с VK-резолвом и без)
    // 21.09.2026: добавлен .trim() на каждом варианте (баг "имя сломано/пустое" — ник из одних
    // пробелов раньше проходил как "истинный") — приоритет entry.nick над VK-именем не менялся.
    assert(/r\.nameTxt\.text = \(entry\.nick && entry\.nick\.trim\(\)\) \|\| \(u && u\.name && u\.name\.trim\(\)\) \|\| \('ID ' \+ entry\.id\);/.test(svodLbSrc),
        'Сводка (с резолвом VK): entry.nick в приоритете (с защитой от пустого/пробельного значения)');
    assert(/r\.nameTxt\.text = entry\.nick \|\| \('ID ' \+ entry\.id\);/.test(svodLbSrc),
        'Сводка (без резолва VK): entry.nick в приоритете');

    // Рейтинг урона в бою с боссом — 04.10.2026: ник/урон теперь выставляются синхронно из
    // top (entry.nick || '', не ждёт VK-резолва, см. incident про зависающий _resolveVkUsers),
    // а VK-имя/'Сталкер' подставляются ТОЛЬКО если entry.nick пуст — тот же итоговый приоритет
    // (nick → VK-имя → 'Сталкер'), просто в два шага вместо одного выражения.
    assert(/row\.nameTxt\.text = entry\.nick \|\| '';/.test(bossesFightSrc),
        'Рейтинг урона в бою: entry.nick выставляется синхронно (приоритет №1)');
    assert(/if\(!row\.nameTxt\.text\) row\.nameTxt\.text = \(u && u\.name\) \|\| 'Сталкер';/.test(bossesFightSrc),
        'Рейтинг урона в бою: VK-имя/Сталкер — fallback ТОЛЬКО когда entry.nick не пришёл');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
