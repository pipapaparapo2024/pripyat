/**
 * Test: батч 23.09.2026 (по прямому указанию — аудит "что ещё не перенесено на сервер",
 * найдено попутно при переносе достижений) — три оставшихся дыры того же класса, что уже были
 * закрыты для стоимости входа (poker.openBag()/roulette.openCase(), 22.09.2026):
 *
 *  1) Награда покерной "сумки" (exp/сигареты/заначка/монеты) каталась на клиенте
 *     (dvor-poker-bag.js._openPokerBagOpenedScreen, this._rand()) — читер мог вызвать
 *     dvor._give('coins', 999999999) напрямую, минуя сумку вовсе.
 *  2) То же самое для "кейса" рулетки (dvor-roulette-buy.js._openRouletteCaseOpenedScreen).
 *  3) Обычный спин рулетки (не джекпот/не связка ключей) — стоимость (1 blue_point)
 *     списывалась client-side без единого запроса к серверу, а сама награда (один из 13
 *     обычных слотов) выбиралась и применялась на клиенте (dvor-roulette.js._spinRoulette →
 *     dvor-roulette-screen.js._resolveRouletteNewScreen, Math.random()).
 *
 * Решение — тот же паттерн, что уже применён для стоимости: сервер сам считает/начисляет,
 * клиент только отображает готовый результат из ответа. Диапазоны наград (1000-2000 опыта,
 * 500-1000 сигарет, 5-15 заначки, 1-5 монет) и таблица слотов рулетки перенесены 1-в-1.
 *
 * Run: node tests/roulette-case-poker-bag-server-reward.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const pokerPhpSrc    = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'poker.php'), 'utf-8');
const roulettePhpSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');
const pokerBagSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker-bag.js'), 'utf-8');
const roulBuySrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-buy.js'), 'utf-8');
const roulOrchSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette.js'), 'utf-8');
const roulScreenSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-screen.js'), 'utf-8');

console.log('\nTest 1: poker.php.openBag() катает и начисляет награду на сервере (не только списывает цену)');
{
    const m = pokerPhpSrc.match(/function openBag\(\)\{([\s\S]*?)\n        \}/);
    assert(!!m, 'openBag() найден');
    const body = m ? m[1] : '';
    assert(/mt_rand\(1000, 2000\)/.test(body), 'exp: mt_rand(1000, 2000) — тот же диапазон, что this._rand(1000,2000) на клиенте');
    assert(/mt_rand\(500, 1000\)/.test(body), 'cig: mt_rand(500, 1000)');
    assert(/mt_rand\(5, 15\)/.test(body), 'stash: mt_rand(5, 15)');
    assert(/mt_rand\(1, 5\)/.test(body), 'coins: mt_rand(1, 5)');
    assert(/\$this->ops->add\(\$user, 'stash_count', \$reward\['stash'\]\)/.test(body), 'заначка пишется в stash_count (тот же ключ, что dvor._give(\'stash\',...))');
    assert(/\$user\['coins_earned'\] = \$this->ops->i\(\$user, 'coins_earned'\) \+ \$reward\['coins'\]/.test(body),
        'coins_earned увеличивается вместе с coins (тот же побочный эффект, что был у клиентского _give(\'coins\',...))');
    // 25.09.2026 (регресс найден повторным прогоном тестов): между reward и clientRewards
    // добавился hasTatu (тату-дроп тоже переехал на сервер, см.
    // casino-bag-tatu-shmot-server-authoritative.test.js) — они больше не идут впритык друг за
    // другом в ответе; проверяем оба поля по отдельности, не как один смежный кусок текста.
    assert(/'reward' => \$reward,/.test(body) && /'clientRewards' => \$clientRewards/.test(body), 'ответ содержит reward и clientRewards (battlepass_xp)');
    assert(/battlepass_xp/.test(body), 'battlepass_xp возвращается как clientReward (battlepass ещё не мигрирован, тот же приём, что dice.php)');
}

console.log('\nTest 2: roulette.php.openCase() — тот же перенос награды, что и у покерной сумки');
{
    const m = roulettePhpSrc.match(/function openCase\(\)\{([\s\S]*?)\n    \}/);
    assert(!!m, 'openCase() найден');
    const body = m ? m[1] : '';
    assert(/mt_rand\(1000, 2000\)/.test(body), 'exp: mt_rand(1000, 2000)');
    assert(/mt_rand\(500, 1000\)/.test(body), 'cig: mt_rand(500, 1000)');
    assert(/mt_rand\(5, 15\)/.test(body), 'stash: mt_rand(5, 15)');
    assert(/mt_rand\(1, 5\)/.test(body), 'coins: mt_rand(1, 5)');
    // 25.09.2026 (регресс найден повторным прогоном тестов): между reward и clientRewards
    // добавился hasTatu (тату-дроп тоже переехал на сервер, см.
    // casino-bag-tatu-shmot-server-authoritative.test.js) — они больше не идут впритык друг за
    // другом в ответе; проверяем оба поля по отдельности, не как один смежный кусок текста.
    assert(/'reward' => \$reward,/.test(body) && /'clientRewards' => \$clientRewards/.test(body), 'ответ содержит reward и clientRewards (battlepass_xp)');
}

console.log('\nTest 3: dvor-poker-bag.js — экран результата ОТОБРАЖАЕТ серверную награду, не катает свою');
{
    assert(!/this\._rand\(1000, 2000\)/.test(pokerBagSrc), 'this._rand(1000,2000) для exp убран из клиента');
    // 25.09.2026 (регресс найден повторным прогоном тестов): следом добавился третий параметр
    // hasTatu (тату-дроп тоже переехал на сервер) — сигнатура и вызов выросли ещё на один
    // аргумент, см. casino-bag-tatu-shmot-server-authoritative.test.js.
    assert(/proto\._openPokerBagOpenedScreen = function\(reward, clientRewards, hasTatu\)\{/.test(pokerBagSrc),
        '_openPokerBagOpenedScreen принимает (reward, clientRewards, hasTatu) от сервера');
    assert(/const exp\s*=\s*reward\.exp;/.test(pokerBagSrc), 'exp берётся из reward.exp, не катается заново');
    assert(/this\._openPokerBagOpenedScreen\(res\.reward, res\.clientRewards \|\| \[\], !!res\.hasTatu\);/.test(pokerBagSrc),
        'вызывающий код передаёт res.reward/res.clientRewards из ответа poker.openBag');
    assert(!/this\._give\('exp',\s*exp\);/.test(pokerBagSrc), 'кнопка "Забрать" больше не вызывает _give для exp (уже начислено сервером — иначе задвоение)');
    assert(!/this\._give\('coins',\s*coins\);/.test(pokerBagSrc), 'кнопка "Забрать" больше не вызывает _give для coins (иначе задвоение)');
    assert(/cr\.type === 'battlepass_xp'/.test(pokerBagSrc), 'battlepass_xp из clientRewards применяется по нажатию "Забрать"');
}

console.log('\nTest 4: dvor-roulette-buy.js — тот же паттерн для экрана кейса');
{
    assert(!/this\._rand\(1000, 2000\)/.test(roulBuySrc), 'this._rand(1000,2000) для exp убран из клиента');
    assert(/proto\._openRouletteCaseOpenedScreen = function\(hasTatu, reward, clientRewards\)\{/.test(roulBuySrc),
        '_openRouletteCaseOpenedScreen принимает (hasTatu, reward, clientRewards)');
    // 25.09.2026 (регресс найден повторным прогоном тестов): вызов передаёт !!res.hasTatu
    // (булево приведение), не голую переменную hasTatu — сверено с фактическим кодом.
    assert(/this\._openRouletteCaseOpenedScreen\(!!res\.hasTatu, res\.reward, res\.clientRewards \|\| \[\]\);/.test(roulBuySrc),
        'вызывающий код передаёт res.reward/res.clientRewards из ответа roulette.openCase');
    assert(!/this\._give\('exp',\s*exp\);/.test(roulBuySrc), 'кнопка "Забрать" больше не вызывает _give для exp (задвоение)');
    assert(/cr\.type === 'battlepass_xp'/.test(roulBuySrc), 'battlepass_xp из clientRewards применяется по нажатию "Забрать"');
}

console.log('\nTest 5: roulette.php.spin() теперь и списывает стоимость, и выбирает/начисляет обычную награду');
{
    // 25.09.2026: roulette.php целиком CRLF (\r\n) — регекс с голым \n на границе функции не
    // матчился (m был null). indexOf-слайс до следующего известного маркера переживает оба
    // варианта окончания строк.
    const spinStart = roulettePhpSrc.indexOf('function spin(){');
    const spinEnd   = roulettePhpSrc.indexOf('// Выбирает slotIdx', spinStart);
    assert(spinStart !== -1 && spinEnd !== -1, 'spin() найден');
    const body = (spinStart !== -1 && spinEnd !== -1) ? roulettePhpSrc.slice(spinStart, spinEnd) : '';
    assert(/if\(!\$this->ops->deduct\(\$user, 'blue_points', 1\)\) return \$this->ops->fail\(50\);/.test(body),
        'списывает 1 blue_point через Gameops::deduct (было — client-side, без проверки)');
    // 25.09.2026 (дев-форс комбинаций казино, другая сессия): вызов получил 5-й аргумент
    // $devForceIdx.
    assert(/\$slotResult = \$this->_rollSlot\(\$jackpot, \$keyringAvailable, \$user, \$slotTrace, \$devForceIdx\);/.test(body),
        'вызывает _rollSlot для выбора/начисления обычной награды');
    assert(/\['patch' => \$patch, 'jackpot' => \$jackpot,/.test(body), 'возвращает patch вместе с jackpot/keyring_available/jackpot_pool');
}

console.log('\nTest 6: roulette.php.SPIN_SLOTS — таблица 1-в-1 совпадает с клиентским SLOTS (dvor-roulette-screen.js)');
{
    // Спот-чек нескольких характерных слотов, а не всех 15 — таблица большая, важно поймать
    // регресс при рефакторинге, не дублировать весь файл построчно.
    assert(/\['type'=>'roulette_spichki', 'amt'=>40,\s*'sp'=>40\],\s*\/\/ 2/.test(roulettePhpSrc), 'слот 2: +40 спичек (sp=40)');
    assert(/\['type'=>'exp',\s*'amt'=>10000, 'sp'=>0\],\s*\/\/ 5/.test(roulettePhpSrc), 'слот 5: +10000 опыта');
    assert(/\['type'=>'cig',\s*'amt'=>1000,\s*'sp'=>0\],\s*\/\/ 8/.test(roulettePhpSrc), 'слот 8: +1000 сигарет');
    assert(/\['type'=>'coins',\s*'amt'=>20,\s*'sp'=>0\],\s*\/\/ 10/.test(roulettePhpSrc), 'слот 10: +20р (не 10 — порядок важен, идентичен клиентскому)');
}

console.log('\nTest 7: dvor-roulette.js — не списывает blue_points локально, использует slotIdx/reward сервера');
{
    assert(!/udata\['blue_points'\] = \(pts - 1\)\.toString\(\);/.test(roulOrchSrc),
        'локальное списание blue_points убрано (перенесено в roulette.php.spin())');
    assert(/this\._resolveRouletteNewScreen\(idx, !!res\.jackpot, res\.reward, res\.clientRewards \|\| \[\]\);/.test(roulOrchSrc),
        'reward/clientRewards из ответа сервера прокидываются в _resolveRouletteNewScreen');
}

console.log('\nTest 8: dvor-roulette-screen.js — обычные слоты больше не вызывают _give(), только clientRewards-подсказки');
{
    assert(!/this\._give\(slot\.type, slot\.amt\);/.test(roulScreenSrc),
        '_give(slot.type, slot.amt) для обычных слотов убран (валюта уже начислена сервером)');
    assert(/\(clientRewards \|\| \[\]\)\.forEach\(cr => \{/.test(roulScreenSrc), 'clientRewards применяются (battlepass_xp/оружие)');
    // 28.09.2026 (репорт "спички рулетки выдаются вдвойне", см. tests/
    // roulette-spichki-achievement-double-count-fix.test.js): даже reward.sp с сервера сюда
    // передавать было лишним — roulette_spichki уже применён через applyPatch() раньше по
    // стеку, achievements.onDvorGame() больше не получает spichki вообще, чтобы не прибавить
    // его ещё раз поверх уже актуального значения.
    assert(/achievements\.onDvorGame\('roulette', \{\}\);/.test(roulScreenSrc),
        'onDvorGame больше не получает spichki — во избежание повторного начисления поверх applyPatch()');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
