/**
 * Test: 2 правки по итогам сверки карт с полным текстом ТЗ.
 *
 * 1) Карты — счётчики ДВУХ невыигравших премиум-комбинаций "при этом не изменяются" в
 *    партии, где выбит порог третьей. ВАЖНО: ключ для сброса берётся из того, что было
 *    ВЫБИТО И РОЗДАНО при раздаче (this._bjForcedRank), а не из итоговой награды — по
 *    более позднему прямому указанию пользователя смена карт честно может сломать даже
 *    гарантированную сменой пару, и счётчик всё равно должен сброситься (это была "его"
 *    партия на эту комбинацию, независимо от того, взял он награду или нет).
 *
 * 2) Купленные поинты (синие — рулетка, красные — зарики) обновляли счётчик только на
 *    самом экране покупки — при выходе на основной экран игры старое значение
 *    оставалось видно, пока игрок не выходил из Двора целиком и не заходил заново.
 *
 * Run: node tests/cards-counter-isolation-and-points-refresh.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game', 'dvor');
const diceScreenSrc = fs.readFileSync(path.join(root, 'dvor-dice-screen.js'), 'utf-8');
const roulBuySrc    = fs.readFileSync(path.join(root, 'dvor-roulette-buy.js'), 'utf-8');
// 18.09.2026 (перенос Блэкджека на сервер, см. tests/blackjack-server-authoritative.test.js для
// полной проверки): pity-счётчики AA/KK/QQ и вся логика их сброса/накопления переехали в
// server/core/controllers/blackjack.php (были частью client-writable dvor_games_data — читер
// мог форсировать гарантированную пару через users.save). Логика сброса/накопления не менялась,
// только переехала — проверяем теперь на сервере.
const bjPhpSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'blackjack.php'), 'utf-8');

console.log('\nTest 1: карты — счётчики двух невыигравших премиум-комбинаций не трогаются в партии победы третьей (теперь на сервере)');
{
    const start = bjPhpSrc.indexOf('function resolve(){');
    const end   = bjPhpSrc.indexOf('\n        }', bjPhpSrc.indexOf('$this->ops->ok', start));
    const body  = bjPhpSrc.slice(start, end);
    assert(!!body, 'resolve() найден');

    assert(/\$forcedKey\s*=\s*\$active\['forcedRank'\] \? \(\$catalog\['premium_map'\]\[\$active\['forcedRank'\]\] \?\? null\) : null;/.test(body),
        'ключ сброса берётся из того, что было выбито и роздано (active.forcedRank), не из итоговой награды (bestRank)');
    assert(/if\(\$forcedKey\)\{/.test(body), 'если порог был выбит в этой партии — счётчик сбрасывается');
    assert(/\} else \{\s*\n\s*foreach\(\$catalog\['premium_map'\] as \$rank => \$key\)\{\s*\n\s*\$session\[\$key\] = intval\(\$session\[\$key\] \?\? 0\) \+ 1;\s*\n\s*\}\s*\n\s*\}/.test(body),
        'общий +1 всем трём счётчикам применяется ТОЛЬКО если в этой партии НИ ОДИН порог не был выбит');
}

console.log('\nTest 2: покупка красных поинтов (зарики) сразу обновляет счётчик на основном экране');
{
    const m = diceScreenSrc.match(/exitBtn\.on\('pointerdown', \(\)=>\{\s*win\.parent && win\.parent\.removeChild\(win\);\s*this\._diceBuyWin = null;([\s\S]*?)\n        \}\);/);
    assert(!!m, 'обработчик exitBtn на экране покупки поинтов зариков найден');
    if (m) assert(/this\._updateDiceScreenUI\(\);/.test(m[1]), 'вызывает _updateDiceScreenUI() при закрытии — обновляет _dicePointsTxt');
}

console.log('\nTest 3: покупка синих поинтов (рулетка) сразу обновляет счётчик на основном экране');
{
    const m = roulBuySrc.match(/exitBtn\.on\('pointerdown', \(\)=>\{\s*if\(win\.parent\) win\.parent\.removeChild\(win\);\s*this\._roulBuyWin = null;([\s\S]*?)\n        \}\);/);
    assert(!!m, 'обработчик exitBtn на экране покупки поинтов рулетки найден');
    if (m) assert(/this\._updateRouletteUI\(\);/.test(m[1]), 'вызывает _updateRouletteUI() при закрытии — обновляет _roulPtsTxt');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
