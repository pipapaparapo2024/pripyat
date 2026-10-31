/**
 * Test: 26.10.2026 — регресс-гвард для новой мини-игры "2048", того же класса, что остальные
 * анти-чит regex-тесты whitelist в проекте (см. AGENTS.md — "Критичные общие функции"/таблица
 * стилей тестов). Проверяет ТЕКСТ файлов, не поведение — дешёвый первый слой + явная проверка
 * инварианта "server-only поля НЕ должны стать client-writable", которую легко случайно нарушить
 * будущей правкой (скопировать блок из другого контроллера и забыть вычеркнуть лишнее поле).
 *
 * Run: node tests/game2048-whitelist-and-registration.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function check(cond, msg){ if(cond){ console.log('  ✅', msg); passed++; } else { console.error('  ❌ FAIL:', msg); failed++; } }

const usersPhp = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const registryPhp = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'models', 'registry.example.php'), 'utf-8');
const game2048Php = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'game2048.php'), 'utf-8');

console.log('\nWhitelist — server-only поля НЕ должны быть client-writable');
const allowedBlockMatch = usersPhp.match(/\$allowed\s*=\s*\[([\s\S]*?)\n\s*\];/);
check(!!allowedBlockMatch, '$allowed блок найден в users.php (сам regex не устарел)');
const allowedBlock = allowedBlockMatch ? allowedBlockMatch[1] : '';
['game2048_session', 'game2048_daily', 'game2048_fragments', 'game2048_games_completed',
 'game2048_games_completed_at', 'game2048_lifetime'].forEach((field) => {
    check(!new RegExp("'" + field + "'").test(allowedBlock),
        `'${field}' НЕ в $allowed (иначе читер подделает через users.save, см. docblock game2048.php)`);
});

console.log('\nresetSession() — server-only поля должны сбрасываться при сбросе аккаунта');
const resetBlockMatch = usersPhp.match(/function resetSession\(\)\{([\s\S]*?)\$result = /);
const resetBlock = resetBlockMatch ? resetBlockMatch[1] : '';
check(!!resetBlockMatch, 'resetSession() найдена в users.php (сам regex не устарел)');
["'game2048_session'", "'game2048_daily'", "'game2048_fragments'", "'game2048_games_completed'",
 "'game2048_lifetime'"].forEach((field) => {
    check(resetBlock.includes(field), `${field} обнуляется в resetSession() (иначе "сброшенный" аккаунт хранит прогресс 2048)`);
});

console.log('\nРегистрация контроллера');
check(/'classes'\s*=>\s*array\([^)]*'game2048'/.test(registryPhp), "'game2048' в registry.php classes (иначе TS.php('game2048.*') не находит класс)");
check(/class Game2048/i.test(game2048Php), 'class Game2048 объявлен в game2048.php');
// 27.10.2026 (по прямому указанию — dev-кнопка "обнулить попытки 2048"): добавлен 7-й permit
// devResetDaily (dev-only, за _requireDevUser() гейтом, тот же паттерн, что
// bosses.php.devResetDailyLimits()).
check(/\$this->permits\s*=\s*\['getState', 'start', 'move', 'end', 'top', 'craft', 'devResetDaily'\]/.test(game2048Php),
    'permits включает все 7 эндпоинтов (getState/start/move/end/top/craft/devResetDaily)');

console.log('\nДневной лимит партий — ТЗ п.3 говорит 6 (3 бесплатные + 3 платные), НЕ 16');
check(/const DAILY_LIMIT = 6;/.test(game2048Php), 'DAILY_LIMIT = 6 (по финальному ТЗ, а не по устной "16" — см. финальные вопросы пользователю)');

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
