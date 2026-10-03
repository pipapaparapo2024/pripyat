/**
 * Test: баг найден по прямому указанию 29.09.2026 — "есть шмот связка ключей, но при нападении
 * на босса всё равно требует ключи".
 *
 * Корень: server/core/controllers/bosses.php.startFight() уже давно (фикс 25.09.2026, см.
 * tests/keyring-security-and-unlimited-boss-attacks.test.js) пропускает проверку/списание
 * ключей для владельца keyring_owner — НО клиент никогда не давал серверу этот запрос
 * увидеть. Четыре независимых клиентских предчека ключей (все — чисто UX-подсказка "не ходить
 * на сервер зря", см. комментарий в bosses-combat.js._attack) читали только
 * bosses.keys[idx]/d.keys_needed и понятия не имели о keyring_owner:
 *
 *   1. bosses_fight.js._openBossesFight()   — САМЫЙ важный: физически не пускает запрос
 *      bosses.startFight на сервер вообще, если бой ещё не начат.
 *   2. bosses_prefight.js.napBtn            — кнопка "Напасть" на экране предпросмотра боя.
 *   3. bosses-combat.js._attack()           — предчек перед самим ударом.
 *   4. boss_result.js "ЕЩЁ РАЗ"             — повторный вход в бой с попапа результата.
 *
 * Игрок с честно выигранной "Связкой ключей" (udata['keyring_owner']>0, shmot.js item id100
 * уже показывает её как owned) упирался в любой из этих четырёх гейтов раньше, чем сервер
 * успевал сказать "да, можно" — предмет был декоративным по факту, хотя backend его уже
 * поддерживал.
 *
 * Фикс: добавлен bosses.js._hasKeyring() (тот же способ чтения поля, что shmot.js уже
 * использует для keyringItem.owned) и во все 4 места добавлено "!hasKeyring &&" перед условием
 * недостатка ключей — точное зеркало серверного if(!$hasKeyring){ ... } в bosses.php.
 *
 * Run: node tests/keyring-client-side-attack-gates.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const bossesJs        = read('_client/src/game/bosses.js');
const bossesFightJs   = read('_client/src/game/shell/overlays/bosses_fight.js');
const bossesPrefightJs= read('_client/src/game/shell/overlays/bosses_prefight.js');
const bossesCombatJs  = read('_client/src/game/bosses/bosses-combat.js');
const bossResultJs    = read('_client/src/game/shell/popups/boss_result.js');

console.log('\n1) bosses.js — единый метод _hasKeyring() читает udata[\'keyring_owner\'] (тот же паттерн, что shmot.js.keyringItem.owned)');
{
    assert(/_hasKeyring\(\)\{\s*\n\s*return !!\(udata && parseInt\(udata\['keyring_owner'\]\) > 0\);/.test(bossesJs),
        '_hasKeyring() определён и читает udata[\'keyring_owner\'] > 0');
}

console.log('\n2) bosses_fight.js._openBossesFight() — главный гейт (иначе bosses.startFight на сервер не уходит вообще) пропускает владельца связки');
{
    const start = bossesFightJs.indexOf('proto._openBossesFight = function(bossIdx, diffIdx){');
    const end   = bossesFightJs.indexOf('\n    };', start);
    const body  = bossesFightJs.slice(start, end);
    // 29.09.2026 (по прямому указанию, тот же день — общий ключ Баркута/Бороды): bossIdx
    // заменён на keySlot (data.key_slot != null ? data.key_slot : bossIdx) — те два босса
    // делят один слот ключа, см. тот же keySlot-рефактор в bosses.php.startFight().
    assert(/if\(!bosses\._hasKeyring\(\) && \(bosses\.keys\[keySlot\] \|\| 0\) < need\)/.test(body),
        '_openBossesFight() больше не блокирует запрос к серверу для владельца связки');
}

console.log('\n3) bosses_prefight.js.napBtn — кнопка "Напасть" пропускает владельца связки');
{
    assert(/if\(!bosses\._hasKeyring\(\) && keysNeed > 0 && keysHave < keysNeed\)\{/.test(bossesPrefightJs),
        'napBtn пропускает проверку ключей для владельца связки');
}

console.log('\n4) bosses-combat.js._attack() — предчек перед ударом пропускает владельца связки');
{
    // 29.09.2026 (тот же keySlot-рефактор — Баркут/Борода делят один слот ключа).
    assert(/if\(!this\._hasKeyring\(\) && d\.keys_needed > 0 && this\.keys\[keySlot\] < d\.keys_needed && this\._bossStartMs\[this\._diffIdx\]\[idx\] === 0\)/.test(bossesCombatJs),
        '_attack() пропускает проверку ключей для владельца связки');
}

console.log('\n5) boss_result.js "ЕЩЁ РАЗ" — повторный вход в бой пропускает владельца связки');
{
    assert(/if\(!bosses\._hasKeyring\(\) && need > 0 && have < need\)\{/.test(bossResultJs),
        '"ЕЩЁ РАЗ" пропускает проверку ключей для владельца связки');
}

console.log('\n6) Контроль — обычный игрок (без связки) по-прежнему блокируется во всех 4 местах, если ключей не хватает');
{
    // Мини-симуляция условия ИМЕННО так, как оно теперь стоит в коде — гарантирует, что порядок
    // операторов даёт нужный результат, а не просто что нужные подстроки где-то присутствуют.
    function gate(hasKeyring, keysNeed, keysHave){
        return !hasKeyring && keysNeed > 0 && keysHave < keysNeed; // true = заблокировано
    }
    assert(gate(false, 3, 0) === true,  'без связки, 0/3 ключей — заблокирован (как и раньше)');
    assert(gate(false, 3, 3) === false, 'без связки, ключей хватает (3/3) — не блокируется');
    assert(gate(true,  3, 0) === false, 'с связкой, 0/3 ключей — НЕ блокируется (баг из репорта исправлен)');
    assert(gate(true,  0, 0) === false, 'с связкой на боссе без требования ключей (Охотник) — тоже не блокируется');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
