/**
 * Test: 24.09.2026, по прямому указанию — пользователь показал боевой код референсной игры
 * на том же движке (Tolmasoft) и попросил перенять оттуда две вещи для боевки боссов:
 *
 * 1) HP хранится мутируемым кэшем (boss_fight_session), а не пересчитывается SUM()-ом по
 *    boss_damage_log с нуля на КАЖДЫЙ запрос (как было в убранной _derivedHp()).
 * 2) Урон друга подтягивается КУРСОРОМ (cursorId — id последней уже учтённой строки лога,
 *    аналог last_did у референсной игры) — новый урон друга просто ВЫЧИТАЕТСЯ из кэша, не
 *    пересуммируется вся история заново.
 *
 * Критично (сам придумал этот момент по ходу реализации, не прямое указание): bosses_data
 * УЖЕ в client-writable whitelist users.php — класть мутируемый HP туда же было бы прямой
 * дырой (читер выставил бы curHp:0 одним users.save и "убивал" любого босса без единого
 * реального удара). Поэтому кэш живёт в НОВОМ server-only поле boss_fight_session
 * (migrate30.php), недоступном для users.save — тот же класс поля, что skills_levels/
 * dice_session/... (см. CLAUDE.md).
 *
 * ⚠️ 30.09.2026 (найдено по прямому указанию, при разборе жалобы "урон седого отправляется
 * друзьям"): тесты 6/8/9/10/11 ниже матчили СТАРУЮ сигнатуру со времён ДО рефакторинга 29.09.2026
 * (плоский список `$friendIds`), хотя `_syncFightSession()`/`_applyFriendDamage()`/
 * `_friendsDamageSumSince()` уже давно принимают карту `$friendsSince = {uid: effectiveSinceMs}`
 * (см. `_friendsSinceMap()`). Хуже того — эта устарелость МАСКИРОВАЛА реальный баг: единственное
 * место, которое действительно строило карту через `_friendsSinceMap()`, было `friendsDamage()`
 * (тест 11) — а `startFight()`/`attack()`/`claimKill()` (тесты 8/9/10) передавали сырой список
 * напрямую. `_friendsSinceConds()` делает `foreach($friendsSince as $uid => $since)` — на плоском
 * списке это даёт `$uid`=0,1,2... (индексы массива), `$since`=реальные VK-id — в SQL улетало
 * условие вида "uid=0 AND time>=123456789", не совпадающее ни с одной строкой лога. Итог: урон
 * друга реально подхватывался ТОЛЬКО периодическим опросом `friendsDamage()`, а не сразу при
 * старте/атаке/клейме победы. Тесты 8/9/10 при этом ЛОЖНО ПРОХОДИЛИ (текстово матчили `$friendIds`,
 * которое буквально и было в багованном коде), а тест 11 наоборот падал бы (код уже был
 * правильным). Регексы ниже обновлены под факт, что фикс применён теперь во ВСЕХ четырёх местах —
 * см. также новый tests/boss-friendssince-map-all-call-sites.test.js.
 *
 * Run: node tests/boss-fight-session-cache-and-friend-cursor.test.js
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

const bossesPhp  = readSrc('server/core/controllers/bosses.php');
const usersPhp   = readSrc('server/core/controllers/users.php');
const migratePhp = readSrc('server/migrate30.php');
const claudeMd   = readSrc('AGENTS.md'); // 02.10.2026: проект перешёл CLAUDE.md → AGENTS.md (CLAUDE.md теперь однострочный редирект "@AGENTS.md")

console.log('\nTest 1: migrate30.php — добавляет boss_fight_session аддитивно (ADD COLUMN, не трогает существующие таблицы)');
{
    assert(/ALTER TABLE `users` ADD COLUMN `boss_fight_session` TEXT DEFAULT NULL/.test(migratePhp),
        'ALTER TABLE ADD COLUMN boss_fight_session TEXT — server-only поле, тот же тип, что skills_levels/dice_session');
    assert(/SHOW COLUMNS FROM `users` LIKE 'boss_fight_session'/.test(migratePhp),
        'идемпотентна — проверяет существование колонки перед ALTER (можно перезапустить без ошибки)');
    assert(!/DROP|TRUNCATE/i.test(migratePhp), 'миграция не удаляет и не очищает ничего существующего (Правило №3)');
}

console.log('\nTest 2: boss_fight_session НЕ в whitelist $allowed users.php — критично, bosses_data УЖЕ там, класть кэш HP туда же было бы дырой');
{
    const allowedStart = usersPhp.indexOf('$allowed = [');
    const allowedEnd   = usersPhp.indexOf('\n            ];', allowedStart);
    const allowedBody  = usersPhp.slice(allowedStart, allowedEnd);
    assert(!/boss_fight_session/.test(allowedBody), 'boss_fight_session отсутствует в $allowed — users.save() не может его подделать');
    assert(/'bosses_data'/.test(allowedBody), 'sanity: bosses_data по-прежнему в whitelist (это и есть причина, почему кэш HP не мог туда переехать)');
}

console.log('\nTest 3: сброс аккаунта (resetSession/_defaultResetUdata) обнуляет boss_fight_session — тот же класс server-only поля, что skills_levels/dice_session/...');
{
    const resetStart = usersPhp.indexOf('function resetSession(){');
    const resetBody  = usersPhp.slice(resetStart, usersPhp.indexOf("output(['ok' => 1]);", resetStart));
    assert(/'boss_fight_session'\s*=>\s*null,/.test(resetBody), 'resetSession() обнуляет boss_fight_session (одиночный сброс аккаунта)');

    const defaultStart = usersPhp.indexOf('private function _defaultResetUdata(){');
    const defaultEnd   = usersPhp.indexOf('\n        }', defaultStart);
    const defaultBody  = usersPhp.slice(defaultStart, defaultEnd);
    assert(/'boss_fight_session'=>null,/.test(defaultBody), '_defaultResetUdata() (полный сброс сервера, resetAllPlayers) тоже обнуляет boss_fight_session');
}

console.log('\nTest 4: AGENTS.md документирует boss_fight_session как server-only поле (обе точки списка)');
{
    assert(/`boss_fight_session`/.test(claudeMd), 'boss_fight_session упомянут в AGENTS.md');
    const occurrences = (claudeMd.match(/boss_fight_session/g) || []).length;
    assert(occurrences >= 2, 'упомянут минимум дважды (оба списка server-only полей) — найдено ' + occurrences);
}

console.log('\nTest 5: _derivedHp() полностью убрана (мёртвый код) — заменена на _syncFightSession()/_applyFriendDamage()');
{
    assert(!/private function _derivedHp\(/.test(bossesPhp), '_derivedHp() удалена — ни один вызывающий код на неё больше не ссылается');
    assert(/private function _loadFightSession\(\$user\)\{/.test(bossesPhp), '_loadFightSession() определена');
    assert(/private function _syncFightSession\(\$link, \$uid, \$session, \$diffIdx, \$bossId, \$bossStartMs, \$friendsSince\)\{/.test(bossesPhp),
        '_syncFightSession() определена с ожидаемой сигнатурой (30.09.2026: параметр $friendsSince — карта, не список)');
    assert(/private function _applyFriendDamage\(\$link, &\$session, \$diffIdx, \$friendsSince\)\{/.test(bossesPhp),
        '_applyFriendDamage() определена, session передаётся по ссылке (мутирует напрямую)');
}

console.log('\nTest 6: _syncFightSession() — бэкфилл ТОЛЬКО когда кэша нет или он от другой попытки (bossId/diffIdx не совпадают)');
{
    const start = bossesPhp.indexOf('private function _syncFightSession(');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/\$matches = isset\(\$session\['bossId'\], \$session\['diffIdx'\], \$session\['hp'\], \$session\['cursorId'\]\)\s*\n\s*&& intval\(\$session\['bossId'\]\) === \$bossId && intval\(\$session\['diffIdx'\]\) === \$diffIdx\s*&& intval\(\$session\['startMs'\] \?\? 0\) === \$bossStartMs;/.test(body),
        'матч проверяется по ВСЕМ 4 полям кэша + равенству bossId/diffIdx — защита от рассинхрона со старой/чужой попыткой');
    assert(/if\(!\$matches\)\{/.test(body), 'бэкфилл выполняется только в ветке несовпадения');
    assert(/\$mine = \$this->_damageSumSince\(\$link, \$uid, \$bossId, \$bossStartMs\);/.test(body),
        'бэкфилл считает свой урон тем же _damageSumSince(), что и раньше (скоуплен по boss_id)');
    assert(/\$friends = \(\$diffIdx !== 3 && !empty\(\$friendsSince\)\) \? \$this->_friendsDamageSumSince\(\$link, \$friendsSince\) : 0;/.test(body),
        'бэкфилл считает урон друзей тем же _friendsDamageSumSince() (соло исключено, карта $friendsSince вместо списка)');
    // 27.09.2026 (баг найден по прямому указанию, см. boss-fight-session-friend-cursor-time-
    // scoped.test.js для полного разбора): курсор больше НЕ заводится от текущего глобального
    // максимума в таблице — это ломало учёт урона друга, если $friendIds на момент ИМЕННО этого
    // бэкфилла был пуст (например, взаимные друзья ВК ещё не подтянулись). Теперь граница строго
    // по времени (последняя строка ДО $bossStartMs) — не зависит от того, кто уже успел ударить.
    assert(/SELECT MAX\(`id`\) AS maxId FROM `boss_damage_log` WHERE `time` < /.test(body),
        'курсор при бэкфилле заводится от границы ПО ВРЕМЕНИ ($bossStartMs), а не от текущего глобального максимума в таблице');
    assert(!/SELECT MAX\(`id`\) AS maxId FROM `boss_damage_log`;/.test(body) && !/SELECT MAX\(`id`\) AS maxId FROM `boss_damage_log`'\)/.test(body),
        'регресс-гвард: старый безусловный (без WHERE time) запрос не вернулся');
    assert(/\$this->_applyFriendDamage\(\$link, \$session, \$diffIdx, \$friendsSince\);\s*\n\s*return \$session;/.test(body),
        'после матча ИЛИ бэкфилла — всегда прогоняется курсорный подхват свежего урона друга перед возвратом');
}

console.log('\nTest 7: _applyFriendDamage() — курсорная дедупликация (id > cursorId), не пересуммирует историю, соло/без друзей — no-op');
{
    const start = bossesPhp.indexOf('private function _applyFriendDamage(');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/if\(\$diffIdx === 3 \|\| empty\(\$friendsSince\)\) return;/.test(body),
        'соло (diffIdx===3) или пустая карта друзей — сразу выход, кэш не трогается вообще');
    assert(/`id` > \$sinceId/.test(body), 'SQL фильтрует строго НОВЫЕ строки лога (id > курсор) — старые уже учтены, не пересчитываются');
    assert(/AND `is_sedoy`=0/.test(body), '30.09.2026: SQL также исключает удары Седого — см. tests/boss-sedoy-damage-not-shared-with-friends.test.js');
    assert(!/`time`\s*>=/.test(body), 'фильтр по time НЕ нужен отдельно — курсор id уже кодирует границу "после старта боя" (заведён от MAX(id) при бэкфилле)');
    assert(/\$session\['hp'\] = max\(0, intval\(\$session\['hp'\]\) - max\(0, intval\(\$row\['s'\]\)\)\);/.test(body),
        'новый урон друга просто ВЫЧИТАЕТСЯ из кэша (мутация), не пересчитывается заново с нуля');
    assert(/\$session\['cursorId'\] = intval\(\$row\['maxId'\]\);/.test(body),
        'курсор продвигается до максимального увиденного id — тот же удар друга не может быть учтён дважды на следующем вызове');
}

console.log('\nTest 8: attack() — HP до удара из кэша (не пересчёт), кэш сохраняется в той же транзакции, что и bosses_data');
{
    const start = bossesPhp.indexOf('function attack(){');
    const end   = bossesPhp.indexOf('function claimKill()');
    const body  = bossesPhp.slice(start, end);
    // 30.09.2026: attack() теперь строит карту ПЕРЕД вызовом _syncFightSession() — раньше сюда
    // передавался сырой $friendIds (баг, см. докблок в шапке файла).
    assert(/\$friendsSince = \$this->_friendsSinceMap\(\$user, \$friendIds, \$bossStartMs\);/.test(body),
        'attack() строит карту $friendsSince через _friendsSinceMap() ПЕРЕД синхронизацией кэша');
    assert(/\$session = \$this->_syncFightSession\(\$link, \$uid, \$this->_loadFightSession\(\$user\), \$diffIdx, \$bossId, \$bossStartMs, \$friendsSince\);/.test(body),
        'attack() синхронизирует кэш перед применением своего удара (подтягивает свежий урон друга курсором) — передаёт карту, не список');
    assert(/\$hpBefore = intval\(\$session\['hp'\]\);/.test(body), 'hpBefore читается из кэша');
    assert(/\$session\['hp'\] = \$newHp;/.test(body), 'свой удар напрямую мутирует session[\'hp\'] — без лишнего SUM()-запроса');
    assert(/\$user\['boss_fight_session'\] = json_encode\(\$session\);\s*\n\s*\$user\['bosses_data'\] = json_encode\(\$data\);\s*\n\s*if\(!\$this->ops->saveUser\(\$user\)\) return \$this->ops->fail\(99\);/.test(body),
        'boss_fight_session сохраняется в ТОМ ЖЕ saveUser(), что и bosses_data/skills_levels — один round-trip к БД, не два');
}

console.log('\nTest 9: startFight() — синхронизирует и сохраняет кэш при старте/резюме, отдаёт hp из кэша в ответе');
{
    const start = bossesPhp.indexOf('function startFight(){');
    const end   = bossesPhp.indexOf('function _loadWeaponsLocal(');
    const body  = bossesPhp.slice(start, end);
    assert(/\$activeStartMs = intval\(\$data\['bossStartMs'\]\[\$diffIdx\]\[\$bossId\]\);/.test(body),
        'startFight() берёт границу из ТОЛЬКО ЧТО записанного/сохранённого bossStartMs (одинаково для нового старта и резюма)');
    // 30.09.2026: startFight() теперь строит карту ПЕРЕД вызовом _syncFightSession() — раньше
    // сюда передавался сырой $friendIds (баг, см. докблок в шапке файла).
    assert(/\$friendsSince = \$this->_friendsSinceMap\(\$user, \$friendIds, \$activeStartMs\);/.test(body),
        'startFight() строит карту $friendsSince через _friendsSinceMap() ПЕРЕД синхронизацией кэша');
    assert(/\$session = \$this->_syncFightSession\(\$link, \$uid, \$this->_loadFightSession\(\$user\), \$diffIdx, \$bossId, \$activeStartMs, \$friendsSince\);/.test(body),
        'startFight() синхронизирует кэш ДО финального saveUser() — свежий hp едет в одном запросе с bossStartMs/keys, карта, не список');
    assert(/'hp' => intval\(\$session\['hp'\]\), 'maxHp' => \$this->BOSS_HP\[\$bossId\]\[\$diffIdx\],/.test(body),
        'ответ startFight() отдаёт hp из кэша (для резюма уже идущего боя — не всегда maxHp)');
}

console.log('\nTest 10: claimKill() — проверяет HP из кэша, очищает кэш при успешном клейме (новая попытка начнётся с чистого листа)');
{
    const start = bossesPhp.indexOf('function claimKill(){');
    const body  = bossesPhp.slice(start); // последняя функция класса
    // 30.09.2026: claimKill() теперь строит карту ПЕРЕД вызовом _syncFightSession() — раньше
    // сюда передавался сырой $hpFriendIds (баг, см. докблок в шапке файла).
    assert(/\$hpFriendsSince = \$this->_friendsSinceMap\(\$user, \$hpFriendIds, \$fightStart\);/.test(body),
        'claimKill() строит карту $hpFriendsSince через _friendsSinceMap() ПЕРЕД синхронизацией кэша');
    assert(/\$hpSession = \$this->_syncFightSession\(\$hpLink, \$uid, \$this->_loadFightSession\(\$user\), \$diffIdx, \$bossId, \$fightStart, \$hpFriendsSince\);/.test(body),
        'claimKill() синхронизирует кэш (подхватывает любой урон друга, случившийся между последним attack() и самим claimKill()) перед проверкой HP≤0 — карта, не список');
    assert(/\$curHp = intval\(\$hpSession\['hp'\]\);/.test(body), 'curHp читается из свежего кэша');
    assert(/\$user\['boss_fight_session'\] = json_encode\(\[\]\);/.test(body),
        'при успешном клейме кэш явно очищается — следующий startFight() (новый или другой bossId/diffIdx) заведёт свежий session, не унаследует старый hp');
}

console.log('\nTest 11: friendsDamage() (эндпоинт периодического автоопроса) — единственное место, где курсор реально сохраняется САМ ПО СЕБЕ (без сопутствующего удара/клейма)');
{
    const start = bossesPhp.indexOf('function friendsDamage(){');
    const end   = bossesPhp.indexOf('function rating(){');
    const body  = bossesPhp.slice(start, end);
    assert(/if\(\$bossStartMs <= 0\)\{/.test(body), 'без активного боя — короткий путь без обращения к кэшу/БД, сразу maxHp');
    // 30.09.2026: до этого фикса friendsDamage() было ЕДИНСТВЕННЫМ из четырёх мест, где карта
    // строилась правильно — теперь то же самое в startFight()/attack()/claimKill() (см. тесты
    // 8-10 выше), regex здесь не изменился по смыслу, только подтверждает, что это место
    // по-прежнему корректно.
    assert(/\$friendsSince = \$this->_friendsSinceMap\(\$user, \$friendIds, \$bossStartMs\);/.test(body),
        'friendsDamage() строит карту $friendsSince через _friendsSinceMap()');
    assert(/\$session = \$this->_syncFightSession\(\$link, \$uid, \$this->_loadFightSession\(\$user\), \$diffIdx, \$bossId, \$bossStartMs, \$friendsSince\);/.test(body),
        'friendsDamage() синхронизирует кэш через тот же метод, что attack()/startFight()/claimKill()');
    assert(/\$user\['boss_fight_session'\] = json_encode\(\$session\);\s*\n\s*\$this->ops->saveUser\(\$user\);/.test(body),
        'friendsDamage() САМ сохраняет обновлённый кэш (в отличие от чистого GET-опроса) — курсор реально "едет вперёд" при периодическом polling, а не только при собственном ударе игрока');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
