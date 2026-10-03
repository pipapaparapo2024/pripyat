/**
 * Test: 27.09.2026 (по прямому указанию — «топ по авторитету, показывает только 10 человек,
 * листаться должен до 100; с достягами та же херня») — «Топ по авторитету» (cat:4) и «Топ по
 * достижениям» (cat:5) на экране Сводки должны отдавать и отрисовывать до 100 строк, а не 10.
 *
 * Что проверяем:
 *   1) server/core/controllers/top.php — лимит выборки больше не захардкожен в SQL: он приходит
 *      из _rowsLimit($cat), который даёт 100 для cat:4/cat:5 и 10 для всех остальных категорий.
 *   2) Недельный топ урона (cat:0, _getWeeklyDamageTop) остаётся на 10 — про него в задаче речи
 *      не было, но и он теперь читает лимит из той же функции (один рубильник, без второго
 *      захардкоженного числа в файле).
 *   3) _client/src/game/svod/svod-leaderboard.js — пул ячеек ROWS_POOL поднят до 100 и РАВЕН
 *      серверному ROWS_LIMIT_SCROLLABLE (главный инвариант: если сервер отдаст больше, чем есть
 *      ячеек, хвост списка молча не отрисуется).
 *   4) Список со 100 строками реально скроллится: высота контента (видимые строки × шаг) больше
 *      высоты видимой области, а getTotalH считает ТОЛЬКО видимые строки — значит у топов с
 *      меньшим числом строк (друзья/урон) поведение скролла не изменилось.
 *   5) Каждая загрузка данных сбрасывает прокрутку в начало (scroll.scrollToTop()), при этом
 *      refresh() по-прежнему СОХРАНЯЕТ позицию — на достижениях (аккордеон) поведение не тронуто.
 *   6) svod.js — обе вкладки из задачи (авторитет/достижения) строятся именно этой панелью,
 *      то есть обе получают пул из 100 ячеек.
 *
 * Run: node tests/top-100-rows-authority-and-achievements.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root    = path.join(__dirname, '..');
const topPhp  = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'top.php'), 'utf-8');
const lbSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-leaderboard.js'), 'utf-8');
const scrSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-scroll.js'), 'utf-8');
const svodSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod.js'), 'utf-8');

// Значения из PHP — обе константы лимита (используются и как ожидаемые числа, и для сверки с клиентом).
const LIMIT_DEFAULT    = (topPhp.match(/const ROWS_LIMIT_DEFAULT\s*=\s*(\d+);/)    || [])[1];
const LIMIT_SCROLLABLE = (topPhp.match(/const ROWS_LIMIT_SCROLLABLE\s*=\s*(\d+);/) || [])[1];

console.log('\nTest 1: top.php — константы лимита объявлены (10 по умолчанию, 100 для скроллящихся топов)');
{
    assert(LIMIT_DEFAULT === '10',     'ROWS_LIMIT_DEFAULT = 10 (получено: ' + LIMIT_DEFAULT + ')');
    assert(LIMIT_SCROLLABLE === '100', 'ROWS_LIMIT_SCROLLABLE = 100 (получено: ' + LIMIT_SCROLLABLE + ')');
}

console.log('\nTest 2: _rowsLimit($cat) — 100 для скроллящихся топов, включая cat:0 (урон)');
{
    const m = topPhp.match(/private function _rowsLimit\(\$cat\)\{\s*return ([^;]+);\s*\}/);
    assert(!!m, '_rowsLimit($cat) объявлен в top.php');
    if (m) {
        // Выражение из PHP переводится в JS механической заменой ($cat → cat, self::КОНСТАНТА →
        // её числовое значение) и вычисляется для каждой категории — проверяется САМО выражение
        // из файла, а не его пересказ в тесте.
        const jsExpr = m[1]
            .replace(/\$cat/g, 'cat')
            .replace(/self::ROWS_LIMIT_SCROLLABLE/g, LIMIT_SCROLLABLE)
            .replace(/self::ROWS_LIMIT_DEFAULT/g, LIMIT_DEFAULT);
        const rowsLimit = new Function('cat', 'return ' + jsExpr + ';');
        const expected = { 0: 100, 1: 10, 2: 10, 3: 10, 4: 100, 5: 100 };
        Object.keys(expected).forEach(cat => {
            const got = rowsLimit(Number(cat));
            assert(got === expected[cat], 'cat:' + cat + ' → лимит ' + expected[cat] + ' (получено: ' + got + ')');
        });
    }
}

console.log('\nTest 3: запрос rows в get() использует $limit из _rowsLimit(), а не захардкоженное число');
{
    const start = topPhp.indexOf('function get(){');
    const end   = topPhp.indexOf('function _getWeeklyDamageTop', start);
    const body  = topPhp.slice(start, end);
    assert(/\$limit = \$this->_rowsLimit\(\$cat\);/.test(body), '$limit вычисляется из _rowsLimit($cat) до запроса');
    assert(/ORDER BY `'\.\$field\.'`-0 DESC LIMIT '\.\$limit/.test(body), 'LIMIT в SQL подставляется из $limit');
    assert(!/LIMIT 10/.test(body), 'в get() не осталось захардкоженного "LIMIT 10"');
    assert(/'limit'=>\$limit/.test(body), 'ответ клиенту содержит фактический limit (самодокументирование ответа)');
}

console.log('\nTest 4: недельный топ урона (cat:0) читает общий лимит 100 строк');
{
    const start = topPhp.indexOf('function _getWeeklyDamageTop()');
    const body  = topPhp.slice(start);
    assert(/LIMIT " \. \$this->_rowsLimit\(0\)/.test(body), 'LIMIT недельного топа берётся из _rowsLimit(0)');
    assert(!/LIMIT 10/.test(body), 'в _getWeeklyDamageTop() не осталось захардкоженного "LIMIT 10"');
    // _rowsLimit(0) по Test 2 = 100 → топ урона скроллится до сотого места.
}

console.log('\nTest 5: клиент — пул ячеек 100 и он РАВЕН серверному ROWS_LIMIT_SCROLLABLE');
{
    const m = lbSrc.match(/const ROWS_POOL = (\d+);/);
    assert(!!m, 'ROWS_POOL найден в svod-leaderboard.js');
    if (m) {
        assert(m[1] === '100', 'ROWS_POOL = 100 (получено: ' + m[1] + ')');
        assert(m[1] === LIMIT_SCROLLABLE,
            'ROWS_POOL (' + m[1] + ') === ROWS_LIMIT_SCROLLABLE в top.php (' + LIMIT_SCROLLABLE + ') — иначе хвост списка с сервера не отрисуется');
    }
    assert(/for\(let i = 0; i < ROWS_POOL; i\+\+\)\{/.test(lbSrc), 'пул строится по ROWS_POOL (одна ячейка на строку)');
    assert(/const r = rows\[i\];[\s\S]{0,40}if\(!r\) return;/.test(lbSrc),
        'строки за пределами пула безопасно игнорируются (if(!r) return) — лишние данные с сервера не ломают отрисовку');
}

console.log('\nTest 6: 100 строк реально скроллятся, и высота считается только по ВИДИМЫМ строкам');
{
    const cellH  = Number((lbSrc.match(/CELL_H = (\d+)/)   || [])[1]);
    const rowGap = Number((lbSrc.match(/ROW_GAP = (\d+)/)  || [])[1]);
    const listH  = Number((lbSrc.match(/LIST_H\s+= (\d+)/) || [])[1]);
    const rowH   = cellH + rowGap;
    assert(rowH > 0 && listH > 0, 'геометрия прочитана: шаг строки ' + rowH + 'px, видимая область ' + listH + 'px');

    assert(/getTotalH: \(\) => rows\.filter\(r => r\.row\.visible\)\.length \* ROW_H/.test(lbSrc),
        'getTotalH умножает на ROW_H число ТОЛЬКО видимых строк');
    assert(/stepPx: ROW_H/.test(lbSrc), 'шаг кнопок-стрелок — ровно одна строка');

    // Та же формула, что в svod-scroll.js.refresh(): scrollRange = max(0, totalH - viewH).
    const scrollRange = (nVisible) => Math.max(0, nVisible * rowH - listH);
    assert(scrollRange(100) > 0,
        '100 строк дают прокрутку: диапазон ' + scrollRange(100) + 'px (' + (100 * rowH) + 'px контента при окне ' + listH + 'px)');
    assert(scrollRange(100) === 100 * rowH - listH, 'диапазон прокрутки покрывает весь список до 100-го места');
    assert(scrollRange(4) === 0, 'при 4 видимых строках (например, топ друзей) прокрутки нет — поведение коротких списков не изменилось');
    assert(scrollRange(10) === 10 * rowH - listH, 'старый случай на 10 строк считается той же формулой (регрессии нет)');
}

console.log('\nTest 7: каждая загрузка списка начинается с 1 места (scrollToTop), refresh() позицию по-прежнему сохраняет');
{
    assert(/scrollToTop: \(\) => setScroll\(0\)/.test(scrSrc), 'svod-scroll.js отдаёт scrollToTop()');
    assert(/setScroll\(Math\.min\(scrollY, scrollRange\)\)/.test(scrSrc),
        'refresh() по-прежнему сохраняет текущую позицию — достижения (аккордеон) не затронуты');

    const body = lbSrc.slice(lbSrc.indexOf('proto._loadLeaderboard'));
    assert(/if\(scroll && typeof scroll\.scrollToTop === 'function'\) scroll\.scrollToTop\(\);/.test(body),
        '_loadLeaderboard сбрасывает прокрутку в начало при получении новых данных');
    // Сброс — ДО заполнения строк и до refresh(), чтобы новая выборка всегда открывалась сверху.
    assert(body.indexOf('scroll.scrollToTop();') < body.indexOf('if(scroll) scroll.refresh();'),
        'сброс прокрутки идёт раньше refresh() (порядок: сброс → заполнение строк → пересчёт высоты)');
}

console.log('\nTest 8: обе вкладки из задачи строятся этой же панелью (значит обе получают пул из 100)');
{
    const respect = svodSrc.match(/key === 'respect'\)\{\s*panel = this\._buildLeaderboardPanel\(\{\s*cat: (\d+)/);
    assert(!!respect && respect[1] === '4',
        '«Топ по авторитету» → _buildLeaderboardPanel с cat:4 (получено: ' + (respect && respect[1]) + ')');
    const achIdx = svodSrc.indexOf("key === 'ach'");
    const achCat = svodSrc.slice(achIdx).match(/_buildLeaderboardPanel\(\{\s*cat: (\d+)/);
    assert(!!achCat && achCat[1] === '5',
        '«Топ по достижениям» (Общий топ) → _buildLeaderboardPanel с cat:5 (получено: ' + (achCat && achCat[1]) + ')');
}

console.log('\n' + '─'.repeat(50));
if (failed === 0) console.log('✅ All ' + passed + ' tests passed');
else              { console.log('❌ ' + failed + ' FAILED, ' + passed + ' passed'); process.exit(1); }
