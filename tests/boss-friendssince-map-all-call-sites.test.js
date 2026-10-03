/**
 * Test: 30.09.2026, найдено по прямому указанию — при разборе устаревших тестов
 * (boss-fight-session-cache-and-friend-cursor.test.js/boss-rating-hp-scoped-by-boss-id.test.js,
 * которые ещё матчили сигнатуры ДО рефакторинга 29.09.2026) вскрылось, что сам рефакторинг был
 * применён НЕПОЛНОСТЬЮ.
 *
 * Корень: 29.09.2026 _syncFightSession()/_applyFriendDamage()/_friendsDamageSumSince() перешли с
 * плоского списка друзей ($friendIds) на карту $friendsSince = {uid: effectiveSinceMs} (фикс
 * retroactive-урона друга, см. большой комментарий у _friendsSinceMap() в bosses.php). Но карту
 * реально строил (через _friendsSinceMap()) только ОДИН из четырёх вызывающих мест —
 * friendsDamage() (периодический опрос экрана боя). Три других — startFight(), attack(),
 * claimKill() — по-прежнему передавали сырой $friendIds/$hpFriendIds НАПРЯМУЮ в параметр,
 * который функции ниже трактуют как карту.
 *
 * Разбор последствий: _friendsSinceConds($friendsSince) делает `foreach($friendsSince as $uid =>
 * $since)`. На плоском индексированном массиве PHP это даёт $uid = 0,1,2... (индексы), $since =
 * реальные VK id друзей. В SQL улетает условие вида "(`uid`=0 AND `time`>=123456789) OR (`uid`=1
 * AND `time`>=987654321)" — которое практически никогда не совпадёт ни с одной строкой
 * `boss_damage_log` (обычные uid — положительные VK id, не 0/1/2). Итог: на трёх из четырёх
 * путей (старт боя, каждая атака, клейм победы) урон друга физически НЕ подхватывался —
 * фактически он применялся только когда клиент успевал сделать периодический опрос
 * (bosses.friendsDamage, см. bosses-combat.js._syncFriendsDamage) ДО того, как игрок нажимал
 * "ударить"/"забрать награду". На практике это читалось бы как "урон друга то появляется, то
 * нет" или "победа не засчитывается, хотя друг явно добивал" — в зависимости от таймингов опроса.
 *
 * Фикс: startFight()/attack()/claimKill() теперь тоже вызывают _friendsSinceMap($user, $friendIds,
 * $sinceMs) ПЕРЕД _syncFightSession() — по образцу уже работавшего friendsDamage().
 *
 * ⚠️ Пятое место (найдено уже ПОСЛЕ первого прохода фикса — именно тестом 5 ниже, который считает
 * ВСЕ вызовы _syncFightSession() в файле, а не только 4 ожидаемых): useSedoy() тоже строит личный
 * HP-кэш через _syncFightSession() и ТОЖЕ передавал сырой $friendIds. Исправлено так же.
 *
 * ⚠️⚠️ 04.10.2026 (найдено заново, по репорту "убил босса в группе, но рейтинг урона и попап
 * победы/поражения показывают только меня, хотя урон друзьям явно приходит — HP снижается"):
 * фикс выше 30.09.2026 закрыл только ОДНУ из двух параллельных веток, читающих $friendsSince —
 * HP-путь (_syncFightSession()). Вторая ветка — РЕЙТИНГ УЧАСТНИКОВ (_ratingTop(), панель
 * «РЕЙТИНГ УРОНА» + попап результата боя) — имеет СВОИ три вызывающих места (rating(),
 * endFightSession(), claimKill() — последний отдельно от своего же HP-вызова на несколько строк
 * ниже) и ни одно из них тогда не трогали. Все три передавали тот же сырой $friendIds напрямую —
 * тот же баг, что описан выше, только в другой функции: HP честно снижался (путь через
 * friendsDamage()/_syncFightSession() был уже исправлен), а список участников оставался пустым
 * (кроме себя) — ровно симптом из репорта. Фикс (Test 7/8 ниже): rating()/endFightSession()
 * теперь строят $friendsSince через _friendsSinceMap() перед вызовом _ratingTop(); claimKill()
 * переиспользует $hpFriendsSince, уже посчитанный чуть выше для HP-проверки, вместо повторной
 * сборки сырого списка.
 *
 * Run: node tests/boss-friendssince-map-all-call-sites.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bossesPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');

function bodyOf(startMarker, endMarker) {
    const start = bossesPhp.indexOf(startMarker);
    const end = endMarker ? bossesPhp.indexOf(endMarker, start) : bossesPhp.length;
    return bossesPhp.slice(start, end);
}

console.log('\nTest 1: startFight() строит $friendsSince через _friendsSinceMap() перед _syncFightSessionLocked()');
{
    // 04.10.2026: startFight() переведён на _syncFightSessionLocked() (блокировка строки — защита
    // от гонки параллельных запросов, см. tests/boss-fight-session-row-lock-race.test.js) —
    // карта $friendsSince по-прежнему строится ДО вызова, просто вызов теперь locked-вариант.
    const body = bodyOf('function startFight(){', 'function _loadWeaponsLocal(');
    const mapIdx = body.indexOf('$friendsSince = $this->_friendsSinceMap($user, $friendIds, $activeStartMs);');
    const syncIdx = body.indexOf('$this->_syncFightSessionLocked($link, $uid, $diffIdx, $bossId, $activeStartMs, $friendsSince);');
    assert(mapIdx !== -1, '_friendsSinceMap() вызывается');
    assert(syncIdx !== -1, '_syncFightSessionLocked() получает $friendsSince (карту), а не $friendIds');
    assert(mapIdx !== -1 && syncIdx !== -1 && mapIdx < syncIdx, 'карта строится ДО вызова _syncFightSessionLocked(), а не после');
}

console.log('\nTest 2: attack() строит $friendsSince через _friendsSinceMap() перед _syncFightSessionLocked()');
{
    // 04.10.2026: attack() переведён на _syncFightSessionLocked() — см. комментарий у Test 1.
    const body = bodyOf('function attack(){', 'function claimKill()');
    const mapIdx = body.indexOf('$friendsSince = $this->_friendsSinceMap($user, $friendIds, $bossStartMs);');
    const syncIdx = body.indexOf('$this->_syncFightSessionLocked($link, $uid, $diffIdx, $bossId, $bossStartMs, $friendsSince);');
    assert(mapIdx !== -1, '_friendsSinceMap() вызывается');
    assert(syncIdx !== -1, '_syncFightSessionLocked() получает $friendsSince (карту), а не $friendIds');
    assert(mapIdx !== -1 && syncIdx !== -1 && mapIdx < syncIdx, 'карта строится ДО вызова _syncFightSessionLocked(), а не после');
}

console.log('\nTest 3: claimKill() строит $hpFriendsSince через _friendsSinceMap() перед _syncFightSession()');
{
    const body = bodyOf('function claimKill(){', null);
    const mapIdx = body.indexOf('$hpFriendsSince = $this->_friendsSinceMap($user, $hpFriendIds, $fightStart);');
    const syncIdx = body.indexOf('$this->_syncFightSession($hpLink, $uid, $this->_loadFightSession($user), $diffIdx, $bossId, $fightStart, $hpFriendsSince);');
    assert(mapIdx !== -1, '_friendsSinceMap() вызывается');
    assert(syncIdx !== -1, '_syncFightSession() получает $hpFriendsSince (карту), а не $hpFriendIds');
    assert(mapIdx !== -1 && syncIdx !== -1 && mapIdx < syncIdx, 'карта строится ДО вызова _syncFightSession(), а не после');
}

console.log('\nTest 4: friendsDamage() (уже было корректно) не регрессировало обратно на плоский список');
{
    const body = bodyOf('function friendsDamage(){', 'function rating(){');
    assert(/\$friendsSince = \$this->_friendsSinceMap\(\$user, \$friendIds, \$bossStartMs\);/.test(body),
        'friendsDamage() по-прежнему строит карту');
    assert(!/_syncFightSession\([^)]*\$friendIds\)/.test(body),
        'регресс-гвард: friendsDamage() не передаёт сырой $friendIds напрямую в _syncFightSession()');
}

console.log('\nTest 4b: useSedoy() (пятое, изначально пропущенное место) строит $friendsSince перед _syncFightSessionLocked()');
{
    // 04.10.2026: useSedoy() переведён на _syncFightSessionLocked() — см. комментарий у Test 1.
    const body = bodyOf('function useSedoy(){', "'patch' => \$patch,");
    const mapIdx = body.indexOf('$friendsSince = $this->_friendsSinceMap($user, $friendIds, $bossStartMs);');
    const syncIdx = body.indexOf('$this->_syncFightSessionLocked($link, $uid, $diffIdx, $bossId, $bossStartMs, $friendsSince);');
    assert(mapIdx !== -1, '_friendsSinceMap() вызывается внутри useSedoy()');
    assert(syncIdx !== -1, '_syncFightSessionLocked() получает $friendsSince (карту), а не $friendIds');
    assert(mapIdx !== -1 && syncIdx !== -1 && mapIdx < syncIdx, 'карта строится ДО вызова _syncFightSessionLocked(), а не после');
}

console.log('\nTest 5: регресс-гвард — ни в одном из ВСЕХ вызовов _syncFightSession()/_syncFightSessionLocked() в файле последним аргументом не остался сырой список ($friendIds/$hpFriendIds)');
{
    // Ищем ВСЕ вызовы обоих вариантов во всём файле, не полагаясь на заранее известное число
    // мест — именно так нашлось пятое (useSedoy()), пропущенное при первом проходе фикса.
    // 04.10.2026: после блокировки строки (tests/boss-fight-session-row-lock-race.test.js) 4 из
    // 5 "логических" вызывающих мест (attack/startFight/friendsDamage/useSedoy) зовут
    // _syncFightSessionLocked() вместо голого _syncFightSession() — последний остаётся только у
    // claimKill() (read-only гейт, см. комментарий в коде) И внутри самой _syncFightSessionLocked()
    // (её собственная реализация). Поэтому считаем раздельно и складываем.
    const rawCalls    = bossesPhp.match(/\$this->_syncFightSession\([^;]*\);/g) || [];
    const lockedCalls = bossesPhp.match(/\$this->_syncFightSessionLocked\([^;]*\);/g) || [];
    assert(rawCalls.length === 2, `найдено ровно 2 "сырых" вызова _syncFightSession() (claimKill() + реализация внутри _syncFightSessionLocked()) — найдено ${rawCalls.length}`);
    assert(lockedCalls.length === 4, `найдено ровно 4 вызова _syncFightSessionLocked() (attack/startFight/friendsDamage/useSedoy) — найдено ${lockedCalls.length}. Если число изменилось — проверь новое место на карту $friendsSince, не полагайся на память об этом списке`);
    const allCalls = [...rawCalls, ...lockedCalls];
    const badCalls = allCalls.filter(c => /\$(friendIds|hpFriendIds)\)/.test(c));
    assert(badCalls.length === 0,
        `ни один вызов не передаёт сырой список последним аргументом — найдено нарушений: ${badCalls.length}${badCalls.length ? ' (' + badCalls.join(' | ') + ')' : ''}`);
}

console.log('\nTest 6: мини-модель — демонстрирует, ПОЧЕМУ передача плоского списка вместо карты ломает SQL-условие');
{
    // Копия _friendsSinceConds() логики: foreach($friendsSince as $uid => $since).
    function buildConds(friendsSinceLike) {
        const conds = [];
        for (const uid in friendsSinceLike) conds.push(`(uid=${uid} AND time>=${friendsSinceLike[uid]})`);
        return conds.join(' OR ');
    }

    const brokenFlatList = [123456789, 987654321]; // то, что раньше передавалось (баг)
    const correctMap = { 123456789: 1700000000000, 987654321: 1700000005000 }; // то, что передаётся теперь

    const brokenCond = buildConds(brokenFlatList);
    const correctCond = buildConds(correctMap);

    assert(brokenCond === '(uid=0 AND time>=123456789) OR (uid=1 AND time>=987654321)',
        'баг: на плоском списке uid превращается в индекс массива (0,1) — условие ищет несуществующих игроков uid=0/uid=1');
    assert(correctCond === '(uid=123456789 AND time>=1700000000000) OR (uid=987654321 AND time>=1700000005000)',
        'фикс: на карте uid — реальный id друга, time — реальная граница дружбы/старта боя');
}

console.log('\nTest 7 (04.10.2026): регресс ТОГО ЖЕ класса бага в ПАРАЛЛЕЛЬНОМ пути — _ratingTop()');
{
    // 30.09.2026 фикс выше закрыл только _syncFightSession() (HP-путь). _ratingTop() —
    // отдельная функция ("участники боя"/попап победы), с собственными тремя вызывающими
    // местами (rating(), endFightSession(), claimKill()), которые 30.09.2026 не трогали —
    // баг пережил тот фикс, обнаружен заново по репорту "урон друзьям приходит в HP, но их
    // нет в рейтинге/попапе победы" — ровно то расхождение, которое и предсказывает разница
    // между двумя путями.
    const ratingBody = bodyOf('function rating(){', 'function killers(){');
    assert(/\$friendsSince = \(!empty\(\$friendIds\) && \$myFightStartForLog > 0\) \? \$this->_friendsSinceMap\(\$me, \$friendIds, \$myFightStartForLog\) : \[\];/.test(ratingBody),
        'rating(): строит $friendsSince через _friendsSinceMap() ДО вызова _ratingTop()');
    assert(/\$top = \$this->_ratingTop\(\$link, \$uid, strval\(\$me\['nick'\] \?\? ''\), \$bossId, \$diffIdx, \$myData, \$friendsSince\);/.test(ratingBody),
        'rating(): _ratingTop() получает $friendsSince (карту), а не сырой $friendIds');

    const endBody = bodyOf('function endFightSession(){', 'function attack(){');
    assert(/\$friendsSince = \(!empty\(\$friendIds\) && \$endFightStartMs > 0\) \? \$this->_friendsSinceMap\(\$user, \$friendIds, \$endFightStartMs\) : \[\];/.test(endBody),
        'endFightSession(): строит $friendsSince через _friendsSinceMap() ДО вызова _ratingTop()');
    assert(/\$top = \$this->_ratingTop\(\$link, abs\(intval\(\$this->registry\['uid'\]\)\), strval\(\$user\['nick'\] \?\? ''\), \$bossId, \$diffIdx, \$data, \$friendsSince\);/.test(endBody),
        'endFightSession(): _ratingTop() получает $friendsSince (карту), а не сырой $friendIds');

    const claimBody = bodyOf('function claimKill(){', null);
    assert(/\$topEntries = \$this->_ratingTop\(\$hpLink, \$uid, strval\(\$user\['nick'\] \?\? ''\), \$bossId, \$diffIdx, \$data, \$hpFriendsSince\);/.test(claimBody),
        'claimKill(): _ratingTop() переиспользует уже готовый $hpFriendsSince (карту), а не заново собранный сырой $friendIds');
    assert(!/\$friendIds = \(\$diffIdx !== 3 && !empty\(\$user\['friends'\]\)\) \? \$this->_friendIds\(\$user\) : \[\];\s*\n\s*\$hpLink = \$this->_rawLink\(\);\s*\n\s*if\(!\$hpLink\) return \$this->ops->fail\(99\);\s*\n\s*\$topEntries = \$this->_ratingTop/.test(claimBody),
        'claimKill(): регресс-гвард — старая избыточная сборка сырого $friendIds прямо перед _ratingTop() убрана целиком');
}

console.log('\nTest 8: регресс-гвард — ни в одном из ВСЕХ вызовов _ratingTop() в файле последним аргументом не остался сырой список ($friendIds/$hpFriendIds)');
{
    const calls = bossesPhp.match(/\$this->_ratingTop\([^;]*\);/g) || [];
    assert(calls.length === 3, `найдено ровно 3 вызова _ratingTop() (rating/endFightSession/claimKill) — найдено ${calls.length}. Если это число изменилось — проверь КАЖДОЕ новое место на карту $friendsSince, не полагайся на память об этом списке`);
    const badCalls = calls.filter(c => /\$(friendIds|hpFriendIds)\)/.test(c));
    assert(badCalls.length === 0,
        `ни один вызов не передаёт сырой список последним аргументом — найдено нарушений: ${badCalls.length}${badCalls.length ? ' (' + badCalls.join(' | ') + ')' : ''}`);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
