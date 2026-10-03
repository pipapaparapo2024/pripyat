/**
 * Test: батч 18.09.2026 (найдено при полном изучении проекта после переноса экономики
 * на сервер) — dev_panel.js._resetAccount() сбрасывает аккаунт через users.save(), но
 * save() пишет ТОЛЬКО поля из whitelist $allowed. Server-only игровые сессии
 * (skills_levels/dice_session/poker_session/blackjack_session/yashik_session/roulette_cups)
 * НАМЕРЕННО не в этом списке (в этом и был смысл переноса — клиент не может их подделать
 * через users.save), значит обычный "сброс аккаунта" их не трогал: прокачанные скиллы и
 * зависшие игровые сессии переживали "полный сброс".
 *
 * Фикс: новый permit users.resetSession (server/core/controllers/users.php) обнуляет все
 * 6 полей напрямую в БД для своего uid; dev_panel.js._resetAccount() вызывает его вместе с
 * users.save и дополнительно зеркалит сброс skills.levels в клиентской памяти (тот же класс
 * проблемы, что уже был решён для bosses/zone — in-memory кэш не обновляется сам по себе
 * без перезагрузки страницы).
 *
 * Run: node tests/reset-account-session-fields.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const usersPhpSrc = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'core', 'controllers', 'users.php'), 'utf-8'
);
const devSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8'
);

const SESSION_FIELDS = [
    'skills_levels', 'dice_session', 'poker_session',
    'blackjack_session', 'yashik_session', 'roulette_cups',
];

console.log('\nTest 1: server-only session-поля по-прежнему НЕ в whitelist $allowed (иначе анти-чит смысла нет)');
{
    const allowedMatch = usersPhpSrc.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!allowedMatch, '$allowed массив найден в users.php');
    for (const key of SESSION_FIELDS) {
        assert(!new RegExp("'" + key + "'").test(allowedMatch[1]),
            `'${key}' отсутствует в whitelist $allowed (как и должно быть)`);
    }
}

console.log('\nTest 2: новый permit users.resetSession обнуляет все 6 server-only полей');
{
    assert(/\$this->permits = \[.*'resetSession'.*\];/.test(usersPhpSrc),
        "'resetSession' добавлен в \$this->permits");
    assert(/function resetSession\(\)\{/.test(usersPhpSrc), 'метод resetSession() определён');

    const bodyMatch = usersPhpSrc.match(/function resetSession\(\)\{([\s\S]*?)\n        \}/);
    assert(!!bodyMatch, 'тело resetSession() найдено');
    const body = bodyMatch ? bodyMatch[1] : '';

    for (const key of SESSION_FIELDS) {
        assert(new RegExp("'" + key + "'\\s*=>\\s*null").test(body),
            `resetSession() обнуляет '${key}'`);
    }
    assert(/\$this->registry\['uid'\]/.test(body), 'resetSession() пишет по СВОЕМУ uid из registry (не из параметров запроса)');
}

console.log('\nTest 3: dev_panel.js._resetAccount вызывает users.resetSession вместе с users.save');
{
    const resetIdx = devSrc.indexOf('proto._resetAccount = function(){');
    assert(resetIdx !== -1, '_resetAccount найден в dev_panel.js');
    const saveIdx = devSrc.indexOf("TS.php('users.save'", resetIdx);
    assert(saveIdx !== -1, "вызов TS.php('users.save', ...) найден внутри _resetAccount");

    const resetSessionIdx = devSrc.indexOf("TS.php('users.resetSession'", resetIdx);
    assert(resetSessionIdx !== -1, "вызов TS.php('users.resetSession', ...) найден внутри _resetAccount");
    assert(resetSessionIdx < saveIdx, 'users.resetSession вызывается до/вместе с users.save, не потерян где-то ниже');
}

console.log('\nTest 4: skills.levels обнуляются в клиентской памяти (не только на сервере)');
{
    assert(/skills\.levels = new Array\(20\)\.fill\(0\);/.test(devSrc),
        '_resetAccount явно обнуляет skills.levels в памяти (20 навыков)');
    assert(/skills\.skillsDmgSpent = 0;/.test(devSrc), '_resetAccount обнуляет skills.skillsDmgSpent');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
