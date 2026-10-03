/**
 * Test: батч 16.09.2026 — "сброс всё ещё не работает" после закрытия бага с habar_bought.
 * Сервер вернул НОВУЮ фатальную ошибку: mysqli_sql_exception "Incorrect integer value: ''
 * for column 'gang_id'" — в БД это колонка типа INT (не TEXT/VARCHAR, как большинство
 * остальных полей), и пустая строка '' для INT-колонки в strict-mode MySQL недопустима.
 * Кросс-проверка ВСЕХ пар reset-объекта против реальной схемы БД нашла ещё 2 таких же поля
 * (hapuso_sold, vassilich_buys) — все трое исправлены на '0'.
 *
 * Run: node tests/reset-account-int-columns-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const devSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');

console.log('\nTest 1: три INT-колонки, ранее ошибочно обнулённые пустой строкой, теперь \'0\'');
{
    assert(/gang_id:'0'/.test(devSrc), "gang_id теперь '0' (INT-колонка, была '')");
    assert(!/gang_id:''/.test(devSrc), "gang_id:'' полностью удалена из reset-объекта");
    assert(/hapuga_sold:'0'/.test(devSrc), "hapuga_sold теперь '0' (INT-колонка, была '')");
    assert(!/hapuga_sold:''/.test(devSrc), "hapuga_sold:'' полностью удалена");
    assert(/vassilich_buys:'0'/.test(devSrc), "vassilich_buys теперь '0' (INT-колонка, была '')");
    assert(!/vassilich_buys:''/.test(devSrc), "vassilich_buys:'' полностью удалена");
}

console.log('\nTest 2: TEXT/VARCHAR-поля по-прежнему честно обнуляются пустой строкой (не задеты этим фиксом)');
{
    // 22.09.2026 (отдельный батч, ДРУГОЙ баг тем же классом): weapons/shmot убраны из этого
    // списка — они пустой строкой ('') больше НЕ обнуляются, а '[]' (валидный JSON-массив) —
    // причина не в типе колонки (обе TEXT, тут фикс не при чём), а в том, что
    // users.php._sanitizeWeapons()/_sanitizeShmot() делают json_decode('') → null → всё поле
    // молча отклоняется. См. boss-result-popup-shmot-fragment-icon-and-batch-fixes.test.js.
    for(const key of ['bosses_data', 'achievements', 'skills_data']){
        assert(new RegExp('\\b' + key + ":''").test(devSrc), `поле '${key}' (TEXT) остаётся ''`);
    }
    assert(/weapons:'\[\]'/.test(devSrc), "weapons теперь '[]' (не '', другой баг — см. комментарий выше)");
    assert(/shmot:'\[\]'/.test(devSrc), "shmot теперь '[]' (не '', тот же баг)");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
