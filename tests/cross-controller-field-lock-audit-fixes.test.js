/**
 * Test: 09.10.2026, по прямому запросу пользователя ("посмотри, есть ли ещё такие же места по
 * поводу перехода по ссылке получения награды, когда данные не синхронизированы... пробежись по
 * всему проекту, посмотри места, где нужно прописать тесты").
 *
 * Фоновый аудит (тот же методология, что нашла баг в rewardlinks.php — поле защищено
 * SELECT...FOR UPDATE в одном контроллере, но пишется БЕЗ лока в другом, что открывает
 * "lost update" между конкурентными запросами) прошёлся по всем server/core/controllers/*.php
 * и нашёл 3 новых подтверждённых места (высокая уверенность):
 *
 * 1) poker.php::resolve() — пишет `weapons` (через _grantWeaponReward()) и `shmot`/`max_energy`
 *    (через grantShmotFromSource()/applyShmotOwnBonus()) обычным loadUser()/saveUser(). Защита
 *    resolve() от СВОИХ ЖЕ параллельных вызовов — _withUserLock() (GET_LOCK, именованный
 *    advisory-лок) — но weapons/shmot/max_energy в ДРУГИХ контроллерах (bosses.php/weapons.php/
 *    ryukzak.php/habar.php для weapons; shmot.php/yashik.php для shmot/max_energy) защищены
 *    SELECT...FOR UPDATE (физический лок СТРОКИ) — РАЗНЫЕ примитивы MySQL, не блокируют друг
 *    друга. Конкурентная покупка оружия/шмотки во время резолва покера могла затереть награду.
 *
 * 2) poker.php::openBag() и roulette.php::openCase() (копипаст-близнецы) — пишут `stash_count`/
 *    `shmot`/`max_energy` БЕЗ ВООБЩЕ КАКОГО-ЛИБО лока (ни GET_LOCK, ни FOR UPDATE), хотя
 *    stash_count уже лочится в yashik.php.collect(), а shmot/max_energy — в shmot.php.buy()/
 *    yashik.php.
 *
 * 3) bosses.php::claimKill() — персональный дроп шмотки босса (boss_shmot_drop_pool) пишет
 *    `shmot`/`shmot_fragments`/`max_energy` обычным $user без лока, хотя ryukzak_points в ТОЙ ЖЕ
 *    функции уже защищён SELECT...FOR UPDATE (04.10.2026) — несогласованность внутри одной
 *    функции: один дроп защищён, соседний нет.
 *
 * Фикс везде — тот же приём, что уже применён в rewardlinks.php/weapons.php/habar.php:
 * SELECT...FOR UPDATE на затрагиваемых колонках ПЕРЕД начислением награды, перечитывание свежих
 * значений в $user, запись изменившихся полей ОТДЕЛЬНЫМ UPDATE под тем же локом, исключение этих
 * полей из общего saveUser() (unset ДО вызова), восстановление в $user ТОЛЬКО после успешного
 * saveUser() (для patch в ответе).
 *
 * Структурный тест (не исполняет PHP с реальным $link/mysqli — см. AGENTS.md, "методам, которым
 * нужен $link, такого теста ещё нет") — ловит регрессию/откат самого фикса (лок исчез, порядок
 * операций нарушен), не исполняет код.
 *
 * Run: node tests/cross-controller-field-lock-audit-fixes.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const pokerSrc    = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'poker.php'), 'utf-8');
const rouletteSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');
const bossesSrc   = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');

function checkLockedFieldBlock(src, label, {
    functionMarker, lockFieldsDecl, grantMarkers, saveUserCallIdx,
}) {
    const fnIdx = src.indexOf(functionMarker);
    assert(fnIdx !== -1, `${label}: функция найдена`);

    const lockDeclIdx = src.indexOf(lockFieldsDecl, fnIdx);
    assert(lockDeclIdx !== -1 && lockDeclIdx > fnIdx, `${label}: объявление списка залоченных полей найдено внутри функции`);

    const beginTxIdx = src.indexOf('begin_transaction();', lockDeclIdx);
    assert(beginTxIdx > lockDeclIdx, `${label}: begin_transaction() идёт ПОСЛЕ объявления списка полей`);

    const forUpdateIdx = src.indexOf('FOR UPDATE', beginTxIdx);
    assert(forUpdateIdx > beginTxIdx, `${label}: SELECT...FOR UPDATE идёт внутри транзакции`);

    for (const marker of grantMarkers) {
        const markerIdx = src.indexOf(marker, forUpdateIdx);
        assert(markerIdx > forUpdateIdx, `${label}: "${marker.slice(0, 40)}..." вызывается ПОСЛЕ лока (видит свежие данные, не снимок loadUser())`);
    }

    const commitIdx = src.indexOf('->commit();', forUpdateIdx);
    assert(commitIdx > forUpdateIdx, `${label}: commit() залоченного UPDATE идёт после SELECT...FOR UPDATE`);

    const unsetIdx = src.indexOf('unset($user[$col]);', commitIdx);
    assert(unsetIdx > commitIdx, `${label}: unset($user[locked-поле]) идёт ПОСЛЕ коммита лока`);

    const saveUserIdx = src.indexOf(saveUserCallIdx, unsetIdx);
    assert(saveUserIdx > unsetIdx, `${label}: КРИТИЧНО — saveUser() вызывается ПОСЛЕ unset() locked-полей, не может затереть их устаревшим снимком`);

    const reassignIdx = src.indexOf('$user[$col] = $val;', saveUserIdx);
    assert(reassignIdx > saveUserIdx, `${label}: восстановление $user[$col] для patch идёт ПОСЛЕ успешного saveUser(), не до`);

    return { fnIdx, forUpdateIdx, saveUserIdx };
}

console.log('\nTest 1: poker.php::resolve() — weapons/shmot/max_energy защищены SELECT...FOR UPDATE поверх существующего GET_LOCK (_withUserLock)');
{
    checkLockedFieldBlock(pokerSrc, 'poker.resolve()', {
        functionMarker: 'function resolve(){',
        lockFieldsDecl: "$lockFields = ['weapons', 'shmot', 'max_energy'];",
        grantMarkers: ["grantShmotFromSource($user, 'poker')", '$this->_grantWeaponReward($user'],
        saveUserCallIdx: 'if(!$this->ops->saveUser($user))',
    });
    assert(/_withUserLock\(function\(\)\{/.test(pokerSrc), 'старый GET_LOCK (_withUserLock) НЕ убран — это защита resolve() от СВОИХ ЖЕ параллельных вызовов, FOR UPDATE её дополняет, а не заменяет');
}

console.log('\nTest 2: poker.php::openBag() — stash_count/shmot/max_energy теперь под SELECT...FOR UPDATE (раньше не было ВООБЩЕ никакого лока)');
{
    checkLockedFieldBlock(pokerSrc, 'poker.openBag()', {
        functionMarker: 'function openBag(){',
        lockFieldsDecl: "$lockFields = ['stash_count', 'shmot', 'max_energy'];",
        grantMarkers: ["$this->ops->add($user, 'stash_count', $reward['stash']);", "grantShmotFromSource($user, 'poker')"],
        saveUserCallIdx: 'if(!$this->ops->saveUser($user))',
    });
}

console.log('\nTest 3: roulette.php::openCase() — зеркальный копипаст-близнец openBag(), та же защита');
{
    checkLockedFieldBlock(rouletteSrc, 'roulette.openCase()', {
        functionMarker: 'function openCase(){',
        lockFieldsDecl: "$lockFields = ['stash_count', 'shmot', 'max_energy'];",
        grantMarkers: ["$this->ops->add($user, 'stash_count', $reward['stash']);", "grantShmotFromSource($user, 'roulette')"],
        saveUserCallIdx: 'if(!$this->ops->saveUser($user))',
    });
}

console.log('\nTest 4: bosses.php::claimKill() — персональный дроп шмотки босса (shmot/shmot_fragments/max_energy) теперь под SELECT...FOR UPDATE, как ryukzak_points в той же функции');
{
    const fnIdx = bossesSrc.indexOf('function claimKill(){');
    assert(fnIdx !== -1, 'claimKill() найдена');

    const shmotLockDeclIdx = bossesSrc.indexOf("$shmotLockFields = ['shmot', 'shmot_fragments', 'max_energy'];", fnIdx);
    assert(shmotLockDeclIdx > fnIdx, 'список залоченных полей (shmot/shmot_fragments/max_energy) объявлен внутри claimKill()');

    // Лок должен открываться ДО блока персонального дропа (который читает $this->ops->j($user, 'shmot', [])),
    // чтобы дроп видел СВЕЖЕЕ состояние, а не устаревший снимок из loadUser() в начале функции.
    const dropBlockIdx = bossesSrc.indexOf("$bossShmotState = $this->ops->j($user, 'shmot', []);", shmotLockDeclIdx);
    assert(dropBlockIdx > shmotLockDeclIdx, 'лок открывается ДО блока персонального дропа шмотки — дроп видит свежие данные');

    const commitIdx = bossesSrc.indexOf('$shmotLockLink->commit();', dropBlockIdx);
    assert(commitIdx > dropBlockIdx, 'commit() залоченного UPDATE идёт после блока дропа (знает итоговое состояние)');

    const unsetIdx = bossesSrc.indexOf('unset($user[$col]);', commitIdx);
    assert(unsetIdx > commitIdx, 'unset($user[locked-поле]) идёт ПОСЛЕ коммита');

    const saveUserIdx = bossesSrc.indexOf('if(!$this->ops->saveUser($user)) return $this->ops->fail(99);', unsetIdx);
    assert(saveUserIdx > unsetIdx, 'КРИТИЧНО: общий saveUser() вызывается ПОСЛЕ unset() — не может затереть залоченный дроп устаревшим снимком');

    const reassignIdx = bossesSrc.indexOf('foreach($shmotLockedUpdates as $col => $val) $user[$col] = $val;', saveUserIdx);
    assert(reassignIdx > saveUserIdx, 'восстановление $user[col] для patch идёт ПОСЛЕ успешного saveUser()');

    // Регрессия: ryukzak_points (уже защищённый 04.10.2026 в той же функции) не должен был
    // пострадать от этой правки — тот же паттерн, соседний лок, независимые переменные.
    assert(/\$rpLink = \$this->_rawLink\(\);/.test(bossesSrc), 'существующий лок ryukzak_points (rpLink) не тронут — независимая переменная от shmotLockLink');
    assert(/\$user\['ryukzak_points'\] = \$freshRyukzakPts;/.test(bossesSrc), 'восстановление ryukzak_points для patch по-прежнему на месте');
}

console.log('\nTest 5: во всех трёх новых местах используется один и тот же диффинг "изменилось ли поле" (не слепая перезапись ВСЕГО списка в lockedUpdates)');
{
    const pokerResolveDiff = /foreach\(\$lockFields as \$f\)\{\s*\n\s*if\(isset\(\$user\[\$f\]\) && \$user\[\$f\] !== \$lockBefore\[\$f\]\) \$lockedUpdates\[\$f\] = strval\(\$user\[\$f\]\);/;
    assert(pokerResolveDiff.test(pokerSrc), 'poker.php: $lockedUpdates собирается диффом против $lockBefore (снимок сразу после лока, до начисления) — пишутся только реально изменившиеся поля');
    assert(pokerResolveDiff.test(rouletteSrc), 'roulette.php: тот же диффинг');
    assert(/foreach\(\$shmotLockFields as \$f\)\{\s*\n\s*if\(isset\(\$user\[\$f\]\) && \$user\[\$f\] !== \$shmotLockBefore\[\$f\]\) \$shmotLockedUpdates\[\$f\] = strval\(\$user\[\$f\]\);/.test(bossesSrc),
        'bosses.php: тот же диффинг (shmotLockBefore/shmotLockedUpdates)');
}

console.log('\nTest 6: фолбэк на случай недоступного _rawLink() — $user НЕ обнуляется, обычный saveUser() всё равно сохранит посчитанное (как и в остальных контроллерах с этим паттерном)');
{
    // Если $link===null, блок "if($link){ ... unset(...) ...}" целиком пропускается — $user
    // остаётся с посчитанными (не устаревшими) значениями, которые благополучно уедут через
    // обычный saveUser() ниже. Проверяем, что unset() физически находится ВНУТРИ if($link){...}.
    const pokerResolveFnIdx = pokerSrc.indexOf('function resolve(){');
    const ifLinkIdx = pokerSrc.indexOf('if($link){', pokerSrc.indexOf('begin_transaction();', pokerResolveFnIdx));
    const unsetInResolve = pokerSrc.indexOf('foreach(array_keys($lockedUpdates) as $col) unset($user[$col]);', pokerResolveFnIdx);
    assert(ifLinkIdx !== -1 && unsetInResolve > ifLinkIdx, 'poker.resolve(): unset() находится внутри блока if($link){...} — без соединения $user не трогается, обычный saveUser() спасает начисление');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
