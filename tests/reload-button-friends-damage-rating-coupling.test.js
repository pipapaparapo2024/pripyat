/**
 * Test: кнопка «ПЕРЕЗАГРУЗИТЬ» в боёвке с боссом должна делать ДВЕ вещи ВМЕСТЕ, в таком
 * порядке (по прямому уточнению пользователя, 16.09.2026): (1) подтянуть суммарный урон
 * друзей ВК по этому боссу и применить его к HP (bosses._syncFriendsDamage), и ТОЛЬКО
 * ПОСЛЕ этого (2) обновить "РЕЙТИНГ УРОНА" — иначе рейтинг мог бы показать ещё не
 * применённые изменения или устаревшие данные.
 *
 * Run: node tests/reload-button-friends-damage-rating-coupling.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const fightSrc  = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');
const combatSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');

console.log('\nTest 1: reloadFightBtn вызывает _syncFriendsDamage, а колбэк refresh() обновляет и HP, и рейтинг');
{
    const idx = fightSrc.indexOf("reloadFightBtn.on('pointerdown', ()=>{");
    assert(idx !== -1, 'обработчик клика на reloadFightBtn найден');
    const body = fightSrc.slice(idx, idx + 700);

    assert(/const refresh = \(\) => \{/.test(body), 'колбэк refresh определён');
    assert(/this\._updateBossFightHpDisplay\(\);/.test(body), 'refresh обновляет отображение HP');
    assert(/this\._loadBossFightRating\(bossIdx\);/.test(body), 'refresh обновляет РЕЙТИНГ УРОНА');
    assert(/bosses\._syncFriendsDamage\(bossIdx, refresh\);/.test(body),
        '_syncFriendsDamage вызывается С refresh КАК КОЛБЭКОМ — рейтинг обновляется ПОСЛЕ применения урона друзей, не параллельно');

    // Порядок в исходнике: определение refresh должно идти РАНЬШЕ вызова _syncFriendsDamage
    const refreshDefIdx = body.indexOf('const refresh = () => {');
    const syncCallIdx   = body.indexOf('bosses._syncFriendsDamage(bossIdx, refresh);');
    assert(refreshDefIdx !== -1 && syncCallIdx !== -1 && refreshDefIdx < syncCallIdx,
        'refresh объявлен до вызова _syncFriendsDamage (передаётся как готовый колбэк)');
}

console.log('\nTest 2: _syncFriendsDamage реально выставляет производный HP с сервера (22.09.2026 — без ratchet friendDmgApplied)');
{
    // Механизм сменился: раньше друзья ВК подтягивали TOTAL и клиент сам вычитал ДЕЛЬТУ
    // (total - уже применённое). Теперь bosses.friendsDamage() отдаёт готовый производный
    // hp (maxHp - мой урон - урон друзей, см. bosses.php._derivedHp) — клиент просто
    // выставляет его, без собственной арифметики и без ratchet-состояния.
    const idx = combatSrc.indexOf('proto._syncFriendsDamage = function(bossIdx, callback){');
    assert(idx !== -1, '_syncFriendsDamage найден');
    const end = combatSrc.indexOf('\n    };', idx);
    const body = combatSrc.slice(idx, end);
    assert(/TS\.php\('bosses\.friendsDamage', \{ boss_id: bossIdx, diff_idx: diffIdx \}/.test(body),
        'запрашивает актуальный статус боя по ИМЕННО этому боссу с сервера');
    assert(/const hp = Math\.max\(0, parseInt\(e && e\.hp\) \|\| 0\);/.test(body), 'читает готовый производный hp из ответа');
    assert(/this\._setHp\(bossIdx, hp\);/.test(body), 'применяет новое HP напрямую');
    assert(/if\(callback\) callback\(\);/.test(body), 'вызывает callback (refresh) после применения — в т.ч. если HP не изменился');
}

console.log('\nTest 3: _loadBossFightRating запрашивает рейтинг сразу — предварительный флаш users.save убран (22.09.2026)');
{
    // bosses.rating() теперь читает boss_damage_log напрямую (пишет его сам сервер синхронно
    // внутри bosses.attack()) — данные уже гарантированно свежие, предварительный флаш
    // users.save стал не нужен (раньше был нужен, т.к. rating() читал client-writable
    // bossDamage/curCycleDmg из bosses_data).
    const idx = fightSrc.indexOf('proto._loadBossFightRating = function(bossIdx){');
    assert(idx !== -1, '_loadBossFightRating найден');
    const end = fightSrc.indexOf('\n    };', idx);
    const body = fightSrc.slice(idx, end);
    assert(!/TS\.php\('users\.save'/.test(body), 'предварительный флаш users.save убран');
    assert(/this\._fetchBossFightRating\(bossIdx\);/.test(body), 'сразу запрашивает bosses.rating');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
