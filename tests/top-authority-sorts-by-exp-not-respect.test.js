/**
 * Test: 23.09.2026 (по прямому указанию) — «Топ по авторитету» (cat:4 в top.php.get()) раньше
 * сортировал игроков по respect (уважение/авторитет, добываемое прохождением локаций Зоны).
 * Теперь сортирует по exp (тот же счётчик, из которого клиент считает УРОВЕНЬ везде в игре) —
 * respect в этой вкладке больше не участвует вообще, ни в сортировке, ни в отдаваемом value.
 *
 * Метка колонки "АВТОРИТЕТ" на экране — часть фонового PNG (см. svod.js: cat:4,
 * bg:'задний фон топы по авторитету.png'), кодом не перерисовывается — визуально останется
 * прежней, пока не будет новый арт. Это ожидаемо, не баг этой правки.
 *
 * Run: node tests/top-authority-sorts-by-exp-not-respect.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const topPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'top.php'), 'utf-8');

console.log('\nTest 1: cat:4 (индекс 4 массива $fields) теперь exp, не respect');
{
    const m = topPhp.match(/\$fields = \[([^\]]+)\];/);
    assert(!!m, '$fields массив найден в top.php');
    if (m) {
        const fields = m[1].split(',').map(s => s.trim().replace(/'/g, ''));
        assert(fields.length === 6, '$fields содержит все 6 категорий (cat 0-5)');
        assert(fields[4] === 'exp', `cat:4 использует поле "exp" (получено: "${fields[4]}")`);
        assert(fields[4] !== 'respect', 'cat:4 больше НЕ использует respect');
        // Остальные категории не задеты этой правкой.
        assert(fields[0] === 'total_damage', 'cat:0 (урон) не изменился');
        assert(fields[5] === 'achievement_stars', 'cat:5 (достижения) не изменился');
    }
}

console.log('\nTest 2: ORDER BY и возвращаемое value используют тот же $field (единый источник — сортировка и число совпадают)');
{
    assert(/ORDER BY `'\.\$field\.'`-0 DESC/.test(topPhp),
        'ORDER BY построен из той же переменной $field, что и SELECT/value — cat:4 сортирует РОВНО по тому же полю, что отдаёт клиенту');
    assert(/'value'=>intval\(\$r\[\$field\]\)/.test(topPhp),
        'value в ответе — intval($r[$field]), для cat:4 это теперь exp, не respect');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
