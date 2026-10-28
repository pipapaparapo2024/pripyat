/**
 * Test: 28.10.2026, по прямому указанию (репорт после живого теста на проде — "цены за хабар
 * теперь 150/250/700/1200 [было 100/200/300/500], но клиент до сих пор думает, что цена
 * старая") — три независимых источника цены хабара должны совпадать:
 *   1) server/json/habar_containers.json — РЕАЛЬНАЯ цена списания (habar.php.buy() читает
 *      именно отсюда через Gameops::catalog('habar_containers')).
 *   2) server/json/habar_daily_config.json — зеркало того же списка (используется только как
 *      fallback-каталог наград, но цена там тоже хранится и должна оставаться синхронной).
 *   3) _client/src/game/habar.js:this.containers[] — клиентская копия, используется ТОЛЬКО для
 *      UX-проверки ДО отправки запроса ("Нужно N тушенки!") — сервер остаётся единственным
 *      источником истины при самой покупке, рассинхрон не даёт обойти экономику, но путает
 *      игрока (клиент может показать "хватает", когда сервер откажет, или наоборот).
 *
 * Без этого теста рассинхрон уже случался один раз вживую (26-28.10.2026: обновили
 * habar_containers.json на 150/250/700/1200, забыли обновить клиентский this.containers[]
 * в том же заходе) — тест ловит именно такой класс регрессии на будущее.
 *
 * Run: node tests/habar-price-consistency-client-server.test.js
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

const habarSrc   = readSrc('_client/src/game/habar.js');
const serverCfg  = JSON.parse(readSrc('server/json/habar_containers.json'));
const dailyCfg   = JSON.parse(readSrc('server/json/habar_daily_config.json'));

console.log('\nTest 1: три источника цены хабара совпадают по всем 4 тирам (150/250/700/1200)');
{
    const EXPECTED = { 0: 150, 1: 250, 2: 700, 3: 1200 };

    for (const id of Object.keys(EXPECTED)) {
        const want = EXPECTED[id];

        const serverTier = serverCfg.find(c => c.id === Number(id));
        assert(!!serverTier, `habar_containers.json: тир id${id} найден`);
        if (serverTier) {
            assert(serverTier.price.amount === want,
                `habar_containers.json (реальное списание): id${id} цена ${want}, получено ${serverTier.price.amount}`);
        }

        const dailyTier = dailyCfg.containers.find(c => c.id === Number(id));
        assert(!!dailyTier, `habar_daily_config.json: тир id${id} найден`);
        if (dailyTier) {
            assert(dailyTier.price.amount === want,
                `habar_daily_config.json (fallback-зеркало): id${id} цена ${want}, получено ${dailyTier.price.amount}`);
        }

        // Клиентский this.containers[] — ищем конкретную запись "id:N, ... price:NNN" построчно,
        // не полагаясь на порядок объявления полей (name/price могут идти в любом порядке).
        const re = new RegExp(`id:${id},[^}]*?price:(\\d+)`);
        const m = habarSrc.match(re);
        assert(!!m, `habar.js: запись id${id} найдена в this.containers[]`);
        if (m) {
            assert(Number(m[1]) === want,
                `habar.js (клиентская UX-проверка): id${id} цена ${want}, получено ${m[1]}`);
        }
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
