/**
 * Test: 28.10.2026, по прямому указанию — "везде в игре, где числа выходят за 1000, пиши
 * К/КК", скоуп сужен пользователем до магазинов/попапов покупки и наград (не трогать точный
 * баланс в верхнем HUD). Места найдены фоновым аудитом (см. чат) по реальным порогам из
 * server/json/*.json и achievements_config.json — не произвольный список "на всякий случай".
 *
 * Run: node tests/format-ach-num-shop-reward-sweep-28-10.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel) { return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\nTest 1: dvor-poker-bag.js — спички рулетки (экран сумки) и exp/cig наград (экран открытия) сокращены');
{
    const src = readSrc('_client/src/game/dvor/dvor-poker-bag.js');
    assert(/import \{ formatAchNum \} from '\.\.\/\.\.\/modules\/achievement-tiers\.js';/.test(src), 'formatAchNum импортирован');
    assert(/const spTxt = new PIXI\.Text\(formatAchNum\(spichkiCount, true\), \{/.test(src),
        'spTxt (спички, экран сумки до открытия) — formatAchNum(spichkiCount, true)');
    assert(/_addAmt\('\+' \+ formatAchNum\(exp, true\),   635, 242\);/.test(src),
        'exp-награда (poker.php.openBag гарантирует >=1000 каждый раз) — formatAchNum');
    assert(/_addAmt\('\+' \+ formatAchNum\(cig, true\),   449, 387\);/.test(src),
        'cig-награда (доходит до 1000) — formatAchNum');
    // stash/coins НЕ трогались — структурно малы (5-15/1-5), formatAchNum на них был бы шумом.
    assert(/_addAmt\('\+' \+ stash, 630, 439\);/.test(src), 'stash остался без изменений (всегда мал)');
    assert(/_addAmt\('\+' \+ coins, 795, 257\);/.test(src), 'coins остался без изменений (всегда мал)');
}

console.log('\nTest 2: dvor-roulette-buy.js — баланс синих поинтов и спичек сокращены');
{
    const src = readSrc('_client/src/game/dvor/dvor-roulette-buy.js');
    assert(/import \{ formatAchNum \} from '\.\.\/\.\.\/modules\/achievement-tiers\.js';/.test(src), 'formatAchNum импортирован');
    assert(/const ptsTxt = new PIXI\.Text\(formatAchNum\(parseInt\(udata\['blue_points'\] \|\| 0\), true\), \{/.test(src),
        'ptsTxt (баланс blue_points, экран покупки поинтов) — formatAchNum');
    assert(/const spTxt = new PIXI\.Text\('Спичек: ' \+ formatAchNum\(parseInt\(udata\['roulette_spichki'\]\|\|0\), true\), \{/.test(src),
        'spTxt (баланс спичек, экран кейса) — formatAchNum');
}

console.log('\nTest 3: dvor-dice-screen.js — баланс поинтов зариков (экран покупки) сокращён');
{
    const src = readSrc('_client/src/game/dvor/dvor-dice-screen.js');
    assert(/import \{ formatAchNum \} from '\.\.\/\.\.\/modules\/achievement-tiers\.js';/.test(src), 'formatAchNum импортирован');
    assert(/const ptsTxt = new PIXI\.Text\(formatAchNum\(parseInt\(udata\['dice_points'\]\|\|0\), true\), \{/.test(src),
        'ptsTxt (баланс dice_points, экран покупки поинтов) — formatAchNum');
}

console.log('\nTest 4: achievement.js — общий счёт очков достижений (попап) сокращён');
{
    const src = readSrc('_client/src/game/shell/popups/achievement.js');
    assert(/import \{ formatAchNum \} from '\.\.\/\.\.\/\.\.\/modules\/achievement-tiers\.js';/.test(src), 'formatAchNum импортирован');
    assert(/const totalTxt = new PIXI\.Text\(formatAchNum\(this\.getTotalStars\(\), true\), \{/.test(src),
        'totalTxt (общий счёт, до 4455 очков по 331 достижению) — formatAchNum');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else { console.error(`❌ ${failed} test(s) failed, ${passed} passed`); process.exit(1); }
