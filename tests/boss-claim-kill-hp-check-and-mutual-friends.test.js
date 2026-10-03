/**
 * Test: два фикса боевой системы боссов (23.09.2026, по прямому указанию, разбор боевой
 * системы + рейтинга урона).
 *
 * 1) bosses.php.claimKill() раньше НЕ проверял, что производный HP реально дошло до 0 —
 *    проверялись только "бой начат через startFight()" и "бой не протух". attack() уже
 *    полностью server-authoritative (пишет каждый удар в boss_damage_log), поэтому claimKill()
 *    теперь тоже честно пересчитывает _derivedHp() и отклоняет клейм (fail(67)), если HP > 0 —
 *    до фикса игрок мог вызвать claimKill сразу после startFight, не нанеся урона, и получить
 *    полную награду. Клиент (bosses-combat.js._onDefeat) отдельно обрабатывает код 67 —
 *    не путает его с "дневной лимит" в сообщении/логе.
 *
 * 2) bosses.php._friendIds() раньше читал ТОЛЬКО мой собственный список friends (client-
 *    reported, см. users.php — сервер хранит ровно то, что прислал клиент, отфильтрованное
 *    лишь по "это существующий игрок") — игрок мог добавить в друзья кого угодно без встречного
 *    добавления и получать урон от него как "помощь". Теперь кандидат остаётся другом только
 *    если МОЙ id тоже есть в ЕГО собственном списке friends (проверяется отдельным запросом).
 *
 * Run: node tests/boss-claim-kill-hp-check-and-mutual-friends.test.js
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

const bossesPhp = readSrc('server/core/controllers/bosses.php');
const combatJs  = readSrc('_client/src/game/bosses/bosses-combat.js');

console.log('\nTest 1: claimKill() проверяет производный HP≤0 ДО начисления награды');
{
    const start = bossesPhp.indexOf('function claimKill(){');
    const body  = bossesPhp.slice(start); // claimKill() — последняя функция класса

    // 23.09.2026: инструментация обернула проверку в блок с error_log перед return — сама
    // проверка/код ошибки не изменились, ищем по уникальному "return ...fail(67);".
    const hpCheckIdx  = body.indexOf('return $this->ops->fail(67);');
    const rewardIdx   = body.indexOf('$this->ops->add($user, \'cigarettes\', $earnedCig);');
    // 24.09.2026: HP теперь читается из личного кэша через _syncFightSession() (курсорный
    // подхват свежего урона друга) вместо честного пересчёта _derivedHp() на каждый вызов —
    // см. boss-fight-session-cache-and-friend-cursor.test.js.
    // 30.09.2026 (прогон перед деплоем — тест обновлён под актуальную сигнатуру): claimKill()
    // теперь считает $hpFriendsSince (карту) из $hpFriendIds ПЕРЕД вызовом _syncFightSession —
    // тот же фикс retroactive-урона друга, что и в attack()/friendsDamage()/startFight().
    assert(/\$hpSession = \$this->_syncFightSession\(\$hpLink, \$uid, \$this->_loadFightSession\(\$user\), \$diffIdx, \$bossId, \$fightStart, \$hpFriendsSince\);/.test(body),
        'claimKill() синхронизирует кэш HP тем же методом, что attack()/friendsDamage()/startFight()');
    assert(/\$curHp = intval\(\$hpSession\['hp'\]\);/.test(body), 'curHp читается из свежего session[\'hp\']');
    assert(hpCheckIdx !== -1, 'claimKill() отклоняет клейм с кодом 67, если HP ещё > 0');
    assert(rewardIdx !== -1, 'sanity: начисление награды всё ещё присутствует в claimKill()');
    assert(hpCheckIdx !== -1 && rewardIdx !== -1 && hpCheckIdx < rewardIdx,
        'проверка HP стоит ДО начисления награды — нельзя получить награду без реального HP≤0');
    // Тот же фильтр друзей (не соло), что и у остальных вызовов _derivedHp() в файле.
    assert(/\$hpFriendIds = \(\$diffIdx !== 3 && !empty\(\$user\['friends'\]\)\) \? \$this->_friendIds\(\$user\) : \[\];/.test(body),
        'friendIds для проверки HP считаются тем же способом, что и везде (соло исключено)');
}

console.log('\nTest 2: код 54 (не начатый бой) и 66 (протухший бой) проверяются РАНЬШЕ новой HP-проверки — порядок не сломан');
{
    const start = bossesPhp.indexOf('function claimKill(){');
    const fightStartIdx = bossesPhp.indexOf("if(\$fightStart <= 0) return \$this->ops->fail(65);", start);
    const elapsedIdx    = bossesPhp.indexOf('return $this->ops->fail(66);', start);
    const hpCheckIdx    = bossesPhp.indexOf('return $this->ops->fail(67);', start);
    assert(fightStartIdx !== -1 && elapsedIdx !== -1 && hpCheckIdx !== -1, 'все три проверки найдены');
    assert(fightStartIdx < elapsedIdx && elapsedIdx < hpCheckIdx,
        'порядок проверок: бой начат (65) → не протух (66) → HP≤0 (67) — та же последовательность, что у остальных guard-ов проекта');
}

console.log('\nTest 3: bosses-combat.js._onDefeat() отдельно обрабатывает код 67 (не путает с дневным лимитом)');
{
    const start = combatJs.indexOf('proto._onDefeat = function(idx){');
    const end   = combatJs.indexOf('\n    };', start);
    const body  = combatJs.slice(start, end);
    assert(/const isHpNotZero = err && err\.code === 67;/.test(body), 'колбэк ошибки claimKill различает код 67');
    assert(/Бой ещё не завершён — попробуйте снова/.test(body), 'для кода 67 отдельное, не вводящее в заблуждение сообщение');
    assert(/исчерпан дневной лимит убийств этого босса/.test(body), 'сообщение про дневной лимит осталось для остальных кодов ошибок');
}

console.log('\nTest 4: bosses.php._friendIds() требует подтверждения дружбы с ОБЕИХ сторон');
{
    const start = bossesPhp.indexOf('private function _friendIds($user){');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/\$rows = \$this->registry\['udb'\]->getData\(\$this->registry\['utb'\], array\('id', 'friends'\), 'id IN\(' *\.implode\(',', \$ids\)\. *'\)', true\);/.test(body),
        'запрашивает собственный список friends каждого кандидата отдельным запросом');
    assert(/if\(abs\(intval\(\$tfid\)\) === \$myUid\)\{ \$mutual\[\] = intval\(\$row\['id'\]\); break; \}/.test(body),
        'кандидат остаётся в списке, только если МОЙ id найден в ЕГО собственном friends');
    assert(!/return \$ids;\s*\}\s*$/.test(body.trim()) || /\$mutual/.test(body),
        'функция возвращает отфильтрованный $mutual, а не сырой односторонний $ids');
}

console.log('\nTest 5: sanity — все вызывающие места по-прежнему исключают соло (diffIdx===3) из подмешивания друзей');
{
    const n = (bossesPhp.match(/\$diffIdx !== 3 && !empty\(\$user\['friends'\]\)\) \? \$this->_friendIds\(\$user\)/g) || []).length;
    assert(n >= 5, 'минимум 5 мест (friendsDamage/startFight/attack/claimKill×2) сохранили условие "не соло" при вызове _friendIds (нашли ' + n + ')');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
