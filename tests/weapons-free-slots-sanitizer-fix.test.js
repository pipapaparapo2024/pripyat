/**
 * Test: 28.09.2026 — репорт по логам сервера (php_errors.log, 08:43-08:45 UTC,
 * uid=470613218): десятки подряд users.save с полем weapons, КАЖДЫЙ отклонён
 * "[users.save] отклонено поле weapons — попытка эскалации owned/upg/qty через users.save".
 *
 * Корень — НЕ читерство и НЕ баг ретрая на клиенте (player-save.js ретраит только сетевые
 * ошибки, максимум 5 раз с интервалом 2с — не десятки раз подряд). Настоящая причина —
 * рассинхронизация инварианта "бесплатное оружие (слоты 0-2: нож/цепь/бита) всегда owned:true":
 *
 * - Клиент (weapons.js._loadFromUdata()) принудительно ставит data[0..2].owned=true ВСЕГДА,
 *   в памяти, независимо от того, что реально лежит в БД.
 * - Сервер (weapons.php._loadWeapons()) делает ТО ЖЕ САМОЕ — но только внутри buy()/upgrade(),
 *   и только ЭТИ два метода имеют право записать owned:true в БД (users.php._sanitizeWeapons()
 *   их и охраняет от подделки).
 * - Если игрок НИ РАЗУ не вызвал weapons.buy/upgrade (например, играет только бесплатным
 *   оружием, переключает экипировку или расходует патроны в бою — weapons.consumeQty()
 *   тоже пишет ВЕСЬ массив weapons через generic _saveToUdata()) — в БД поле weapons
 *   так и остаётся дефолтным '[]', то есть owned:false для слотов 0-2.
 * - Каждый следующий users.save при этом посылает owned:true для слотов 0-2 (клиент не умеет
 *   иначе), а _sanitizeWeapons() сравнивает это с БД, где owned:false — видит "эскалацию"
 *   и отклоняет ВЕСЬ блоб weapons целиком, НАВСЕГДА, на КАЖДОЙ попытке сохранения, пока игрок
 *   не купит/не прокачает хоть что-нибудь через weapons.buy/upgrade.
 *
 * Фикс: _sanitizeWeapons() теперь считает слоты 0-2 owned=true безусловно при сравнении
 * (тот же инвариант, что уже применён в weapons.php._loadWeapons() и weapons.js.
 * _loadFromUdata()) — свободное переключение/расход патронов бесплатным оружием больше не
 * ловится анти-чит guard'ом как подделка. Эскалация owned/upg/qty для ДОНАТНОГО оружия
 * (слоты 3-5) по-прежнему отклоняется без изменений.
 *
 * Run: node tests/weapons-free-slots-sanitizer-fix.test.js
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

const usersPhp   = readSrc('server/core/controllers/users.php');
const weaponsPhp = readSrc('server/core/controllers/weapons.php');
const weaponsJs  = readSrc('_client/src/game/weapons.js');

function extractSanitizeWeaponsBody(src){
    const start = src.indexOf('function _sanitizeWeapons(');
    const end   = src.indexOf('\n        }', src.indexOf('return $incoming;', start));
    return src.slice(start, end);
}

console.log('\nTest 1: _sanitizeWeapons() форсирует curOwned=true для слотов 0-2 ДО проверки эскалации');
{
    const body = extractSanitizeWeaponsBody(usersPhp);
    const ownedIdx    = body.indexOf('$curOwned = !empty($cur[\'owned\']);');
    const forceIdx    = body.indexOf('if($i < 3) $curOwned = true;');
    const escalateIdx = body.indexOf('if(($newOwned && !$curOwned)');

    assert(ownedIdx !== -1, '$curOwned вычисляется из $cur[\'owned\'] как раньше');
    assert(forceIdx !== -1, 'НОВОЕ: добавлена принудительная строка "if($i < 3) $curOwned = true;"');
    assert(ownedIdx !== -1 && forceIdx !== -1 && forceIdx > ownedIdx,
        'форс идёт ПОСЛЕ вычисления из $cur (переопределяет его), а не до');
    assert(forceIdx !== -1 && escalateIdx !== -1 && forceIdx < escalateIdx,
        'форс идёт ДО проверки эскалации — иначе не успеет повлиять на решение return null');
}

console.log('\nTest 2: слоты 3-5 (донатное оружие) по-прежнему защищены — форс применяется ТОЛЬКО к i<3');
{
    const body = extractSanitizeWeaponsBody(usersPhp);
    assert(/if\(\$i < 3\) \$curOwned = true;/.test(body), 'условие ограничено i<3, не применяется ко всем слотам');
    assert(/if\(\(\$newOwned && !\$curOwned\) \|\| \$newUpg > \$curUpg \|\| \$newQty > \$curQty\) return null;/.test(body),
        'сама проверка эскалации (owned/upg/qty) не тронута — донатное оружие (слоты 3-5) по-прежнему требует weapons.buy/upgrade');
}

console.log('\nTest 3: инвариант "слоты 0-2 всегда owned=true" совпадает с weapons.php._loadWeapons() и weapons.js._loadFromUdata() — фикс не изобретает новое правило, а синхронизирует уже существующее');
{
    assert(/for\(\$i = 0; \$i < 3; \$i\+\+\) \$data\[\$i\]\['owned'\] = true;/.test(weaponsPhp),
        'sanity: weapons.php._loadWeapons() форсирует owned=true для слотов 0-2 (эталон инварианта)');
    assert(/this\.data\[0\]\.owned = true;/.test(weaponsJs) && /this\.data\[1\]\.owned = true;/.test(weaponsJs) && /this\.data\[2\]\.owned = true;/.test(weaponsJs),
        'sanity: weapons.js._loadFromUdata() форсирует owned=true для слотов 0-2 на клиенте (тот же инвариант)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
