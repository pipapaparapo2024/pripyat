/**
 * Test: батч 21.09.2026 (по прямому указанию, репорт двух тестеров вживую) —
 *
 *  1) Друг, нанёсший урон боссу задолго ДО начала моего боя (его собственная попытка старая,
 *     но формально ещё не завершена — бой живёт до 9ч), показывался в рейтинге текущего боя,
 *     хотя его урон закономерно НЕ засчитывался в HP (_seedFriendDmgBaseline это уже правильно
 *     гасил). Несогласованность: bosses.php.friendsDamage()/rating() проверяли только
 *     "curCycleDmg[boss] > 0", а не "бой этого друга ещё пересекается по времени с моим".
 *     Фикс — новая _isFriendFightLive() (не старше MAX_FIGHT_WINDOW_MS от bossStartMs друга),
 *     применена в ОБОИХ местах.
 *
 *     22.09.2026 (второй заход, по прямому указанию — прислан референс с нормальной таблицей
 *     урона id/type/damage/time/critical/did): _isFriendFightLive() и её чтение
 *     $data['curCycleDmg'][$bossId] заменены на _friendBossState()/_bossFightStartMs()/
 *     _cycleDamageSum(), читающие новую таблицу boss_damage_log — curCycleDmg в bosses_data
 *     был client-writable через users.save (подделываемый) и не хранил время каждого удара,
 *     только текущую сумму.
 *
 *     22.09.2026 (третий заход, по прямому указанию — уточнение механики: "боссы не обязаны
 *     совпадать, важно только пересечение по времени активных боёв"): второй заход выше сам
 *     оказался неполным — граница "живости" была привязана к КОНКРЕТНОМУ boss_id, хотя урон
 *     друга должен учитываться НЕЗАВИСИМО от того, какого босса он бьёт. _friendBossState()/
 *     _bossFightStartMs()/_cycleDamageSum() заменены на _myFightStart()/_damageSumSince()/
 *     _friendsDamageSumSince() — см. полное покрытие новой механики в
 *     boss-attack-server-authoritative-and-timing-friend-rule.test.js.
 *
 *  2) Полная перезагрузка страницы (F5, не кнопка "Выйти из боя") роняла активный бой с боссом
 *     полностью — hpByDiff/bossStartMs/curCycleDmg и т.д. в памяти клиента откатывались к
 *     дефолтам конструктора Bosses, хотя сервер всё это время хранил актуальное состояние в
 *     udata['bosses_data']. Причина — _loadFromUdata() (bosses-combat.js) существовала, но её
 *     единственный вызов сидел в bosses.open() — мёртвом коде (нигде не вызывается, реальный
 *     UI идёт через bosses_select.js/bosses_fight.js напрямую по this._bossStartMs и т.п.).
 *     Фикс — вызов _loadFromUdata() перенесён в конец конструктора Bosses (тот же паттерн,
 *     что skills.js._loadLevelsFromUdata()) — window.bosses создаётся в module_control.js уже
 *     ПОСЛЕ готовности udata, восстановление гарантированно отработает при каждой загрузке.
 *     Это НЕ тронуто вторым заходом фикса из пункта 1 — curCycleDmg/hpByDiff всё ещё
 *     персистятся клиентом для СОБСТВЕННОГО reload-восстановления, просто больше не читаются
 *     сервером для рейтинга/помощи друзей.
 *
 * Run: node tests/boss-friend-rating-liveness-and-reload-persistence.test.js
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
const bossesJs  = readSrc('_client/src/game/bosses.js');

console.log('\nTest 1: bosses.php — _myFightStart()/_syncFightSession() заведены (заменили _bossFightStartMs()/_friendBossState() второго захода)');
{
    const start = bossesPhp.indexOf('private function _myFightStart($data, $diffIdx, $bossId){');
    assert(start !== -1, '_myFightStart() определена — прямое чтение bossStartMs[diffIdx][bossId] без сканирования по boss_id друга');
    const end  = bossesPhp.indexOf('\n        }', start);
    const body = bossesPhp.slice(start, end);
    assert(/empty\(\$data\['bossStartMs'\]\)/.test(body), 'без bossStartMs вообще — считает 0 (нет активного боя), не бросает ошибку');
    assert(/if\(!is_array\(\$slots\[0\] \?\? null\)\) \$slots = \[\$slots\];/.test(body),
        'поддерживает старый плоский формат bossStartMs (миграция) — тот же кейс, что клиентский _loadFromUdata()');

    // 24.09.2026: _derivedHp() (чистый пересчёт на каждый запрос) заменён на
    // _syncFightSession() (личный мутируемый кэш + курсор урона друга) — см.
    // boss-fight-session-cache-and-friend-cursor.test.js для полного покрытия.
    // 30.09.2026 (прогон перед деплоем): 7-й параметр — $friendsSince (карта), не $friendIds —
    // см. фикс retroactive-урона друга 29.09.2026.
    const syncStart = bossesPhp.indexOf('private function _syncFightSession($link, $uid, $session, $diffIdx, $bossId, $bossStartMs, $friendsSince){');
    assert(syncStart !== -1, '_syncFightSession() определена');
    const syncEnd  = bossesPhp.indexOf('\n        }', syncStart);
    const syncBody = bossesPhp.slice(syncStart, syncEnd);
    assert(/\$diffIdx !== 3 && !empty\(\$friendsSince\)/.test(syncBody), 'соло (diffIdx=3) исключает друзей из бэкфилла HP полностью');
}

console.log('\nTest 2: friendsDamage() — считает урон друзей по ЛЮБОМУ их боссу с момента МОЕГО bossStartMs, не привязан к конкретному boss_id друга');
{
    const start = bossesPhp.indexOf('function friendsDamage(){');
    const end   = bossesPhp.indexOf('function rating(){');
    const body  = bossesPhp.slice(start, end);
    assert(/\$session = \$this->_syncFightSession\(\$link, \$uid, \$this->_loadFightSession\(\$user\), \$diffIdx, \$bossId, \$bossStartMs, \$friendsSince\);/.test(body),
        'friendsDamage() синхронизирует и отдаёт готовый hp из кэша (не total_damage для ручного вычитания на клиенте)');
    assert(!/\$data\['curCycleDmg'\]/.test(body), 'friendsDamage() больше не читает client-writable curCycleDmg вообще — источник правды теперь boss_damage_log/boss_fight_session');
}

console.log('\nTest 3: rating() — своя строка и строки друзей считаются по одной и той же SUM-логике из лога, без привязки к boss_id друга');
{
    // 22.09.2026 (попап победы над боссом, отдельный батч): rating() разбит на общий
    // _ratingTop() (переиспользован claimKill()) — окно расширено на обе функции.
    const start = bossesPhp.indexOf('private function _ratingTop(');
    const end   = bossesPhp.indexOf('function killers(){');
    const body  = bossesPhp.slice(start, end);
    assert(/\$startMs = \$this->_myFightStart\(\$myData, \$diffIdx, \$bossId\);/.test(body), 'граница для ВСЕХ строк (своей и друзей) — bossStartMs МОЕЙ текущей попытки');
    // 23.09.2026 (баг "рейтинг 5К при maxHP 1К", по прямому указанию): раньше здесь НЕ было
    // фильтра по boss_id вовсе — урон по ЛЮБОМУ другому боссу той же сложности бился в рейтинг
    // текущего боя. Теперь обязателен boss_id — см. boss-rating-hp-scoped-by-boss-id.test.js.
    // 29.09.2026: вызов получил ещё excludeSedoy=true — см. tests/boss-sedoy-excluded-from-friend-rating.test.js.
    assert(/\$myDmg = \$this->_damageSumSince\(\$link, \$uid, \$bossId, \$startMs, true\);/.test(body),
        'для себя урон считается той же SUM-логикой из лога, СКОУПЛЕННОЙ на конкретный boss_id (не любой босс той же сложности)');
    assert(!/curCycleDmg/.test(body), 'rating() больше не читает client-writable curCycleDmg вообще');
}

console.log('\nTest 4: bosses.js — _loadFromUdata() по-прежнему вызывается из конструктора (не тронуто вторым заходом фикса из Test 1-3)');
{
    const ctorStart = bossesJs.indexOf('constructor(mc){');
    const ctorEnd   = bossesJs.indexOf('\n    }', ctorStart);
    const ctorBody  = bossesJs.slice(ctorStart, ctorEnd);
    assert(/this\._loadFromUdata\(\);/.test(ctorBody), 'конструктор Bosses вызывает this._loadFromUdata()');

    const idxDefaults = ctorBody.indexOf('this._fightTimeBonusMs');
    const idxLoad     = ctorBody.indexOf('this._loadFromUdata();');
    assert(idxDefaults !== -1 && idxLoad !== -1 && idxDefaults < idxLoad,
        '_loadFromUdata() вызывается ПОСЛЕ того, как все дефолтные массивы состояния уже объявлены');
}

console.log('\nTest 5: bosses-combat.js — _loadFromUdata() по-прежнему восстанавливает curCycleDmg для СОБСТВЕННОГО reload (клиентское поле не убирали)');
{
    const combatSrc = readSrc('_client/src/game/bosses/bosses-combat.js');
    const start = combatSrc.indexOf('proto._loadFromUdata = function(){');
    const end   = combatSrc.indexOf('\n    };', start);
    const body  = combatSrc.slice(start, end);
    assert(!/this\.win/.test(body), '_loadFromUdata() не обращается к this.win — можно звать до/после построения UI без разницы');
    assert(/if\(!udata \|\| !udata\['bosses_data'\]\) return;/.test(body), 'безопасно на первом заходе нового игрока (bosses_data ещё нет)');
    assert(/if\(s\.curCycleDmg && Array\.isArray\(s\.curCycleDmg\)\)/.test(body),
        'curCycleDmg по-прежнему восстанавливается из bosses_data — это СОБСТВЕННОЕ отображение игрока, не источник правды для друзей/рейтинга');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
