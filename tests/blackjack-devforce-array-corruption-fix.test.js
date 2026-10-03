/**
 * Test: 26.09.2026, по прямому репорту ("2 картинка у блэкджека не отображаются карты" +
 * console: "card.rank НЕ входит в известный RANKS ... 'Array'") + подтверждено живыми логами
 * сервера (/var/log/php_errors.log, uid 382448269, 26.09.2026 08:00-08:02 UTC):
 *   [blackjack.deal] ..."forcedRank":"Array"..."hand":["Array","Array"]...
 *
 * Причина: PHP strval() на МАССИВЕ молча возвращает буквально строку "Array" без единого
 * предупреждения. Где именно на клиенте combo превращается в массив вместо строки — точно
 * не установлено (dev_panel_casino_force.js по коду шлёт валидный c.key), но эффект
 * подтверждён живыми логами: users.php.setDevCombo() записал "Array" в колонку
 * dev_force_blackjack, а blackjack.php._dealRealPair() затем использовал эту строку как ранг
 * ОБЕИХ карт — раздача полностью ломалась (card.rank="Array", .png не грузится).
 *
 * Фикс — защита в двух точках:
 *  1) users.php.setDevCombo() — combo, пришедший МАССИВОМ, отклоняется явной ошибкой (код 54)
 *     вместо тихой порчи через strval(), сырое значение логируется для диагностики.
 *  2) blackjack.php._dealRealPair() — forcedRank, не входящий в каталог рангов (по любой
 *     причине, не только "Array"), игнорируется — раздача идёт честно, а не ломается целиком.
 *
 * Run: node tests/blackjack-devforce-array-corruption-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const usersSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const bjSrc    = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'blackjack.php'), 'utf-8');

console.log('\nTest 1: users.php.setDevCombo() — combo-массив отклоняется явной ошибкой, не превращается в "Array" молча');
{
    const start = usersSrc.indexOf('function setDevCombo()');
    const body = usersSrc.slice(start, start + 1900);
    assert(/if\(is_array\(\$comboRaw\)\)\{/.test(body), 'проверка is_array(combo) добавлена ДО strval()');
    assert(/return \$this->registry\['tools'\]->error\(54\);/.test(body), 'массив-combo отклоняется кодом 54 (неверный параметр)');
    assert(/error_log\('\[users\.setDevCombo\] !!! combo пришёл МАССИВОМ/.test(body), 'аномалия логируется с сырым значением для диагностики');
    assert(/\$combo = strval\(\$comboRaw\);/.test(body), 'strval() применяется уже ПОСЛЕ проверки — только к безопасному значению');
}

console.log('\nTest 2: blackjack.php._dealRealPair() — forcedRank вне каталога рангов игнорируется, раздача не ломается');
{
    const start = bjSrc.indexOf('private function _dealRealPair');
    const body = bjSrc.slice(start, start + 1600);
    assert(/if\(\$forcedRank !== null && !in_array\(\$forcedRank, \$RANKS, true\)\)\{/.test(body),
        'forcedRank проверяется на членство в RANKS перед использованием');
    assert(/\$forcedRank = null;/.test(body), 'невалидный forcedRank сбрасывается в null (честная раздача вместо порченой)');
    assert(/error_log\('\[blackjack\._dealRealPair\] !!! forcedRank НЕ входит в RANKS/.test(body),
        'аномалия логируется для диагностики, если повторится');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
