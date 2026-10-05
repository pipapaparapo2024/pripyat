/**
 * Test: 04.10.2026, по прямому указанию (репорт — "пытался ударить босса мачете, попап ошибки
 * что оружие не куплено, хотя оно у меня есть").
 *
 * Корень: ryukzak.php.open() начислял ammo_machete/ammo_gun/ammo_auto НАПРЯМУЮ через
 * Gameops::add() — это только легаси-зеркало, которое НЕ трогает weapons[id].owned в
 * авторитетном JSON-блобе (в отличие от poker.php/habar.php, которые для этого правильно зовут
 * _grantWeaponReward()). bosses.php.attack() проверяет именно weapons[weaponId]['owned'] — у
 * игрока, чьи ПЕРВЫЕ патроны мачете/ствола/автомата пришли через рюкзак, owned оставался false
 * навсегда, сервер отвечал кодом 89 ("Оружие не куплено") на каждый удар.
 *
 * Клиент (weapons.js._loadFromUdata()) при этом подставляет owned=true ЛОКАЛЬНО по фолбэку
 * "ammo>0 → owned" (см. тот же файл) — отсюда расхождение "в интерфейсе есть, сервер говорит
 * нет": это был настоящий разрыв между клиентским отображением и авторитетным состоянием БД,
 * а не визуальный баг.
 *
 * Фикс: ryukzak.php теперь использует тот же _grantWeaponReward(), что и poker.php/habar.php —
 * ставит owned=true и пишет qty в сам weapons-блоб, не только в легаси-поле. 'weapons' добавлен
 * в patch, клиент (ryukzak.js) подтягивает его через weapons._loadFromUdata() — тот же приём,
 * что уже используют dvor-poker-game.js/habar.js после выдачи оружия.
 *
 * Плюс миграция 47 чинит уже пострадавшие аккаунты (ammo_* > 0, но weapons[id].owned всё ещё
 * false) — без неё игроки, задетые до фикса, остались бы в сломанном состоянии навсегда.
 *
 * Run: node tests/ryukzak-weapon-grant-owned-sync-fix.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf-8');

const ryukzakPhp = read('server', 'core', 'controllers', 'ryukzak.php');
const ryukzakJs  = read('_client', 'src', 'game', 'shell', 'overlays', 'ryukzak.js');
const pokerPhp   = read('server', 'core', 'controllers', 'poker.php');
const migration  = read('server', 'migrate47.php');

console.log('\nTest 1: ryukzak.php._grantWeaponReward() портирован 1-в-1 из poker.php');
{
    const extract = (src) => {
        const start = src.indexOf('private function _grantWeaponReward(&$user, $type, $amount){');
        const end   = src.indexOf('\n        }', start);
        return src.slice(start, end);
    };
    const pokerFn   = extract(pokerPhp);
    const ryukzakFn = extract(ryukzakPhp);
    assert(pokerFn.length > 100, '_grantWeaponReward найден в poker.php (эталон)');
    assert(pokerFn === ryukzakFn, 'тело функции в ryukzak.php побайтово совпадает с эталоном из poker.php');
}

console.log('\nTest 2: open() больше не начисляет ammo_* напрямую — только через _grantWeaponReward()');
{
    const start = ryukzakPhp.indexOf('function open(){');
    const end   = ryukzakPhp.indexOf('\n        }', ryukzakPhp.lastIndexOf('$this->ops->ok(['));
    const body  = ryukzakPhp.slice(start, end);
    assert(!/ops->add\(\$user, 'ammo_machete'/.test(body), 'прямой add(ammo_machete) убран');
    assert(!/ops->add\(\$user, 'ammo_gun'/.test(body), 'прямой add(ammo_gun) убран');
    assert(!/ops->add\(\$user, 'ammo_auto'/.test(body), 'прямой add(ammo_auto) убран');
    // 04.10.2026 (стале-пин, не регрессия — см. аудит гонок состояний): вызовы теперь идут на
    // $tempUser (временная копия с АКТУАЛЬНЫМ под локом weapons), не на $user напрямую — тот
    // же приём, что защищает weapons от гонки с weapons.php.buy()/upgrade()/bosses.php.attack()
    // (см. tests/race-conditions-skills-weapons-ryukzak-casino-04-10.test.js). Сам факт вызова
    // _grantWeaponReward() для каждого типа оружия не менялся.
    assert(/this->_grantWeaponReward\(\$tempUser, 'machete', \$mach\);/.test(body), 'мачете начисляется через _grantWeaponReward()');
    assert(/this->_grantWeaponReward\(\$tempUser, 'gun', \$pist\);/.test(body), 'ствол начисляется через _grantWeaponReward()');
    assert(/this->_grantWeaponReward\(\$tempUser, 'auto', \$ak\);/.test(body), 'автомат начисляется через _grantWeaponReward()');
}

console.log('\nTest 3: patch клиенту содержит weapons');
{
    assert(/patchCurrencies\(\$user, \[\s*\n\s*'stew', 'stew_spent', 'cigarettes', 'coins', 'exp', 'bosses_data',\s*\n\s*'ammo_machete', 'ammo_gun', 'ammo_auto', 'ryukzak_points', 'weapons',/.test(ryukzakPhp),
        "'weapons' добавлен в patchCurrencies()");
}

console.log('\nTest 4: клиент подтягивает weapons.data из свежего patch (как poker.js/habar.js)');
{
    const start = ryukzakJs.indexOf("console.log('[ryukzak._openRyukzakReward] ← ответ сервера:'");
    const end   = ryukzakJs.indexOf('const r = res.reward;', start);
    const body  = ryukzakJs.slice(start, end);
    assert(/applyPatch\(res\.patch\);/.test(body), 'applyPatch вызывается');
    assert(/if\(res\.patch\.weapons !== undefined && window\.weapons\) weapons\._loadFromUdata\(\);/.test(body),
        'weapons._loadFromUdata() вызывается после applyPatch, когда patch содержит weapons');
}

console.log('\nTest 5: миграция 47 чинит уже пострадавшие аккаунты, идемпотентна и CLI-only');
{
    assert(migration.includes("PHP_SAPI !== 'cli'"), 'защищена от публичного HTTP-вызова (CLI-only, как migrate46)');
    assert(/CAST\(ammo_machete AS UNSIGNED\) > 0 OR CAST\(ammo_gun AS UNSIGNED\) > 0 OR CAST\(ammo_auto AS UNSIGNED\) > 0/.test(migration),
        'выбирает только игроков с реально ненулевым легаси-боезапасом');
    assert(/if\(empty\(\$data\[\$wid\]\['owned'\]\)\)\{/.test(migration), 'чинит owned только там, где он реально false (идемпотентно)');
    assert(/if\(!\$changed\) continue;/.test(migration), 'не трогает/не пишет строку, если чинить нечего');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
