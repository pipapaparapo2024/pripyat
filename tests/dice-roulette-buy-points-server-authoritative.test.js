/**
 * Test: 26.09.2026 — аудит по прямому указанию ("два похожих места клиента продают игровые
 * поинты за рубли и НАПРЯМУЮ используют общий users.save (whitelist) для сохранения — без
 * единой серверной проверки цены"):
 *
 * 1) dvor-dice-screen.js.buyDicePoints(pkg) — пакеты PKGS (10/25/55/115/250/550 за
 *    100/250/550/1150/2500/5500), списывает coins, начисляет dice_points.
 * 2) dvor-roulette-buy.js.buyBluePoints(pkg) — ТЕ ЖЕ пакеты, списывает coins, начисляет
 *    blue_points.
 *
 * Обе функции уже писали coins/dice_points|blue_points оптимистично на клиенте (с откатом при
 * сетевой ошибке + purchasePending защитой от даблклика), но реальное сохранение шло через
 * общий whitelist-эндпоинт users.save — сервер верил присланным числам целиком (в пределах
 * общего потолка 100 млн), читер мог накрутить себе любое количество поинтов без реальной
 * траты рублей, просто отредактировав udata перед вызовом.
 *
 * Закрыто: dice.php.buyPoints() (таблица цены — server/json/dice_config.json → buy_points[])
 * и roulette.php.buyPoints() (таблица цены — приватный массив класса $BUY_POINTS_TABLE, у
 * рулетки нет собственного JSON-каталога — остальные её константы, CUP_POOL/SPIN_SLOTS/
 * KUSH_AMOUNT, тоже хранятся прямо в классе). Оба метода: validировать pkg_idx (0-5, fail(54)
 * вне диапазона), взять цену/поинты из таблицы, ops->deduct(coins) (fail(50) при нехватке),
 * ops->add(dice_points|blue_points), saveUser(), вернуть patch через patchCurrencies(). Клиент
 * больше не зовёт users.save для этой покупки — только dice.buyPoints/roulette.buyPoints с
 * pkg_idx, применяет ответ через applyPatch().
 *
 * Run: node tests/dice-roulette-buy-points-server-authoritative.test.js
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

const dicePhp        = readSrc('server/core/controllers/dice.php');
const roulettePhp     = readSrc('server/core/controllers/roulette.php');
const diceConfigJson  = JSON.parse(readSrc('server/json/dice_config.json'));
const diceScreenJs    = readSrc('_client/src/game/dvor/dvor-dice-screen.js');
const rouletteBuyJs   = readSrc('_client/src/game/dvor/dvor-roulette-buy.js');

console.log('\nTest 1: dice_config.json содержит buy_points[] — 6 пакетов, те же цифры, что клиентский PKGS');
{
    assert(Array.isArray(diceConfigJson.buy_points), 'ключ buy_points существует и это массив');
    assert(diceConfigJson.buy_points.length === 6, 'ровно 6 пакетов');
    const expected = [[10,100],[25,250],[55,550],[115,1150],[250,2500],[550,5500]];
    expected.forEach(([pts, price], i) => {
        const row = diceConfigJson.buy_points[i];
        assert(row && row.pts === pts && row.price === price, `пакет idx=${i} — pts=${pts}, price=${price}`);
    });
}

console.log('\nTest 2: dice.php — buyPoints() существует, валидирует pkg_idx, списывает coins/начисляет dice_points, патчит currencies');
{
    assert(/'permits'\s*=\s*\[.*\]|\$this->permits\s*=\s*\['start', 'reroll', 'resolve', 'getSession', 'buyPoints'\];/.test(dicePhp),
        "'buyPoints' добавлен в \$this->permits");
    assert(/function buyPoints\(\)\{/.test(dicePhp), 'метод buyPoints() определён');

    const start = dicePhp.indexOf('function buyPoints(){');
    const end   = dicePhp.indexOf('\n        private function _catalog(){', start);
    const body  = dicePhp.slice(start, end);

    assert(/\$idx = intval\(\$this->registry\['user_params'\]\['pkg_idx'\] \?\? -1\);/.test(body), 'читает pkg_idx из user_params');
    assert(/if\(\$idx < 0 \|\| \$idx >= count\(\$table\)\) return \$this->ops->fail\(54\);/.test(body), 'вне диапазона 0..count-1 — fail(54)');
    assert(/buy_points/.test(body), 'берёт таблицу из каталога buy_points (dice_config.json — единственный источник цены)');
    assert(/if\(!\$this->ops->deduct\(\$user, 'coins', \$price\)\) return \$this->ops->fail\(50\);/.test(body), 'deduct(coins, price), недостаточно средств — fail(50)');
    assert(/\$this->ops->add\(\$user, 'dice_points', \$pts\);/.test(body), 'add(dice_points, pts) — начисление только после успешного списания');
    assert(/if\(!\$this->ops->saveUser\(\$user\)\) return \$this->ops->fail\(99\);/.test(body), 'saveUser() с проверкой результата');
    assert(/\$patch = \$this->ops->patchCurrencies\(\$user, \['coins', 'dice_points'\]\);/.test(body), 'возвращает patch по coins/dice_points');
    assert(/\$this->ops->ok\(\['patch' => \$patch/.test(body), 'ok() отдаёт patch клиенту');
}

console.log('\nTest 3: roulette.php — _buyPointsTable() (те же 6 пакетов) + buyPoints() зеркально dice.php');
{
    // 04.10.2026 (стале-пин, НЕ регрессия — см. аудит проекта, "дубль таблицы донат-цен"):
    // приватный массив $BUY_POINTS_TABLE убран — был 3-й копией одной и той же таблицы
    // (клиентские ROUL_PKGS/PKGS — 4-я и 5-я копии до дедупа). Теперь _buyPointsTable()
    // читает dice_config.json.buy_points — ЕДИНЫЙ источник для обеих игр (см.
    // tests/buy-points-dedup-and-roulette-jackpot-amount-04-10.test.js — там же проверены
    // клиентские копии и сам dice_config.json). Сам факт "одна таблица, одна цена" не менялся.
    assert(!/private \$BUY_POINTS_TABLE = \[/.test(roulettePhp), 'приватного $BUY_POINTS_TABLE больше нет (дедуп)');
    assert(/private function _buyPointsTable\(\)\{/.test(roulettePhp), '_buyPointsTable() определён');
    assert(/return \$this->ops->catalog\('dice_config'\)\['buy_points'\];/.test(roulettePhp), '_buyPointsTable() читает dice_config.json.buy_points');

    const diceConfig = JSON.parse(fs.readFileSync(path.join(root, 'server/json/dice_config.json'), 'utf-8'));
    [[10,100],[25,250],[55,550],[115,1150],[250,2500],[550,5500]].forEach(([pts, price], i) => {
        assert(diceConfig.buy_points[i].pts === pts && diceConfig.buy_points[i].price === price, `пакет pts=${pts}/price=${price} присутствует в dice_config.json`);
    });

    // 29.09.2026: 'claimKeyring' удалён из permits (был эксплойтом — вызываемым напрямую из
    // консоли без реального выигрыша сектора, см. tests/roulette-global-jackpot-kush-keyring.test.js (структура) и roulette-wheel-visual-keyring-cooldown-impossible.test.js (Monte-Carlo)).
    assert(/\$this->permits = \['status', 'spin', 'claimPrize', 'openMinigame', 'pickCup', 'openCase', 'buyPoints'\];/.test(roulettePhp),
        "'buyPoints' добавлен в \$this->permits");
    assert(/function buyPoints\(\)\{/.test(roulettePhp), 'метод buyPoints() определён');

    const start = roulettePhp.indexOf('function buyPoints(){');
    const end   = roulettePhp.indexOf('\n    // Отдельное прямое подключение к БД', start);
    const body  = roulettePhp.slice(start, end);

    assert(/\$table = \$this->_buyPointsTable\(\);/.test(body), 'buyPoints() берёт таблицу через _buyPointsTable()');
    assert(/\$idx = intval\(\$this->registry\['user_params'\]\['pkg_idx'\] \?\? -1\);/.test(body), 'читает pkg_idx из user_params');
    assert(/if\(\$idx < 0 \|\| \$idx >= count\(\$table\)\) return \$this->ops->fail\(54\);/.test(body), 'вне диапазона — fail(54)');
    assert(/if\(!\$this->ops->deduct\(\$user, 'coins', \$price\)\) return \$this->ops->fail\(50\);/.test(body), 'deduct(coins, price), недостаточно средств — fail(50)');
    assert(/\$this->ops->add\(\$user, 'blue_points', \$pts\);/.test(body), 'add(blue_points, pts)');
    assert(/if\(!\$this->ops->saveUser\(\$user\)\) return \$this->ops->fail\(99\);/.test(body), 'saveUser() с проверкой результата');
    assert(/\$patch = \$this->ops->patchCurrencies\(\$user, \['coins', 'blue_points'\]\);/.test(body), 'возвращает patch по coins/blue_points');
}

console.log('\nTest 4: dvor-dice-screen.js.buyDicePoints() больше не зовёт users.save — зовёт dice.buyPoints(pkg_idx) и применяет applyPatch()');
{
    assert(/import \{ applyPatch \} from '\.\.\/\.\.\/modules\/patch\.js';/.test(diceScreenJs), 'applyPatch импортирован');
    const start = diceScreenJs.indexOf('const buyDicePoints = (pkg)=>{');
    const end   = diceScreenJs.indexOf('\n        };', start);
    const body  = diceScreenJs.slice(start, end);

    assert(!/TS\.php\('users\.save'/.test(body), 'users.save БОЛЬШЕ НЕ вызывается внутри buyDicePoints()');
    assert(/TS\.php\('dice\.buyPoints', \{pkg_idx: pkgIdx\}/.test(body), "зовёт TS.php('dice.buyPoints', {pkg_idx: pkgIdx}, ...)");
    assert(/const pkgIdx = PKGS\.indexOf\(pkg\);/.test(body), 'индекс пакета берётся через PKGS.indexOf(pkg)');
    assert(/if\(result && result\.patch\) applyPatch\(result\.patch\);/.test(body), 'успешный колбэк применяет applyPatch(result.patch)');
    assert(/purchasePending = false;/.test(body), 'purchasePending защита от даблклика сохранена');
    assert(/iface\._openSidorovichError\('Покупка не сохранена', 'Попробуйте ещё раз'\);/.test(body), 'откат при сетевой ошибке сохранён (та же UX-обёртка)');
}

console.log('\nTest 5: dvor-roulette-buy.js.buyBluePoints() больше не зовёт users.save — зовёт roulette.buyPoints(pkg_idx) и применяет applyPatch()');
{
    assert(/import \{ applyPatch \} from '\.\.\/\.\.\/modules\/patch\.js';/.test(rouletteBuyJs), 'applyPatch импортирован (уже был — используется openCase-веткой)');
    const start = rouletteBuyJs.indexOf('const buyBluePoints = (pkg)=>{');
    const end   = rouletteBuyJs.indexOf('\n        };', start);
    const body  = rouletteBuyJs.slice(start, end);

    assert(!/TS\.php\('users\.save'/.test(body), 'users.save БОЛЬШЕ НЕ вызывается внутри buyBluePoints()');
    assert(/TS\.php\('roulette\.buyPoints', \{pkg_idx: pkgIdx\}/.test(body), "зовёт TS.php('roulette.buyPoints', {pkg_idx: pkgIdx}, ...)");
    assert(/const pkgIdx = ROUL_PKGS\.indexOf\(pkg\);/.test(body), 'индекс пакета берётся через ROUL_PKGS.indexOf(pkg)');
    assert(/if\(result && result\.patch\) applyPatch\(result\.patch\);/.test(body), 'успешный колбэк применяет applyPatch(result.patch)');
    assert(/purchasePending = false;/.test(body), 'purchasePending защита от даблклика сохранена');
    assert(/iface\._openSidorovichError\('Покупка не сохранена', 'Попробуйте ещё раз'\);/.test(body), 'откат при сетевой ошибке сохранён (та же UX-обёртка)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
