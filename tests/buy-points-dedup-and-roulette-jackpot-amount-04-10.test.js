/**
 * Test: 04.10.2026, аудит проекта нашёл два связанных, но разных по природе момента в рулетке/
 * зариках:
 *
 *   1. Дубль таблицы донат-пакетов поинтов (10/25/55/115/250/550 → 100/250/550/1150/2500/5500)
 *      был прописан ЧЕТЫРЕЖДЫ: dvor-roulette-buy.js (ROUL_PKGS), dvor-dice-screen.js (PKGS),
 *      roulette.php ($BUY_POINTS_TABLE, свой хардкод), dice_config.json (buy_points). Правка
 *      цены требовала синхронно редактировать 4 места — несогласованность не ловил НИ ОДИН
 *      существующий тест. Фикс: клиент — общий _client/src/data/buy_points_packages.json,
 *      импортируемый в оба файла; сервер — roulette.php читает dice_config.json.buy_points
 *      вместо своей копии (обе игры используют один и тот же прайс по ТЗ).
 *
 *   2. Хардкод jackpotAmount=500 в dvor-roulette-minigame.js — использовался ТОЛЬКО для текста
 *      попапа награды (реальное начисление рублей уже шло через applyPatch(res.patch),
 *      сервер-авторитетно). roulette.php.claimPrize() УЖЕ возвращал 'amount'=>500 в ответе —
 *      клиент его игнорировал. Если сумму приза когда-нибудь поменяют только на сервере,
 *      текст попапа молча разойдётся с реально начисленной суммой. Фикс: клиент берёт сумму
 *      из res.amount, локальная константа остаётся только как фолбэк на случай отсутствия поля.
 *
 * Run: node tests/buy-points-dedup-and-roulette-jackpot-amount-04-10.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(relPath) { return fs.readFileSync(path.join(root, relPath), 'utf-8'); }

const EXPECTED_PACKAGES = [
    { pts: 10,  price: 100,  img: 'рулетка 100.png' },
    { pts: 25,  price: 250,  img: 'рулетка 250.png' },
    { pts: 55,  price: 550,  img: 'рулетка 550.png' },
    { pts: 115, price: 1150, img: 'рулетка 1150.png' },
    { pts: 250, price: 2500, img: 'рулетка 2500.png' },
    { pts: 550, price: 5500, img: 'рулетка 5500.png' },
];

console.log('\nTest 1: единый JSON-источник buy_points_packages.json содержит ровно таблицу по ТЗ');
{
    const jsonPath = path.join(root, '_client/src/data/buy_points_packages.json');
    assert(fs.existsSync(jsonPath), 'файл существует');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    assert(Array.isArray(data) && data.length === 6, 'ровно 6 пакетов');
    assert(JSON.stringify(data) === JSON.stringify(EXPECTED_PACKAGES), 'данные совпадают с ожидаемой таблицей (10..550 поинтов, 100..5500 цена)');
}

console.log('\nTest 2: dvor-roulette-buy.js больше не хранит собственную копию таблицы — импортирует общий JSON');
{
    const src = read('_client/src/game/dvor/dvor-roulette-buy.js');
    assert(/import buyPointsPackages from ['"]\.\.\/\.\.\/data\/buy_points_packages\.json['"]/.test(src), 'импортирует buy_points_packages.json');
    assert(/const ROUL_PKGS = buyPointsPackages;/.test(src), 'ROUL_PKGS = импортированные данные, не литерал');
    assert(!/const ROUL_PKGS = \[/.test(src), 'нет больше собственного литерала-массива ROUL_PKGS');
}

console.log('\nTest 3: dvor-dice-screen.js больше не хранит собственную копию таблицы — импортирует ТОТ ЖЕ общий JSON');
{
    const src = read('_client/src/game/dvor/dvor-dice-screen.js');
    assert(/import buyPointsPackages from ['"]\.\.\/\.\.\/data\/buy_points_packages\.json['"]/.test(src), 'импортирует buy_points_packages.json (тот же файл, что roulette-buy)');
    assert(/const PKGS = buyPointsPackages;/.test(src), 'PKGS = импортированные данные, не литерал');
    assert(!/const PKGS = \[/.test(src), 'нет больше собственного литерала-массива PKGS');
}

console.log('\nTest 4: roulette.php больше не хранит собственный хардкод таблицы — читает dice_config.json.buy_points');
{
    const src = read('server/core/controllers/roulette.php');
    assert(!/private \$BUY_POINTS_TABLE = \[/.test(src), 'приватного массива $BUY_POINTS_TABLE больше нет');
    assert(/function _buyPointsTable\(\)\{/.test(src), '_buyPointsTable() определён');
    assert(/return \$this->ops->catalog\('dice_config'\)\['buy_points'\];/.test(src), 'читает ИМЕННО dice_config.json.buy_points — единый источник с зариками');
    const buyPointsBody = src.slice(src.indexOf('function buyPoints(){'));
    assert(/\$table = \$this->_buyPointsTable\(\);/.test(buyPointsBody), 'buyPoints() использует _buyPointsTable()');
}

console.log('\nTest 5: dice_config.json.buy_points остался НЕТРОНУТЫМ (единственный источник правды теперь и для рулетки)');
{
    const diceConfig = JSON.parse(fs.readFileSync(path.join(root, 'server/json/dice_config.json'), 'utf-8'));
    assert(Array.isArray(diceConfig.buy_points) && diceConfig.buy_points.length === 6, 'buy_points — массив из 6 пакетов');
    assert(JSON.stringify(diceConfig.buy_points) === JSON.stringify(EXPECTED_PACKAGES.map(p => ({ pts: p.pts, price: p.price }))),
        'данные dice_config.json.buy_points совпадают с клиентской таблицей (без поля img — серверу оно не нужно)');
}

console.log('\nTest 6: dvor-roulette-minigame.js теперь берёт сумму приза из ответа сервера (res.amount), не из локальной константы');
{
    const src = read('_client/src/game/dvor/dvor-roulette-minigame.js');
    assert(/const jackpotAmount = 500;/.test(src), 'локальная константа осталась как фолбэк');
    assert(/const amount = \(res && typeof res\.amount !== ['"]undefined['"]\) \? res\.amount : jackpotAmount;/.test(src),
        'сумма вычисляется из res.amount с фолбэком на jackpotAmount, если поле отсутствует');
    const handlerBody = src.slice(src.indexOf("TS.php('roulette.claimPrize'"), src.indexOf("}, ()=>{ if(this._roulResultTxt) this._roulResultTxt.text = 'Не удалось забрать приз';"));
    assert(/iface\._showRewardPopup\(\[\{type:'coins', amount\}\]\)/.test(handlerBody), 'попап награды использует вычисленный amount, не jackpotAmount напрямую');
    assert(/this\._roulResultTxt\.text = 'Приз: \+' \+ amount\.toLocaleString/.test(handlerBody), 'текстовый фолбэк тоже использует вычисленный amount');
}

console.log('\nTest 7: roulette.php.claimPrize() реально возвращает поле amount (источник для клиента из Test 6)');
{
    const src = read('server/core/controllers/roulette.php');
    const body = src.slice(src.indexOf('function claimPrize(){'), src.indexOf('function claimPrize(){') + 1500);
    assert(/'amount'\s*=>\s*500/.test(body), "claimPrize() включает 'amount'=>500 в ответ ok()");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
