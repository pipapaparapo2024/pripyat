/**
 * Test: 04.10.2026, аудит проекта ("пройдись по всему проекту, найди дыры... исправь критические
 * проблемы") нашёл 4 класса гонок состояний (lost update) — несколько эндпоинтов мутируют то же
 * самое служебное поле игрока через Gameops::loadUser()/saveUser() БЕЗ блокировки строки:
 *
 *   1. skills_levels  — bosses.php.attack()/claimKill()/endFightSession() vs skills.php.upgrade()
 *   2. weapons        — weapons.php.buy()/upgrade() vs ryukzak.php.open() vs bosses.php.attack()
 *                        (attack() уже был защищён раньше — 26.09.2026 — остальные два не были)
 *   3. ryukzak_points — bosses.php.claimKill() (начисление) vs ryukzak.php.open() (обнуление)
 *   4. poker_session/dice_session — deal/swap/resolve (poker.php) и start/reroll/resolve
 *      (dice.php) — двойной клик/сетевой ретрай мог обойти лимит смен карт/перебросов
 *
 * Фикс для 1-3 — тот же физический DB row-lock (SELECT ... FOR UPDATE в явной транзакции на
 * строке users.id=uid), что уже был опробован 26.09.2026 для списания патронов в bosses.php.
 * attack() — ЛЮБАЯ FOR UPDATE транзакция на этой строке, из ЛЮБОГО файла, реально ждёт COMMIT
 * другой, это настоящий лок уровня БД, не просто совпадение имён переменных.
 *
 * Фикс для 4 — GET_LOCK-паттерн (zone.php._withUserLock()), каждая функция целиком обёрнута в
 * локальный лок строки, поскольку poker_session/dice_session не делятся между разными файлами.
 *
 * Дисциплина "не присваивать $user[поле] ДО общего saveUser(), если поле уже записано отдельным
 * UPDATE под локом" — та же, что уже задокументирована для boss_fight_session (см. AGENTS.md,
 * "Критичные общие функции"): иначе общий saveUser() перезаписал бы поле устаревшим снимком,
 * загруженным в начале функции, случайно воспроизводя саму гонку, которую фикс должен убрать.
 *
 * 04.10.2026, ВТОРОЙ ПРОХОД (баг найден ПРИ ПИСАНИИ этого же теста, не живым репортом): первая
 * версия фикса для 1-3 безусловно откладывала присвоение $user[поле] до ПОСЛЕ saveUser() — но
 * если _rawLink() не смог открыть отдельное соединение (лока не было вообще), прямой UPDATE под
 * локом тоже не выполнялся — то есть результат вообще НИГДЕ не сохранялся: не прямым UPDATE (его
 * не было), не через общий saveUser() (присвоение было слишком позним). Правильный контракт:
 * если лок удался — присваивать $user[поле] ПОСЛЕ saveUser() (значение уже закоммичено отдельно,
 * трогать $user раньше — риск гонки); если лок НЕ удался — присваивать ДО saveUser(), как было
 * до всего этого фикса (единственный оставшийся путь сохранения). Тесты ниже проверяют именно
 * этот двухветочный контракт, а не только "лок есть".
 *
 * Это СТРУКТУРНЫЕ (regex) тесты, не тесты реального поведения под нагрузкой — реальная
 * конкурентность (два параллельных запроса) не воспроизводима в этом харнессе без живой БД
 * (см. AGENTS.md "Реальное исполнение PHP в тестах" — тесты не открывают реальных БД-коннектов).
 * Их задача — поймать РЕГРЕССИЮ (кто-то в будущем уберёт лок или вернёт присвоение в неверную
 * ветку при рефакторинге), а не доказать сам факт работы блокировки — это проверено вручную.
 *
 * Run: node tests/race-conditions-skills-weapons-ryukzak-casino-04-10.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readPhp(relPath) {
    return fs.readFileSync(path.join(root, relPath), 'utf-8');
}
function sliceFn(src, fnSignature, nextFnSignature) {
    const start = src.indexOf(fnSignature);
    if (start === -1) return null;
    const searchFrom = start + fnSignature.length;
    const end = nextFnSignature ? src.indexOf(nextFnSignature, searchFrom) : src.length;
    return src.slice(start, end === -1 ? src.length : end);
}

const bossesPhp  = readPhp('server/core/controllers/bosses.php');
const skillsPhp  = readPhp('server/core/controllers/skills.php');
const weaponsPhp = readPhp('server/core/controllers/weapons.php');
const ryukzakPhp = readPhp('server/core/controllers/ryukzak.php');
const pokerPhp   = readPhp('server/core/controllers/poker.php');
const dicePhp    = readPhp('server/core/controllers/dice.php');

console.log('\nTest 1: skills.php.upgrade() лочит строку (SELECT...FOR UPDATE) вокруг skills_levels, с двухветочным контрактом присвоения');
{
    const body = sliceFn(skillsPhp, 'function upgrade(){');
    assert(!!body, 'upgrade() найден');
    assert(/SELECT `skills_levels`[\s\S]{0,200}FOR UPDATE/.test(body), 'читает skills_levels под FOR UPDATE');
    assert(/begin_transaction\(\)/.test(body) && /\$link->commit\(\)/.test(body), 'использует явную транзакцию begin_transaction/commit');
    assert(/UPDATE `\{\$this->registry\['utb'\]\}` SET `skills_levels`=/.test(body), 'пишет итог отдельным прямым UPDATE');
    // Контракт: ровно ДВА присвоения $user['skills_levels'] — одно в else-ветке (без лока, ДО
    // saveUser), одно безусловное после saveUser (переприсвоение того же значения, безвредно).
    const assignCount = (body.match(/\$user\['skills_levels'\] = \$finalSkillsJson;/g) || []).length;
    assert(assignCount === 2, `ровно 2 присвоения \$user['skills_levels'] (фолбэк-ветка + после save), найдено ${assignCount}`);
    const saveIdx = body.indexOf('saveUser($user)');
    const firstAssignIdx = body.indexOf("\$user['skills_levels'] = \$finalSkillsJson;");
    const lastAssignIdx = body.lastIndexOf("\$user['skills_levels'] = \$finalSkillsJson;");
    assert(firstAssignIdx > -1 && saveIdx > -1 && firstAssignIdx < saveIdx, 'фолбэк-присвоение (без лока) идёт ДО saveUser() — иначе результат молча потеряется, если _rawLink() не смог подключиться');
    assert(lastAssignIdx > saveIdx, 'финальное присвоение идёт ПОСЛЕ saveUser() (для patch/debug)');
}

console.log('\nTest 2: bosses.php.attack() лочит строку вокруг skills_levels (тот же приём, что у weapons), с двухветочным контрактом');
{
    const body = sliceFn(bossesPhp, 'function attack(){', 'function ');
    assert(!!body, 'attack() найден');
    const skBlockIdx = body.indexOf("SELECT `skills_levels`");
    assert(skBlockIdx > -1, 'читает skills_levels под FOR UPDATE внутри attack()');
    const skBlock = body.slice(Math.max(0, skBlockIdx - 300), skBlockIdx + 1200);
    assert(/FOR UPDATE/.test(skBlock), 'запрос именно FOR UPDATE');
    assert(/UPDATE `\{\$this->registry\['utb'\]\}` SET `skills_levels`=/.test(skBlock), 'пишет итог отдельным UPDATE под той же транзакцией');

    const assignCount = (body.match(/\$user\['skills_levels'\] = \$finalSkillsJson;/g) || []).length;
    assert(assignCount === 2, `ровно 2 присвоения (фолбэк-ветка + после save), найдено ${assignCount}`);
    const saveIdx = body.indexOf('saveUser($user)');
    const firstAssignIdx = body.indexOf("\$user['skills_levels'] = \$finalSkillsJson;");
    assert(firstAssignIdx > -1 && saveIdx > -1 && firstAssignIdx < saveIdx, 'фолбэк-присвоение идёт ДО saveUser() — без него результат удара без лока молча терялся бы');
}

console.log('\nTest 3: bosses.php._finalizeSkillSession() возвращает {json, locked} — вызывающий код решает, когда присваивать $user');
{
    const body = sliceFn(bossesPhp, 'private function _finalizeSkillSession(', 'function endFightSession');
    assert(!!body, '_finalizeSkillSession() найден');
    assert(!/function _finalizeSkillSession\(&\$user\)/.test(bossesPhp), 'сигнатура больше не принимает $user по ссылке (раньше мутировала напрямую)');
    assert(/SELECT `skills_levels`[\s\S]{0,200}FOR UPDATE/.test(body), 'читает АКТУАЛЬНОЕ skills_levels под локом, не устаревший $user');
    assert(/return \['json' => \$json, 'locked' => true\];/.test(body), 'залоченная ветка возвращает locked:true (запись уже ушла отдельным UPDATE)');
    assert(/return \['json' => json_encode\(\$state\), 'locked' => false\];/.test(body), 'фолбэк-ветка возвращает locked:false (вызывающий ДОЛЖЕН сохранить сам)');
}

console.log('\nTest 4: claimKill()/endFightSession() присваивают результат _finalizeSkillSession() ДО saveUser() ТОЛЬКО если locked:false');
{
    for (const [label, sig, nextSig] of [
        ['claimKill', 'function claimKill(){', 'function endFightSession'],
        ['endFightSession', 'function endFightSession(){', 'function attack('],
    ]) {
        const body = sliceFn(bossesPhp, sig, nextSig);
        assert(!!body, label + '() найден');
        const callIdx = body.indexOf('_finalizeSkillSession($user)');
        const guardIdx = body.indexOf("if(!\$skillsResult['locked']) \$user['skills_levels'] = \$skillsResult['json'];");
        const saveIdx = body.indexOf('saveUser($user)');
        const finalAssignIdx = body.lastIndexOf("\$user['skills_levels'] = \$skillsResult['json'];");
        assert(callIdx > -1 && guardIdx > -1 && saveIdx > -1 && finalAssignIdx > -1, label + '(): все шаги найдены (вызов/условное присвоение/save/финальное присвоение)');
        assert(callIdx < guardIdx && guardIdx < saveIdx && saveIdx < finalAssignIdx, label + '(): порядок — вызов → условное присвоение (если !locked) → saveUser() → безусловное финальное присвоение');
    }
}

console.log('\nTest 5: bosses.php.claimKill() лочит строку вокруг ryukzak_points (начисление за килл), с двухветочным контрактом');
{
    const body = sliceFn(bossesPhp, 'function claimKill(){', 'function endFightSession');
    const rpIdx = body.indexOf("SELECT `ryukzak_points`");
    assert(rpIdx > -1, 'читает ryukzak_points под FOR UPDATE');
    const rpBlock = body.slice(Math.max(0, rpIdx - 300), rpIdx + 700);
    assert(/FOR UPDATE/.test(rpBlock), 'запрос именно FOR UPDATE');
    assert(/UPDATE `\{\$this->registry\['utb'\]\}` SET `ryukzak_points`=/.test(rpBlock), 'пишет итог отдельным UPDATE под той же транзакцией');

    const assignCount = (body.match(/\$user\['ryukzak_points'\] = \$freshRyukzakPts;/g) || []).length;
    assert(assignCount === 2, `ровно 2 присвоения (фолбэк-ветка + после save), найдено ${assignCount}`);
    const saveIdx = body.indexOf('saveUser($user)');
    const firstAssignIdx = body.indexOf("\$user['ryukzak_points'] = \$freshRyukzakPts;");
    assert(firstAssignIdx > -1 && saveIdx > -1 && firstAssignIdx < saveIdx, 'фолбэк-присвоение идёт ДО saveUser() — без него начисление без лока молча терялось бы');
}

console.log('\nTest 6: ryukzak.php.open() лочит строку вокруг ryukzak_points (обнуление) И weapons (выдача оружия), с двухветочным контрактом для обоих');
{
    const body = sliceFn(ryukzakPhp, 'function open(){');
    assert(!!body, 'open() найден');
    assert(/SELECT `ryukzak_points`[\s\S]{0,200}FOR UPDATE/.test(body), 'читает ryukzak_points под FOR UPDATE перед обнулением');
    assert(/UPDATE `\{\$this->registry\['utb'\]\}` SET `ryukzak_points`='0'/.test(body), 'обнуляет отдельным прямым UPDATE');
    assert(/SELECT `weapons`[\s\S]{0,200}FOR UPDATE/.test(body), 'читает weapons под FOR UPDATE перед розыгрышем награды');
    assert(/UPDATE `\{\$this->registry\['utb'\]\}` SET `weapons`=/.test(body), 'пишет итог weapons отдельным UPDATE');

    const generalSaveIdx = body.lastIndexOf('saveUser($user)');
    assert(generalSaveIdx > -1, 'общий saveUser() найден');

    const wAssignCount = (body.match(/\$user\['weapons'\] = \$finalWeaponsJson;/g) || []).length;
    assert(wAssignCount === 2, `weapons: ровно 2 присвоения (фолбэк-ветка + условное после save), найдено ${wAssignCount}`);
    const wFirstAssignIdx = body.indexOf("\$user['weapons'] = \$finalWeaponsJson;");
    assert(wFirstAssignIdx > -1 && wFirstAssignIdx < generalSaveIdx, 'weapons: фолбэк-присвоение идёт ДО saveUser() — без него награда оружием без лока молча терялась бы');
    assert(/if\(\$wpLink\) \$user\['weapons'\] = \$finalWeaponsJson;/.test(body), 'weapons: финальное присвоение ПОСЛЕ save условно (только если лок реально сработал)');

    const rpAssignCount = (body.match(/\$user\['ryukzak_points'\] = 0;/g) || []).length;
    assert(rpAssignCount === 2, `ryukzak_points: ровно 2 присвоения (фолбэк-ветка + после save), найдено ${rpAssignCount}`);
    const rpFirstAssignIdx = body.indexOf("\$user['ryukzak_points'] = 0;");
    assert(rpFirstAssignIdx > -1 && rpFirstAssignIdx < generalSaveIdx, 'ryukzak_points: фолбэк-присвоение идёт ДО saveUser()');
}

console.log('\nTest 7: weapons.php.buy()/upgrade() лочат строку вокруг weapons (тот же физический row-lock, что bosses.php.attack()), с двухветочным контрактом');
{
    for (const [label, sig, nextSig] of [
        ['buy', 'function buy(){', 'function upgrade('],
        ['upgrade', 'function upgrade(){', null],
    ]) {
        const body = sliceFn(weaponsPhp, sig, nextSig);
        assert(!!body, label + '() найден');
        assert(/SELECT `weapons`[\s\S]{0,200}FOR UPDATE/.test(body), label + '(): читает weapons под FOR UPDATE');
        assert(/UPDATE `\{\$this->registry\['utb'\]\}` SET `weapons`=/.test(body), label + '(): пишет итог отдельным UPDATE');

        const assignCount = (body.match(/\$user\['weapons'\] = \$finalWeaponsJson;/g) || []).length;
        assert(assignCount === 2, `${label}(): ровно 2 присвоения (фолбэк-ветка + условное после save), найдено ${assignCount}`);
        const saveIdx = body.indexOf('saveUser($user)');
        const firstAssignIdx = body.indexOf("\$user['weapons'] = \$finalWeaponsJson;");
        assert(firstAssignIdx > -1 && saveIdx > -1 && firstAssignIdx < saveIdx, `${label}(): фолбэк-присвоение идёт ДО saveUser() — без него покупка/прокачка без лока молча терялась бы`);
        assert(/if\(\$link\) \$user\['weapons'\] = \$finalWeaponsJson;/.test(body), `${label}(): финальное присвоение условно (только если лок реально сработал)`);
    }
}

console.log('\nTest 8: poker.php — deal()/swap()/resolve() целиком под GET_LOCK (zone.php._withUserLock-паттерн)');
{
    assert(/private function _withUserLock\(callable \$fn\)/.test(pokerPhp), '_withUserLock() определён');
    assert(/GET_LOCK\('\{\$escaped\}', 5\)/.test(pokerPhp), 'использует GET_LOCK с таймаутом 5с, как zone.php');
    for (const fn of ['deal', 'swap', 'resolve']) {
        const sig = `function ${fn}(){`;
        const idx = pokerPhp.indexOf(sig);
        assert(idx > -1, `${fn}() найден`);
        const afterSig = pokerPhp.slice(idx, idx + 400);
        assert(/_withUserLock\(function/.test(afterSig), `${fn}(): тело обёрнуто в _withUserLock(function(){...})`);
    }
}

console.log('\nTest 9: dice.php — start()/reroll()/resolve() целиком под GET_LOCK');
{
    assert(/private function _withUserLock\(callable \$fn\)/.test(dicePhp), '_withUserLock() определён');
    assert(/GET_LOCK\('\{\$escaped\}', 5\)/.test(dicePhp), 'использует GET_LOCK с таймаутом 5с');
    for (const fn of ['start', 'reroll', 'resolve']) {
        const sig = `function ${fn}(){`;
        const idx = dicePhp.indexOf(sig);
        assert(idx > -1, `${fn}() найден`);
        const afterSig = dicePhp.slice(idx, idx + 400);
        assert(/_withUserLock\(function/.test(afterSig), `${fn}(): тело обёрнуто в _withUserLock(function(){...})`);
    }
}

console.log('\nTest 10: ammo_machete/gun/auto (легаси-колонки, НЕ защищённые локом weapons) персистятся КАК И РАНЬШЕ, до saveUser() — не задеты рефакторингом');
{
    const buyBody = sliceFn(weaponsPhp, 'function buy(){', 'function upgrade(');
    const ammoIdx = buyBody.indexOf("\$user[\$ammoKey] = strval(\$weapons[\$wid]['qty']);");
    const saveIdx = buyBody.indexOf('saveUser($user)');
    assert(ammoIdx > -1 && saveIdx > -1 && ammoIdx < saveIdx, 'buy(): ammo_* присваивается ДО saveUser() (легаси-поле, не часть лока weapons, сохраняется как раньше)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
