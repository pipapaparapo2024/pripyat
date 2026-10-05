/**
 * Test: 18.09.2026 — SERVER-AUTHORITATIVE ОРУЖИЕ (перенос экономики, шаг после Двора/Зоны/
 * Боссов). Раньше weapons.js._buy()/_upgrade() сами проверяли цену и списывали рубли/тушёнку
 * прямо в браузере — читер мог вызвать weapons._buy(5, 100) или weapons._upgrade(0) из
 * консоли БЕЗ единого рубля (или заранее подменить udata['coins']) и получить оружие/
 * максимальную прокачку бесплатно. Теперь обе операции идут через сервер:
 * weapons.buy(weapon_id, mult) / weapons.upgrade(weapon_id) — сервер сам проверяет цену по
 * каталогу server/json/weapons_config.json и решает, хватает ли рублей/тушёнки.
 *
 * Run: node tests/weapons-server-authoritative.test.js
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

const weaponsSrc   = readSrc('_client/src/game/weapons.js');
const weaponsPhp   = readSrc('server/core/controllers/weapons.php');
const registrySrc  = readSrc('server/core/models/registry.php');
const usersPhp     = readSrc('server/core/controllers/users.php');
const catalogJson  = JSON.parse(readSrc('server/json/weapons_config.json'));

console.log('\nTest 1: сервер — контроллер Weapons зарегистрирован и реализует buy()/upgrade()');
{
    assert(/'classes'\s*=>\s*array\([^)]*'weapons'/.test(registrySrc.replace(/\n/g, '')),
        "'weapons' добавлен в registry.php classes (иначе universal.php отклонит метод как невалидный класс)");
    assert(/permits\s*=\s*\['buy', 'upgrade'\]/.test(weaponsPhp), 'Weapons.permits — buy и upgrade, больше ничего');
    assert(/function buy\(\)/.test(weaponsPhp), 'метод buy() существует');
    assert(/function upgrade\(\)/.test(weaponsPhp), 'метод upgrade() существует');
    assert(/'weapons'/.test(usersPhp), "'weapons' в whitelist users.php (иначе users.save тихо отбросит поле)");
}

console.log('\nTest 2: каталог weapons_config.json совпадает построчно с исходными данными weapons.js');
{
    // Исходные значения из _uc в weapons.js — сверяем 1-в-1, чтобы сервер не мог "тихо"
    // разойтись с тем, что видит игрок в магазине.
    const clientUc = [10,20,10,10,10,10,10,10,10,50,30,-5,80,-7,100,60,70,10,10,100];
    assert(JSON.stringify(catalogJson.upg_cost) === JSON.stringify(clientUc),
        'upg_cost — все 20 тиров совпадают 1-в-1 с клиентским массивом _uc');
    assert(catalogJson.max_upg === 20, 'max_upg === 20 (клиент: max_upg:20 у каждого оружия)');

    const expectedCosts = [0, 500, 1500, 4, 5, 18];
    const expectedDonate = [false, false, false, true, true, true];
    let allMatch = true;
    for(let i = 0; i < 6; i++){
        const w = catalogJson.weapons[i];
        if(w.id !== i || w.cost !== expectedCosts[i] || w.donate !== expectedDonate[i]) allMatch = false;
    }
    assert(allMatch, 'все 6 оружий (id/cost/donate) совпадают с клиентскими this.data[] (нож/цепь/бита/мачете/ствол/автомат)');
}

console.log('\nTest 3: weapons.php.buy() — валидация, только донатное оружие, проверка цены, экипировка первого купленного');
{
    const start = weaponsPhp.indexOf('function buy(){');
    const end   = weaponsPhp.indexOf('\n        }', weaponsPhp.indexOf('$this->ops->ok', start));
    const body  = weaponsPhp.slice(start, end);

    assert(/if\(\$wid < 0 \|\| \$wid > 5\) return \$this->ops->fail\(73\);/.test(body), 'отклоняет id вне диапазона 0-5');
    assert(/if\(!in_array\(\$mult, \[1, 10, 100\], true\)\) return \$this->ops->fail\(73\);/.test(body),
        'принимает только легитимные множители 1/10/100 (те же, что даёт бирка на клиенте)');
    assert(/if\(!\$cfg\['donate'\]\) return \$this->ops->fail\(73\);/.test(body),
        'бесплатное оружие (нож/цепь/бита) нельзя "купить" за рубли через этот метод');
    assert(/if\(!\$this->ops->deduct\(\$user, 'coins', \$totalCost\)\) return \$this->ops->fail\(74\);/.test(body),
        'Gameops::deduct сам проверяет достаточно ли рублей — атомарно, без отдельного if-сравнения до');
    assert(/if\(!\$hasEquipped\) \$weapons\[\$wid\]\['equipped'\] = true;/.test(body),
        'если у игрока вообще ничего не экипировано — купленное оружие экипируется автоматически (как на клиенте)');
    assert(/\$this->ops->add\(\$user, 'coins_spent', \$totalCost\);/.test(body),
        'coins_spent ведётся вручную для покупки (Gameops::deduct не трекает его для coins, только для stew)');
}

console.log('\nTest 4: weapons.php.upgrade() — прокачка любого оружия, коины ИЛИ тушёнка по знаку, лимит 20 уровней');
{
    const start = weaponsPhp.indexOf('function upgrade(){');
    const end   = weaponsPhp.indexOf('\n        }', weaponsPhp.indexOf('$this->ops->ok', start));
    const body  = weaponsPhp.slice(start, end);

    // 04.10.2026 (стале-пин, не регрессия — см. аудит гонок состояний): обе проверки стали
    // многострочными блоками (добавлен rollback/close лока строки weapons перед return) —
    // сами инварианты (maxUpg, списание через deduct) не менялись.
    assert(/if\(\$curUpg >= \$maxUpg\)\{/.test(body),
        'отклоняет апгрейд сверх max_upg (клиент такой проверки не делал вообще — баг, из-за которого apg_cost[20] давал NaN)');
    assert(/return \$this->ops->fail\(75\); \/\/ уже максимальный уровень прокачки/.test(body), 'код отказа 75 сохранён');
    assert(/\$useStew = \$rawCost < 0;/.test(body), 'отрицательное значение в upg_cost — это тушёнка (тот же знак, что на клиенте)');
    assert(/\$cost\s*=\s*abs\(\$rawCost\);/.test(body), 'берётся модуль (реальная стоимость всегда положительна)');
    assert(/if\(!\$this->ops->deduct\(\$user, \$resKey, \$cost\)\)\{/.test(body),
        'списание через Gameops::deduct — работает и для coins, и для stew без дублирования логики');
    assert(/return \$this->ops->fail\(74\); \/\/ недостаточно рублей\/тушёнки/.test(body), 'код отказа 74 сохранён');
}

console.log('\nTest 5: клиент weapons.js — _buy()/_upgrade() зовут сервер, не считают сами');
{
    assert(weaponsSrc.includes("import { applyPatch } from '../modules/patch.js';"), 'импортирует applyPatch');

    const buyStart = weaponsSrc.indexOf('_buy(idx){');
    const buyEnd   = weaponsSrc.indexOf('\n\t}', weaponsSrc.indexOf("TS.php('weapons.buy'", buyStart));
    const buyBody  = weaponsSrc.slice(buyStart, buyEnd);
    assert(/TS\.php\('weapons\.buy', \{weapon_id: idx, mult: mult\}/.test(buyBody), '_buy() шлёт weapon_id+mult на сервер');
    assert(!/udata\['coins'\]\s*=\s*parseInt\(udata\['coins'\]/.test(buyBody), '_buy() САМ больше не вычитает рубли из udata (это делает сервер)');
    assert(/applyPatch\(res\.patch\)/.test(buyBody), 'применяет патч сервера');
    assert(/this\._loadFromUdata\(\)/.test(buyBody), 'перечитывает this.data из обновлённого udata после патча');

    const upgStart = weaponsSrc.indexOf('_upgrade(idx){');
    const upgEnd   = weaponsSrc.indexOf('\n\t}', weaponsSrc.indexOf("TS.php('weapons.upgrade'", upgStart));
    const upgBody  = weaponsSrc.slice(upgStart, upgEnd);
    assert(/TS\.php\('weapons\.upgrade', \{weapon_id: idx\}/.test(upgBody), '_upgrade() шлёт weapon_id на сервер');
    assert(!/wp\.upg\+\+;/.test(upgBody), '_upgrade() САМ больше не инкрементирует wp.upg локально (это делает сервер, применяется через applyPatch+_loadFromUdata)');
    assert(/err && err\.code === 75/.test(upgBody), 'отдельно обрабатывает код 75 (уже максимальный уровень) — понятное сообщение игроку');
}

console.log('\nTest 6: защита от даблклика (once-in-flight) на обоих запросах — не даёт задвоить покупку/апгрейд быстрым кликом');
{
    assert(/this\._weaponReqInFlight/.test(weaponsSrc), 'используется общий флаг _weaponReqInFlight');
    const occurrences = (weaponsSrc.match(/this\._weaponReqInFlight = true;/g) || []).length;
    assert(occurrences === 2, 'флаг выставляется в true в обоих местах (buy и upgrade) — найдено ' + occurrences);
}

console.log('\nTest 7: неверный попап "ТОРМОЗИ, ОРУЖИЯ НЕТУ" при нехватке денег на покупку остался исправленным');
{
    assert(/iface\._openSidorovichError\('Недостаточно рублей!'/.test(weaponsSrc),
        'при отказе сервера (код 74) показывается нормальная ошибка нехватки средств, не старый попап');
    assert(!weaponsSrc.includes('_buildErrorWin'), '_buildErrorWin (старый неправильный попап) по-прежнему не существует');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
