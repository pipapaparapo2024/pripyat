/**
 * Test: 09.10.2026, живой репорт игрока — "купил оружие, но оно обнулилось после промокода"
 * (скриншот переписки, игрок Дима Кулаков пересылает жалобу другого игрока).
 *
 * Корень: Rewardlinks::claim() читает/мутирует/пишет поля `weapons`/`shmot`/`bosses_data`
 * через обычный Gameops::loadUser()/saveUser() — ПОЛНОСТЬЮ БЕЗ блокировки строки. Но ровно те
 * же поля ТОЙ ЖЕ строки игрока weapons.php.buy()/upgrade() и bosses.php.attack() уже защищают
 * `SELECT ... FOR UPDATE` (04.10.2026, "аудит гонок состояний" — см. комментарий в weapons.php:
 * "без такой же блокировки здесь покупка и удар боссу могли одновременно прочитать устаревший
 * weapons, и один из двух saveUser() тёр бы изменения другого (lost update)"). claim() читает
 * те же поля той же таблицы, но никогда не присоединялся к этому локу.
 *
 * Сценарий бага: игрок покупает оружие (weapons.php.buy(), под локом, коммитит) ПРИМЕРНО В ТО
 * ЖЕ ВРЕМЯ, что и клейм наградной ссылки/промокода (rewardlinks.php.claim() — например, игра
 * автоматически клеймит ссылку из URL при загрузке главного экрана, см. докблок вверху файла).
 * claim() делает loadUser() ДО покупки (видит старый weapons без неё), применяет свою награду
 * поверх этого старого снимка, и сохраняет ЕГО целиком ПОСЛЕ того как покупка уже закоммичена —
 * классический "lost update": только что купленное оружие молча стирается последним saveUser().
 *
 * Фикс: claim() теперь берёт ТОТ ЖЕ физический лок строки (`SELECT ... FOR UPDATE` на той же
 * таблице `{utb}` через уже открытое `$link`-соединение — любая другая FOR UPDATE-транзакция на
 * этой строке, из ЛЮБОГО файла, реально ждёт COMMIT), перечитывает САМЫЕ свежие значения ПОД
 * локом непосредственно перед применением награды, и пишет изменившиеся ОТДЕЛЬНЫМ UPDATE внутри
 * той же транзакции (как weapons.php.buy()) — не передавая их в общий $user для последующего
 * saveUser(), чтобы тот не затёр их устаревшим снимком.
 *
 * 09.10.2026 (расширение в тот же день — по прямому запросу "посмотри, есть ли ещё такие же
 * места"): лок расширен с трёх JSON-полей (weapons/shmot/bosses_data) на `PLAIN_LOCK_FIELDS`
 * (coins/cigarettes/stew/respect/exp/energy/habar_bought) — ровно тот же класс гонки для других
 * колонок, которые locker-ят base.php/habar.php/vassilich.php/yashik.php (см. комментарий у
 * константы в rewardlinks.php). SELECT теперь строится динамически по объединённому списку
 * колонок, а не литеральной строкой `weapons, shmot, bosses_data` — тесты ниже проверяют это
 * построением регулярки по самому списку колонок, а не жёстко заданной SQL-строкой.
 *
 * $link/mysqli в claim() — реальное прямое соединение (как и у weapons.php/bosses.php), полный
 * end-to-end прогон через fake-mysqli — отдельная, более крупная задача (см. AGENTS.md, раздел
 * "Реальное исполнение PHP в тестах": "методы, которым нужен $link — такого теста ещё не
 * написано, это следующий шаг"). Здесь — структурный тест, который ловит РЕГРЕССИЮ/ОТКАТ именно
 * этого фикса (лок исчез, поля вернулись в общий saveUser(), и т.п.), а не исполняет код.
 *
 * Run: node tests/rewardlinks-claim-weapons-race-lock.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'rewardlinks.php'), 'utf-8');

// Индексы маркеров — чтобы проверить не только НАЛИЧИЕ, но и ПОРЯДОК относительно
// друг друга (лок ДО применения наград, коммит ДО saveUser(), и т.д.).
const idxLoadUser      = src.indexOf('$user = $this->ops->loadUser();');
const idxBeginTx       = src.indexOf("$link->begin_transaction();", idxLoadUser);
const idxLockSelect    = src.indexOf('FOR UPDATE', idxBeginTx);
const idxApplyLoop     = src.indexOf('foreach($reward as $entry){', idxLockSelect);
const idxLockedUpdates = src.indexOf('$lockedUpdates = [];', idxApplyLoop);
const idxCommit        = src.indexOf('$link->commit();', idxLockedUpdates);
const idxUnset         = src.indexOf('unset($user[$col]);', idxCommit);
const idxSaveUser      = src.indexOf('$this->ops->saveUser($user)', idxUnset);
const idxReassign      = src.indexOf("$user[$col] = $val;", idxSaveUser);

console.log('\nTest 1: claim() открывает лок строки (SELECT ... FOR UPDATE) на динамическом списке колонок ПОСЛЕ loadUser(), ДО применения наград');
{
    assert(idxLoadUser !== -1, 'маркер loadUser() найден');
    assert(idxBeginTx > idxLoadUser, 'begin_transaction() идёт ПОСЛЕ loadUser()');
    assert(idxLockSelect > idxBeginTx, 'FOR UPDATE идёт внутри транзакции');
    assert(/SELECT \$lockColList FROM `\{\$this->registry\['utb'\]\}` WHERE `id`=" \. \$uid \. " FOR UPDATE/.test(src),
        'SQL блокирует строку по динамическому $lockColList на той же таблице {utb}, что weapons.php.buy() — тот же физический ресурс лока');
    assert(idxApplyLoop > idxLockSelect, 'применение строк награды (_applyRewardEntry) идёт ПОСЛЕ лока — награда считается от СВЕЖИХ данных, не от снимка loadUser() вначале');
}

console.log('\nTest 1b (09.10.2026, расширение лока): $lockColList собирается из weapons/shmot/bosses_data + PLAIN_LOCK_FIELDS');
{
    assert(/const PLAIN_LOCK_FIELDS = \['coins', 'cigarettes', 'stew', 'respect', 'exp', 'energy', 'habar_bought'\];/.test(src),
        'константа PLAIN_LOCK_FIELDS содержит ровно 7 полей, которые currency/habar-записи _applyRewardEntry() пишут напрямую в $user');
    assert(/\$jsonLockFields = \['weapons', 'shmot', 'bosses_data'\];/.test(src),
        'JSON-поля (weapons/shmot/bosses_data) выделены отдельно — они идут через json_encode($state), а не прямое присваивание');
    assert(/\$allLockFields\s*=\s*array_merge\(\$jsonLockFields, self::PLAIN_LOCK_FIELDS\);/.test(src),
        '$allLockFields объединяет оба списка — SELECT...FOR UPDATE и финальный UPDATE покрывают ОБА класса полей одним локом');
    assert(/foreach\(\$allLockFields as \$lockedField\)\{\s*\n\s*if\(\$lockRow\[\$lockedField\] !== null\) \$user\[\$lockedField\] = \$lockRow\[\$lockedField\];/.test(src),
        'перечитанные под локом значения подставляются в $user для ВСЕХ полей из $allLockFields, не только трёх JSON-полей');
}

console.log('\nTest 2: перечитанные под локом значения подставляются в $user ДО вызова _applyRewardEntry()');
{
    assert(/if\(\$lockRow\[\$lockedField\] !== null\) \$user\[\$lockedField\] = \$lockRow\[\$lockedField\];/.test(src),
        'значения из SELECT...FOR UPDATE перезаписывают $user[weapons/shmot/bosses_data] — _applyRewardEntry() увидит актуальное состояние, не устаревшее из loadUser()');
}

console.log('\nTest 3: locked-поля пишутся ОТДЕЛЬНЫМ UPDATE внутри транзакции и коммитятся ДО общего saveUser()');
{
    assert(idxLockedUpdates > idxApplyLoop, '$lockedUpdates собирается ПОСЛЕ применения наград (знает итоговое состояние)');
    assert(/\$link->query\("UPDATE `\{\$this->registry\['utb'\]\}` SET " \. implode\(',', \$setParts\) \. " WHERE `id`=" \. \$uid\);/.test(src),
        'прямой UPDATE на ту же таблицу/строку через $link (та же транзакция, тот же лок) — не через общий Gameops::saveUser()');
    assert(idxCommit > idxLockedUpdates, 'link->commit() идёт ПОСЛЕ прямого UPDATE locked-полей');
    assert(idxUnset > idxCommit, 'unset($user[locked-поле]) идёт ПОСЛЕ коммита лока');
    assert(idxSaveUser > idxUnset,
        'КРИТИЧНО: $this->ops->saveUser($user) вызывается ПОСЛЕ unset() locked-полей — общий saveUser() НЕ может затереть их устаревшим снимком, т.к. их вообще нет в $user на этот момент');
}

console.log('\nTest 3b (09.10.2026): PLAIN_LOCK_FIELDS пишутся в $lockedUpdates только если реально изменились (дифф против снимка ДО применения наград)');
{
    const idxPlainBefore = src.indexOf('$plainBefore = [];', idxLockSelect);
    assert(idxPlainBefore > idxLockSelect && idxPlainBefore < idxApplyLoop,
        '$plainBefore снимается ПОСЛЕ лока, но ДО применения наград — иначе дифф был бы против устаревших значений');
    assert(/foreach\(self::PLAIN_LOCK_FIELDS as \$f\) \$plainBefore\[\$f\] = \$user\[\$f\] \?\? null;/.test(src),
        '$plainBefore снимает ВСЕ 7 плоских полей, не только изменившиеся');
    assert(/foreach\(self::PLAIN_LOCK_FIELDS as \$f\)\{\s*\n\s*if\(isset\(\$user\[\$f\]\) && \$user\[\$f\] !== \$plainBefore\[\$f\]\) \$lockedUpdates\[\$f\] = strval\(\$user\[\$f\]\);/.test(src),
        'в $lockedUpdates попадают только РЕАЛЬНО изменившиеся плоские поля (!==  сравнение с $plainBefore) — не весь список вслепую');
}

console.log('\nTest 4: $user[locked-поле] восстанавливается ТОЛЬКО после успешного saveUser() — для корректного patch в ответе, без повторной записи в БД');
{
    assert(idxReassign > idxSaveUser, '$user[$col] = $val (восстановление для patch) идёт ПОСЛЕ saveUser(), не до');
    assert(/if\(!\$this->ops->saveUser\(\$user\)\)\{/.test(src.slice(idxSaveUser - 10, idxSaveUser + 40)),
        'saveUser() обёрнут в проверку на неудачу');
}

console.log('\nTest 5: при провале saveUser() ПОСЛЕ коммита locked-полей claim НЕ откатывается (награда частично уже выдана — повторный клейм задвоил бы её)');
{
    const failBlock = src.slice(idxSaveUser, idxSaveUser + 600);
    assert(!/_rollbackClaim\(\);/.test(failBlock),
        'в блоке обработки неудачного saveUser() ПОСЛЕ лока нет вызова _rollbackClaim() — иначе игрок мог бы повторно заклеймить уже частично выданную награду');
    assert(/error_log/.test(failBlock), 'частичный сбой логируется (Правило №8 — подробное логирование)');
}

console.log('\nTest 6: пустой summary (ничего не выдано) теперь тоже откатывает ОТКРЫТУЮ транзакцию лока, не только резервацию claim');
{
    const emptyBlock = src.slice(src.indexOf('if(empty($summary)){'), src.indexOf('if(empty($summary)){') + 400);
    assert(/\$link->rollback\(\);/.test(emptyBlock),
        'при пустом summary вызывается $link->rollback() — освобождает лок строки корректно (не просто закрывает соединение поверх открытой транзакции)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
