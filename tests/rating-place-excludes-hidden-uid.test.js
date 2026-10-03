/**
 * Test: 29.09.2026, по прямому репорту пользователя со скриншотом визитки игрока —
 * "игрок топ-1 по уровню, а в визитке РЕЙТИНГ показывает #2"; "я #2 в топе по уровню,
 * в своей визитке вижу #3". Разница системная: реальное место минус 1 == показанное.
 *
 * Корень: служебный аккаунт Top::HIDDEN_FROM_TOP_UID (uid 1113977365, см.
 * hide-uid-from-leaderboards.test.js) исключён из ВИДИМЫХ списков топа (rows), но НЕ был
 * исключён из подсчёта МЕСТА — формулы вида "SELECT COUNT(*)+1 WHERE поле-0 > мой_показатель"
 * в трёх местах:
 *   1. users.php.get() — rating_place, который показывается в визитке игрока
 *   2. top.php.get() — my_place для категорий 1-5 (монеты/боссы/тушёнка/exp/звёзды)
 *   3. top.php._getWeeklyDamageTop() — my_place для недельного топа урона (cat:0)
 * Скрытый аккаунт (с большим показателем, раз он вообще заметно сдвигал место) молча попадал
 * в COUNT(*) и завышал место КАЖДОГО реального игрока на 1 относительно того, что тот видит
 * в самом списке топа (откуда скрытый аккаунт уже вырезан). Фикс — та же exclusion
 * (id != HIDDEN_FROM_TOP_UID), что уже применялась к rows-запросам, добавлена и к
 * place-запросам.
 *
 * Run: node tests/rating-place-excludes-hidden-uid.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const usersPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const topPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'top.php'), 'utf-8');

console.log('\nTest 1: users.php — rating_place (визитка игрока) исключает скрытый uid из подсчёта места');
{
    const placeQueryMatch = usersPhp.match(/SELECT COUNT\(\*\)\+1 AS place FROM `\{\$this->registry\['utb'\]\}` WHERE `exp`-0 > \{\$myExp\}[^"]*/);
    assert(!!placeQueryMatch, 'запрос rating_place найден в users.php');
    assert(!!placeQueryMatch && /AND `id` != 1113977365/.test(placeQueryMatch[0]),
        'запрос rating_place добавляет "AND id != 1113977365" (HIDDEN_FROM_TOP_UID) к условию');
}

console.log('\nTest 2: top.php.get() — my_place (категории 1-5) исключает HIDDEN_FROM_TOP_UID из подсчёта места');
{
    const start = topPhp.indexOf('function get(){');
    const end = topPhp.indexOf('function _getWeeklyDamageTop', start);
    const body = topPhp.slice(start, end);
    const placeQueryMatch = body.match(/SELECT COUNT\(\*\)\+1 AS place FROM `\{\$this->registry\['utb'\]\}` WHERE \(\{\$where\}\) AND `\{\$field\}`-0 > \{\$my_value\}[^\n]*/);
    assert(!!placeQueryMatch, 'запрос my_place найден в get()');
    assert(!!placeQueryMatch && /AND `id` != " \. self::HIDDEN_FROM_TOP_UID/.test(placeQueryMatch[0]),
        'запрос my_place добавляет "AND id != HIDDEN_FROM_TOP_UID" к условию WHERE');
}

console.log('\nTest 3: top.php._getWeeklyDamageTop() — my_place (недельный топ урона) исключает HIDDEN_FROM_TOP_UID из подсчёта места');
{
    const weeklyStart = topPhp.indexOf('function _getWeeklyDamageTop()');
    const weeklyBody = topPhp.slice(weeklyStart);
    const placeResIdx = weeklyBody.indexOf('$placeRes = $link->query(');
    assert(placeResIdx > -1, 'запрос placeRes найден в _getWeeklyDamageTop()');
    const placeQuery = weeklyBody.slice(placeResIdx, placeResIdx + 500);
    assert(/AND bl\.`uid` != " \. self::HIDDEN_FROM_TOP_UID/.test(placeQuery),
        'подзапрос my_place добавляет "AND bl.uid != HIDDEN_FROM_TOP_UID" к условию WHERE');
    // группировка/HAVING по-прежнему считает СТРОГО больше моего my_value — только добавлено
    // условие исключения, не тронута сама логика подсчёта конкурентов.
    assert(/GROUP BY bl\.`uid` HAVING dmg > \{\$my_value\}/.test(placeQuery),
        'группировка и условие "больше моего значения" не изменены — добавлено только исключение uid');
}

console.log('\nTest 4: место скрытого аккаунта в rows-запросах (см. hide-uid-from-leaderboards.test.js) остаётся нетронутым этим фиксом — не дублируем исключение дважды в одном запросе');
{
    const rowsQueryMatch = topPhp.match(/\$where \. ' AND id != ' \. self::HIDDEN_FROM_TOP_UID \. ' ORDER BY/);
    assert(!!rowsQueryMatch, 'исключение в rows-запросе get() осталось ровно одно (не задвоено правкой)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
