/**
 * Test: 04.10.2026, найдено НЕ по жалобе, а по прямому разбору прод-БД (в рамках аудита бага
 * "друзья не отображаются в рейтинге урона" — тот баг описан и исправлен отдельно, см.
 * tests/boss-friendssince-map-all-call-sites.test.js, Test 7/8). Проверяя реальный живой бой двух
 * игроков, нашлось второе, независимое расхождение: `boss_fight_session.cursorId` в БД уехал
 * далеко вперёд (SQL честно "видел" и матчил ~6300 урона друга), а `hp` при этом остался РОВНО
 * равен maxHp — ни этот урон друга, ни собственный удар игрока так и не вычлись из кэша.
 *
 * Корень: четыре разных эндпоинта (attack(), friendsDamage(), startFight(), useSedoy()) читали
 * `boss_fight_session` через обычный `Gameops::loadUser()` (своё отдельное соединение, ПОЛНАЯ
 * строка игрока, БЕЗ блокировки) и писали обратно через обычный `Gameops::saveUser()`
 * (INSERT...ON DUPLICATE KEY UPDATE, см. `Database::saveData()`). Если два таких запроса прилетают
 * почти одновременно — типичный случай: клиент периодически опрашивает `friendsDamage()`, пока
 * игрок параллельно жмёт "Ударить" (`attack()`) — оба читают ОДИН И ТОТ ЖЕ старый кэш, оба
 * независимо считают СВОЙ новый hp/cursorId, и чей `saveUser()` отработает позже — молча затирает
 * обновление первого (классический lost update). Ровно тот же класс гонки, что уже чинили
 * 26.09.2026 для списания патронов в том же `attack()` (комментарий у блокировки `weapons` там же)
 * — но для `boss_fight_session` этот фикс тогда не сделали.
 *
 * Фикс: тот же паттерн, что уже работал для патронов — `SELECT ... FOR UPDATE` держит блокировку
 * строки игрока до `COMMIT`, второй параллельный запрос физически ждёт эту транзакцию и видит уже
 * обновлённое значение, а не стартует от того же устаревшего снимка. Новые приватные методы:
 *   - `_syncFightSessionLocked()` — начинает транзакцию, блокирующим SELECT читает АКТУАЛЬНОЕ
 *     (не загруженное РАНЬШЕ через обычный loadUser()) значение кэша, прогоняет через уже
 *     существующий `_syncFightSession()`, транзакцию НЕ коммитит (вызывающий код может ещё
 *     применить свой удар/урон Седого к `$session` на том же `$link`).
 *   - `_commitFightSession()` — пишет итоговый `$session` сырым UPDATE и коммитит.
 * Все 4 вызывающих места переведены на пару `_syncFightSessionLocked()` + `_commitFightSession()`
 * вместо `_syncFightSession()` + `$user['boss_fight_session'] = json_encode($session)` (эта
 * строка убрана из всех четырёх — иначе финальный `saveUser($user)` для ДРУГИХ полей заново
 * перезаписал бы `boss_fight_session` устаревшим значением, загруженным ДО блокировки, сводя
 * фикс на нет).
 *
 * claimKill() НЕ переведён — его `$hpSession` используется только как гейт `curHp<=0`, ничего не
 * пишет обратно, поэтому лока от lost-update не требует (см. комментарий в коде).
 *
 * Run: node tests/boss-fight-session-row-lock-race.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const php = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');

function bodyOf(startMarker, endMarker) {
    const start = php.indexOf(startMarker);
    const end = endMarker ? php.indexOf(endMarker, start) : php.length;
    return php.slice(start, end);
}

console.log('\nTest 1: _syncFightSessionLocked() блокирует строку SELECT...FOR UPDATE и перечитывает кэш ПОД локом');
{
    const body = bodyOf('private function _syncFightSessionLocked(', 'private function _commitFightSession(');
    assert(body.length > 0, '_syncFightSessionLocked() найден');
    assert(/\$link->begin_transaction\(\);/.test(body), 'открывает транзакцию');
    assert(/SELECT `boss_fight_session` FROM `\{\$this->registry\['utb'\]\}` WHERE `id`=.*FOR UPDATE/.test(body),
        'блокирует строку игрока SELECT...FOR UPDATE (тот же паттерн, что и для weapons в attack())');
    assert(/return \$this->_syncFightSession\(\$link, \$uid, \$lockedSession, \$diffIdx, \$bossId, \$bossStartMs, \$friendsSince\);/.test(body),
        'пересчитывает кэш через существующий _syncFightSession(), используя ИМЕННО свежепрочитанное под локом значение (не то, что было в $user до блокировки)');
    assert(!/\$link->commit\(\);/.test(body), 'НЕ коммитит сама — оставляет транзакцию открытой, чтобы вызывающий код мог ещё применить свой удар поверх');
}

console.log('\nTest 2: _commitFightSession() пишет сырым UPDATE и коммитит, снимая блокировку');
{
    const body = bodyOf('private function _commitFightSession(', null);
    const end = body.indexOf('\n        }');
    const fnBody = body.slice(0, end);
    assert(/UPDATE `\{\$this->registry\['utb'\]\}` SET `boss_fight_session`=/.test(fnBody), 'пишет boss_fight_session сырым UPDATE (в обход Gameops::saveUser())');
    assert(/\$link->commit\(\);/.test(fnBody), 'коммитит транзакцию');
}

console.log('\nTest 3: все 4 вызывающих места используют locked+commit пару, а не голый _syncFightSession()+прямое присваивание $user[\'boss_fight_session\']');
{
    const sites = [
        { name: 'friendsDamage()', start: 'function friendsDamage(){', end: 'function _ratingTop(' },
        { name: 'startFight()',    start: 'function startFight(){',    end: 'function _loadWeaponsLocal(' },
        { name: 'attack()',        start: 'function attack(){',        end: 'function claimKill()' },
        { name: 'useSedoy()',      start: 'function useSedoy(){',      end: "'patch' => \$patch," },
    ];
    for(const site of sites){
        const body = bodyOf(site.start, site.end);
        assert(/\$this->_syncFightSessionLocked\(/.test(body), `${site.name}: вызывает _syncFightSessionLocked()`);
        assert(/\$this->_commitFightSession\(/.test(body), `${site.name}: вызывает _commitFightSession()`);
        assert(!/\$user\['boss_fight_session'\]\s*=\s*json_encode\(\$session\)/.test(body),
            `${site.name}: регресс-гвард — старое прямое присваивание $user['boss_fight_session']=json_encode($session) убрано (иначе финальный saveUser() перезаписал бы атомарно сохранённое значение устаревшим)`);
    }
}

console.log('\nTest 4: регресс-гвард — ровно 4 вызова _syncFightSessionLocked()/_commitFightSession() в файле (не больше, не меньше — если появится новое место, работающее с boss_fight_session, оно обязано использовать лок)');
{
    const lockedCalls = (php.match(/\$this->_syncFightSessionLocked\(/g) || []).length;
    const commitCalls = (php.match(/\$this->_commitFightSession\(/g) || []).length;
    assert(lockedCalls === 4, `_syncFightSessionLocked() вызывается ровно 4 раза — найдено ${lockedCalls}`);
    assert(commitCalls === 4, `_commitFightSession() вызывается ровно 4 раза — найдено ${commitCalls}`);
}

console.log('\nTest 5: claimKill() осознанно НЕ переведён на лок (read-only гейт, не пишет сессию обратно) — регресс-гвард на случай будущей путаницы');
{
    const body = bodyOf('function claimKill(){', null);
    const hpSessionLine = body.match(/\$hpSession = \$this->_syncFightSession\([^;]*\);/);
    assert(hpSessionLine !== null, 'claimKill() по-прежнему использует НЕлоченный _syncFightSession() для $hpSession (гейт curHp<=0)');
    assert(!/\$hpSession = \$this->_syncFightSessionLocked\(/.test(body),
        'claimKill() не вызывает _syncFightSessionLocked() для $hpSession — намеренно, см. комментарий в коде');
    // claimKill() сбрасывает кэш в [] при успешном клейме — это статический сброс (не основан на
    // $session), не часть проблемы lost-update, трогать не нужно.
    assert(/\$user\['boss_fight_session'\] = json_encode\(\[\]\);/.test(body),
        'claimKill() по-прежнему сбрасывает boss_fight_session в [] через обычный saveUser() при победе (статический сброс, не регрессия)');
}

console.log('\nTest 6: мини-модель — демонстрирует, почему lost update возможен БЕЗ лока и невозможен С локом');
{
    // Упрощённая модель БД как общего состояния + два "конкурентных" запроса без лока.
    function racingWritesNoLock(initialHp){
        const db = { hp: initialHp };
        // Оба запроса читают ОДИН И ТОТ ЖЕ снимок (гонка — читают ДО того, как кто-то записал).
        const readByA = db.hp;
        const readByB = db.hp;
        const newHpA = readByA - 20;   // запрос A (atack own hit) вычитает 20
        const newHpB = readByB - 6332; // запрос B (friendsDamage, урон друга) вычитает 6332
        db.hp = newHpA; // A сохраняет первым
        db.hp = newHpB; // B сохраняет ВТОРЫМ — затирает A целиком (lost update)
        return db.hp;
    }
    function sequentialWritesWithLock(initialHp){
        const db = { hp: initialHp };
        // С локом второй запрос ФИЗИЧЕСКИ ждёт и читает УЖЕ обновлённое значение первого.
        db.hp = db.hp - 20;   // A: lock -> read(fresh) -> write(hp-20) -> commit (unlock)
        db.hp = db.hp - 6332; // B: lock -> read(fresh, уже hp-20) -> write(-6332 поверх) -> commit
        return db.hp;
    }

    const maxHp = 3628;
    const lost = racingWritesNoLock(maxHp);
    const correct = sequentialWritesWithLock(maxHp);

    assert(lost === maxHp - 6332, 'БЕЗ лока: итоговый hp учитывает ТОЛЬКО второго "победителя гонки" (-6332), удар первого (-20) потерян — это и наблюдалось в прод-БД (cursorId уехал, hp не упал)');
    assert(correct === maxHp - 20 - 6332, 'С локом: оба вычитания применяются последовательно, ни одно не теряется');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
