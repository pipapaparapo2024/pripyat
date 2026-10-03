/**
 * Test: 27.09.2026 (по прямому указанию, репорт игроков — "урон от друзей и рейтинг урона не
 * обновляется при нанесении урона, если игрок нанес урон каким либо способом... такой же
 * функционал как и у кнопки ПЕРЕЗАГРУЗИТЬ").
 *
 * Расследование: на экране боя есть РОВНО два способа самому нанести урон — обычная атака
 * (bosses-combat.js._attack()) и удар «Седого» (bosses_fight.js._useSedoyDamage(), см.
 * boss-sedoy-damage-server-authoritative.test.js). Оба пишут в один и тот же boss_damage_log
 * на сервере (см. bosses.php.attack()/useSedoy()) — оба одинаково "любой способ нанести урон".
 *
 * _attack() уже с 22.09.2026 (см. коммент там же) после ответа сервера зовёт ТРИ функции:
 * _updateBossFightHpDisplay() / _updateBossFightStats() / _loadBossFightRating() — тот же набор,
 * что кнопка ПЕРЕЗАГРУЗИТЬ (reloadFightBtn) вызывает после bosses._syncFriendsDamage().
 *
 * _useSedoyDamage() этот набор вызывал НЕ ПОЛНОСТЬЮ — только _updateBossFightHpDisplay(), без
 * _updateBossFightStats() и, что особенно заметно игроку, БЕЗ _loadBossFightRating() — панель
 * «РЕЙТИНГ УРОНА» (в т.ч. вклад друзей) физически не запрашивалась заново после удара седого,
 * оставалась на экране в том виде, в каком была до удара, пока игрок не откроет бой заново или
 * не подождёт периодический автоопрос (_tickBossFightTimer). Ровно это читалось как "урон от
 * друзей и рейтинг не обновляется".
 *
 * Фикс: _useSedoyDamage() зовёт тот же набор из трёх функций, что _attack() и reloadFightBtn —
 * ROI/HP уже свежий из res.hp (сервер сам синхронизирует urон друга через _syncFightSession()
 * ДО применения удара седого, см. bosses.php.useSedoy()), поэтому отдельный
 * bosses._syncFriendsDamage() здесь не требуется — как и в _attack().
 *
 * Run: node tests/boss-sedoy-damage-refreshes-rating-and-friends.test.js
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

const fightJs = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const combatJs = readSrc('_client/src/game/bosses/bosses-combat.js');

function extractFn(src, marker){
    const start = src.indexOf(marker);
    if(start === -1) return null;
    const end = src.indexOf('\n    };', start);
    return src.slice(start, end);
}

console.log('\nsanity: _attack() (эталон) — уже вызывает все три функции после КАЖДОГО удара, включая _loadBossFightRating()');
{
    const idx = combatJs.indexOf('proto._attack = function(){');
    const end = combatJs.indexOf('\n    };', idx);
    const body = combatJs.slice(idx, end);
    assert(/iface\._updateBossFightHpDisplay\(\)/.test(body), '_attack() обновляет HP-дисплей');
    assert(/iface\._updateBossFightStats\(\)/.test(body), '_attack() обновляет панель очков скиллов');
    assert(/iface\._loadBossFightRating\(idx\)/.test(body), '_attack() перезапрашивает рейтинг урона (эталонное поведение, с которым сверяем седого)');
}

console.log('\nsanity: кнопка ПЕРЕЗАГРУЗИТЬ — тот же набор вызовов (обновление HP/статов/рейтинга) после bosses._syncFriendsDamage()');
{
    const idx = fightJs.indexOf("reloadFightBtn.on('pointerdown'");
    const end = fightJs.indexOf('win.addChild(reloadFightBtn);', idx);
    const body = fightJs.slice(idx, end);
    assert(/this\._updateBossFightHpDisplay\(\);/.test(body), 'reload обновляет HP-дисплей');
    assert(/this\._updateBossFightStats\(\);/.test(body), 'reload обновляет панель очков скиллов');
    assert(/this\._loadBossFightRating\(bossIdx\);/.test(body), 'reload перезапрашивает рейтинг урона');
}

console.log('\nTest 1: _useSedoyDamage() теперь тоже перезапрашивает рейтинг урона после успешного удара');
{
    const body = extractFn(fightJs, 'proto._useSedoyDamage = function(){');
    assert(!!body, '_useSedoyDamage найден');
    const successStart = body.indexOf("TS.php('bosses.useSedoy'");
    const successEnd = body.indexOf('}, (err) => {', successStart);
    const successBody = body.slice(successStart, successEnd);
    assert(/this\._loadBossFightRating\(idx\);/.test(successBody),
        'КРИТИЧНО: после удара седого рейтинг урона (вклад друзей в т.ч.) перезапрашивается — раньше эта строка отсутствовала');
}

console.log('\nTest 2: _useSedoyDamage() теперь тоже обновляет панель очков скиллов (та же тройка, что у обычной атаки/reload)');
{
    const body = extractFn(fightJs, 'proto._useSedoyDamage = function(){');
    const successStart = body.indexOf("TS.php('bosses.useSedoy'");
    const successEnd = body.indexOf('}, (err) => {', successStart);
    const successBody = body.slice(successStart, successEnd);
    assert(/this\._updateBossFightStats\(\);/.test(successBody),
        'панель ОЧКИ/НОВЫЕ обновляется и после седого, не только после обычной атаки/reload');
}

console.log('\nTest 3: регресс-гвард — HP-дисплей по-прежнему обновляется, порядок вызовов ДО проверки _onDefeat (как у reload/_attack)');
{
    const body = extractFn(fightJs, 'proto._useSedoyDamage = function(){');
    const successStart = body.indexOf("TS.php('bosses.useSedoy'");
    const successEnd = body.indexOf('}, (err) => {', successStart);
    const successBody = body.slice(successStart, successEnd);
    const hpPos = successBody.indexOf('this._updateBossFightHpDisplay();');
    const statsPos = successBody.indexOf('this._updateBossFightStats();');
    const ratingPos = successBody.indexOf('this._loadBossFightRating(idx);');
    const defeatPos = successBody.indexOf('if(res.hp <= 0) bosses._onDefeat(idx);');
    assert(hpPos !== -1 && statsPos !== -1 && ratingPos !== -1 && defeatPos !== -1, 'все четыре фрагмента найдены');
    assert(hpPos < defeatPos && statsPos < defeatPos && ratingPos < defeatPos,
        'обновление дисплея/статов/рейтинга происходит ДО проверки победы — экран отражает актуальные данные независимо от исхода удара');
}

console.log('\nTest 4: регресс-гвард — обработка ошибок седого (65/66/68) не тронута этим фиксом');
{
    const body = extractFn(fightJs, 'proto._useSedoyDamage = function(){');
    assert(/65:\s*'Бой не начат/.test(body) && /66:\s*'Бой уже протух/.test(body) && /68:\s*'Седой достаточно помог/.test(body),
        'коды ошибок сервера по-прежнему обрабатываются как раньше');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
