/**
 * Test: 26.09.2026, по прямому репорту ("Истекло время жизни токена" сразу после входа
 * в игру, item_id 95/97/75 в shmot._onWear) —
 *
 * security.php.getToken() раньше вызывал output() (отдавал token клиенту) ДО saveData()
 * (запись time/lifetime/token/req_key в таблицу secure). Это узкое окно гонки: клиент мог
 * начать использовать токен, который ещё физически не долетел до БД, если конкурентный
 * запрос того же uid (например повторный/дублирующий getToken при быстрой перезагрузке —
 * судя по логам, у аккаунта было 2 launch-сессии подряд в течение минуты) успевал прочитать
 * secure ДО завершения записи.
 *
 * Фикс: saveData() теперь выполняется ПЕРЕД output() — клиент получает токен только после
 * того, как сервер гарантированно готов его принять на следующий запрос.
 *
 * Run: node tests/security-gettoken-persist-before-output-order-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const securitySrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'security.php'), 'utf-8');

console.log('\nTest 1: security.php.getToken() — saveData() выполняется ДО output(), не после');
{
    const saveIdx   = securitySrc.indexOf("saveData('secure', \$sec_array)");
    const outputIdx = securitySrc.indexOf("output(array('token'=>\$my_token))");
    assert(saveIdx !== -1, 'вызов saveData(\'secure\', ...) найден');
    assert(outputIdx !== -1, 'вызов output([\'token\'=>...]) найден');
    assert(saveIdx !== -1 && outputIdx !== -1 && saveIdx < outputIdx,
        'saveData() расположен в файле РАНЬШЕ output() — токен пишется в БД до отправки клиенту');
}

console.log('\nTest 2: содержимое $sec_array не изменилось (time/lifetime/token/req_key/id — все поля на месте)');
{
    assert(/'time'=>time\(\)/.test(securitySrc), 'time сохраняется');
    assert(/'lifetime'=>2592000/.test(securitySrc), 'lifetime (30 дней) не изменился');
    assert(/'token'=>\$my_token/.test(securitySrc), 'token совпадает с тем, что уходит клиенту');
    assert(/'req_key'=>\$this->registry\['req_key'\]/.test(securitySrc), 'req_key сохраняется');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
