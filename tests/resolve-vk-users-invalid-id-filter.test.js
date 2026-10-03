/**
 * Test: батч 22.09.2026 (защитный фикс наравне с avatarMask-фиксом, см.
 * svod-achievements-spacing-name-pos-and-leaderboard-avatar-mask-fix.test.js) —
 * bosses._resolveVkUsers теперь фильтрует невалидные id (<=0 или не число) ДО отправки в
 * батч-запрос VKWebAppCallAPIMethod('users.get') — один "битый"/тестовый id в списке мог
 * увести в ошибку весь батч-запрос, из-за чего фото не резолвились НИ ДЛЯ КОГО в списке,
 * включая полностью настоящих игроков рядом с битой записью.
 *
 * Run: node tests/resolve-vk-users-invalid-id-filter.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');

console.log('\nTest 1: _resolveVkUsers пропускает невалидные id (<=0 / NaN) до формирования батча');
{
    const start = src.indexOf('proto._resolveVkUsers = function(ids, callback){');
    const end   = src.indexOf('if(!rest.length || !window.bridge){', start);
    const body  = src.slice(start, end);
    assert(/if\(!\(parseInt\(id, 10\) > 0\)\)\{/.test(body), 'проверка parseInt(id,10) > 0 стоит в начале обработки каждого id');
    assert(/console\.warn\('\[bosses\._resolveVkUsers\] пропускаю невалидный id/.test(body), 'невалидный id логируется (не проглатывается молча)');
    assert(/return;/.test(body), 'невалидный id пропускается (return из forEach-колбэка), не попадает ни в out, ни в rest');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
