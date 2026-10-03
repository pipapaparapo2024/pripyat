/**
 * Test: рулетка — джек-пот теперь реально растёт на 10р за каждый спин (цена поинта),
 * Гарантированная награда — 500 рублей; накопленный пул разыгрывается в суперигре.
 *
 * Run: node tests/roulette-real-jackpot-pool.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const phpSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');
const rouletteSrc       = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-roulette.js'), 'utf-8');
const rouletteScreenSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-roulette-screen.js'), 'utf-8');
const minigameSrc       = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-roulette-minigame.js'), 'utf-8');

console.log('\nTest 1: server roulette.php — spin() растит и возвращает jackpot_pool');
{
    assert(/UPDATE `roulette_state` SET `spin_counter` = LAST_INSERT_ID\(`spin_counter` \+ 1\), `jackpot_pool` = `jackpot_pool` \+ 10 WHERE `id`=1/.test(phpSrc),
        'spin_counter и jackpot_pool (+10) инкрементируются одним запросом');
    assert(/jackpot_pool.*=.*3000.*WHERE `id`=1/.test(phpSrc) || /jackpot_pool`=3000 WHERE `id`=1/.test(phpSrc),
        'при срабатывании джек-пота jackpot_pool сбрасывается на 3000');
    assert(/'jackpot_pool' => \$jackpotPool/.test(phpSrc), 'spin() отдаёт jackpot_pool клиенту в ответе');
}

console.log('\nTest 2: server roulette.php — status() тоже отдаёт jackpot_pool (для показа при открытии экрана)');
{
    const statusIdx = phpSrc.indexOf('function status(){');
    assert(statusIdx !== -1, 'status() найден');
    const body = phpSrc.slice(statusIdx, statusIdx + 800);
    assert(/jackpot_pool/.test(body), 'status() читает и возвращает jackpot_pool');
}

console.log('\nTest 3: клиент — запрашивает roulette.status при открытии экрана (раньше не вызывался вообще)');
{
    assert(/TS\.php\('roulette\.status', \{\}, \(res\)=>\{/.test(rouletteSrc), 'roulette.status вызывается в _openRouletteScreen');
    assert(/this\._roulJackpotPool = /.test(rouletteSrc), 'this._roulJackpotPool сохраняется из ответа сервера');
}

console.log('\nTest 4: клиент — больше не хардкодит "3000" в отображении джек-пота');
{
    assert(!/_roulJackTxt\.text = \(3000\)\.toLocaleString/.test(rouletteSrc),
        'старая захардкоженная строка (3000) убрана из _updateRouletteUI');
    assert(/_roulJackTxt\.text = \(this\._roulJackpotPool \|\| 3000\)\.toLocaleString/.test(rouletteSrc),
        '_updateRouletteUI показывает живую сумму this._roulJackpotPool');
}

console.log('\nTest 5: клиент — spin() тоже обновляет this._roulJackpotPool из ответа сервера');
{
    const spinIdx = rouletteSrc.indexOf("TS.php('roulette.spin'");
    assert(spinIdx !== -1, 'вызов roulette.spin найден');
    const end = rouletteSrc.indexOf('}, (err) => {', spinIdx);
    assert(spinIdx >= 0 && end > spinIdx, 'границы callback roulette.spin найдены');
    const body = rouletteSrc.slice(spinIdx, end);
    assert(/this\._roulJackpotPool = /.test(body), 'callback roulette.spin обновляет this._roulJackpotPool');
}


console.log('Fixed guaranteed choice, independent of pool');
assert(/const jackpotAmount = 500;/.test(minigameSrc), 'guaranteed choice is 500');
assert(/proto\._openJackpotChoice = function\(\)/.test(minigameSrc), 'choice accepts no pool argument');
assert(/this\._openJackpotChoice\(\);/.test(rouletteScreenSrc), 'super opens choice without pool');
assert(/add\(\$user, 'coins', 500\)/.test(phpSrc), 'server grants exactly 500');
assert(/roulette\.claimPrize/.test(minigameSrc) && /applyPatch\(res.patch\)/.test(minigameSrc), 'server grants reward');
if(failed) process.exit(1);
