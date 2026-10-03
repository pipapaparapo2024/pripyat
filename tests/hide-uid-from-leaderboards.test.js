/**
 * Test: 26.09.2026, по прямому указанию — "не показывай игрока Николая Седенко в топе
 * никогда" (uid 1113977365). top.php.get() (все категории 1-5: урон-lifetime убран,
 * монеты/боссы убито/тушёнка/exp/звёзды достижений) и _getWeeklyDamageTop() (cat:0, топ урона
 * за неделю из boss_damage_log) — обе ветки должны исключать этот uid из строк (rows),
 * возвращаемых ВСЕМ зрителям топа. Собственные my_value/my_place не затронуты — если зайдёт
 * именно он, свою позицию видит как обычно.
 *
 * Run: node tests/hide-uid-from-leaderboards.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const topPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'top.php'), 'utf-8');

console.log('\nTest 1: константа HIDDEN_FROM_TOP_UID объявлена с правильным значением');
{
    assert(/const HIDDEN_FROM_TOP_UID = 1113977365;/.test(topPhp), 'константа задаёт нужный uid');
}

console.log('\nTest 2: get() (категории 1-5, обычные топы из таблицы users) исключает этот uid из rows');
{
    const start = topPhp.indexOf('function get(){');
    const end = topPhp.indexOf('function _getWeeklyDamageTop', start);
    const body = topPhp.slice(start, end);
    assert(/AND id != ' \. self::HIDDEN_FROM_TOP_UID \. '/.test(body) || /AND id != " \. self::HIDDEN_FROM_TOP_UID \. "/.test(body),
        'запрос rows добавляет "AND id != HIDDEN_FROM_TOP_UID" к условию WHERE');
    // 27.09.2026: жёсткий "LIMIT 10" в этой проверке заменён на $limit — размер выборки стал
    // зависеть от категории (cat:4/5 отдают до 100 строк, см. _rowsLimit() в top.php и
    // tests/top-100-rows-authority-and-achievements.test.js). Для ЭТОГО теста важно только то,
    // что сортировка и лимит остались частью того же запроса, к которому добавлено исключение uid.
    assert(/ORDER BY `'\.\$field\.'`-0 DESC LIMIT '\.\$limit/.test(body), 'сортировка/лимит остались в том же запросе — добавлено только условие исключения');
}

console.log('\nTest 3: _getWeeklyDamageTop() (cat:0, топ урона за неделю из boss_damage_log) исключает этот uid из rows');
{
    const start = topPhp.indexOf('function _getWeeklyDamageTop()');
    const body = topPhp.slice(start);
    // 28.09.2026: запрос переписан на FROM users LEFT JOIN boss_damage_log (чтобы игроки с
    // нулевым уроном за неделю тоже попадали в топ, см. run_tests.js "Нулевой недельный урон
    // не исключает игрока из топа") — исключение переехало с bl.uid на u.id (та же таблица,
    // что теперь главная в запросе), группировка — в подзапрос d.
    assert(/AND u\.`id` != " \. self::HIDDEN_FROM_TOP_UID \. "/.test(body),
        'запрос rows добавляет "AND u.id != HIDDEN_FROM_TOP_UID" к условию WHERE (тот же uid, что и в get())');
    assert(/GROUP BY `uid`\s*\n\s*\) d ON d\.`uid` = u\.`id`/.test(body),
        'группировка недельного урона осталась (перенесена в подзапрос d) — только добавлено условие исключения на внешнем u.id');
}

console.log('\nTest 4: собственное значение (my_value) НЕ затронуто исключением — если зайдёт именно скрытый uid, свой ПОКАЗАТЕЛЬ видит как обычно');
{
    // 29.09.2026: сузил проверку до самой строки присвоения $my_value (была [\s\S]{0,200} от
    // слова "my_value" вообще где угодно в теле get() — это случайно захватывало и соседний
    // $placeRow-запрос, который ПОСЛЕ фикса ниже (rating-place-excludes-hidden-uid.test.js)
    // ЗАКОННО содержит HIDDEN_FROM_TOP_UID в паре строк дальше по коду). my_value (сам
    // показатель игрока) и my_place (его МЕСТО относительно других) — разные вещи: место не
    // должно учитывать скрытый аккаунт в подсчёте конкурентов, а сам показатель игрока к этому
    // отношения не имеет вообще.
    const getStart = topPhp.indexOf('function get(){');
    const getEnd = topPhp.indexOf('function _getWeeklyDamageTop', getStart);
    const getBody = topPhp.slice(getStart, getEnd);
    const myValueLineMatch = getBody.match(/\$my_value = \$me[^\n]*\n/);
    assert(!!myValueLineMatch, 'строка присвоения $my_value найдена');
    assert(!myValueLineMatch || !/HIDDEN_FROM_TOP_UID/.test(myValueLineMatch[0]), 'строка $my_value = ... в get() не содержит исключения по uid — считается для текущего игрока как обычно');

    const weeklyStart = topPhp.indexOf('function _getWeeklyDamageTop()');
    const weeklyBody = topPhp.slice(weeklyStart);
    const myValueIdx = weeklyBody.indexOf('$my_value = $myRow');
    assert(myValueIdx > -1, 'my_value считается отдельным запросом в _getWeeklyDamageTop()');
    const myValueQueryStart = weeklyBody.indexOf('SELECT SUM(`damage`)');
    const myValueQuery = weeklyBody.slice(myValueQueryStart, myValueQueryStart + 150);
    assert(!/HIDDEN_FROM_TOP_UID/.test(myValueQuery), 'запрос собственного my_value не содержит исключения по uid');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
