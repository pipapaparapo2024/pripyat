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

console.log('\nTest 1: startFight() строит $friendsSince через _friendsSinceMap() перед _syncFightSession()');
{
    const body = bodyOf('function startFight(){', 'function _loadWeaponsLocal(');
    const mapIdx = body.indexOf('$friendsSince = $this->_friendsSinceMap($user, $friendIds, $activeStartMs);');
    const syncIdx = body.indexOf('$this->_syncFightSession($link, $uid, $this->_loadFightSession($user), $diffIdx, $bossId, $activeStartMs, $friendsSince);');
    assert(mapIdx !== -1, '_friendsSinceMap() вызывается');
    assert(syncIdx !== -1, '_syncFightSession() получает $friendsSince (карту), а не $friendIds');
    assert(mapIdx !== -1 && syncIdx !== -1 && mapIdx < syncIdx, 'карта строится ДО вызова _syncFightSession(), а не после');
}

console.log('\nTest 2: attack() строит $friendsSince через _friendsSinceMap() перед _syncFightSession()');
{
    const body = bodyOf('function attack(){', 'function claimKill()');
    const mapIdx = body.indexOf('$friendsSince = $this->_friendsSinceMap($user, $friendIds, $bossStartMs);');
    const syncIdx = body.indexOf('$this->_syncFightSession($link, $uid, $this->_loadFightSession($user), $diffIdx, $bossId, $bossStartMs, $friendsSince);');
    assert(mapIdx !== -1, '_friendsSinceMap() вызывается');
    assert(syncIdx !== -1, '_syncFightSession() получает $friendsSince (карту), а не $friendIds');
    assert(mapIdx !== -1 && syncIdx !== -1 && mapIdx < syncIdx, 'карта строится ДО вызова _syncFightSession(), а не после');
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

console.log('\nTest 4b: useSedoy() (пятое, изначально пропущенное место) строит $friendsSince перед _syncFightSession()');
{
    const body = bodyOf('function useSedoy(){', "'patch' => \$patch,");
    const mapIdx = body.indexOf('$friendsSince = $this->_friendsSinceMap($user, $friendIds, $bossStartMs);');
    const syncIdx = body.indexOf('$this->_syncFightSession($link, $uid, $this->_loadFightSession($user), $diffIdx, $bossId, $bossStartMs, $friendsSince);');
    assert(mapIdx !== -1, '_friendsSinceMap() вызывается внутри useSedoy()');
    assert(syncIdx !== -1, '_syncFightSession() получает $friendsSince (карту), а не $friendIds');
    assert(mapIdx !== -1 && syncIdx !== -1 && mapIdx < syncIdx, 'карта строится ДО вызова _syncFightSession(), а не после');
}

console.log('\nTest 5: регресс-гвард — ни в одном из ВСЕХ вызовов _syncFightSession() в файле последним аргументом не остался сырой список ($friendIds/$hpFriendIds)');
{
    // Ищем ВСЕ вызовы _syncFightSession( ... ) во всём файле, не полагаясь на заранее известное
    // число мест — именно так нашлось пятое (useSedoy()), пропущенное при первом проходе фикса.
    const calls = bossesPhp.match(/\$this->_syncFightSession\([^;]*\);/g) || [];
    assert(calls.length === 5, `найдено ровно 5 вызовов _syncFightSession() (attack/startFight/claimKill/friendsDamage/useSedoy) — найдено ${calls.length}. Если это число изменилось — проверь КАЖДОЕ новое место на карту $friendsSince, не полагайся на память об этом списке`);
    const badCalls = calls.filter(c => /\$(friendIds|hpFriendIds)\)/.test(c));
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

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
