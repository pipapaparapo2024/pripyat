/**
 * Test: 04.10.2026 — регресс-тест на живой баг (найден по репорту "сбросил аккаунт, энергия
 * 370 вместо 50"): 28.09.2026 'max_energy' убрали из client-writable $allowed в users.save()
 * (чтобы читер не мог накрутить его сам), но забыли добавить в users.resetSession() — единственный
 * server-only путь личного сброса (resetAllPlayers() не задело, он пишет в обход whitelist прямым
 * UPDATE). Итог: личный "СБРОС ВСЕГО" переставал сбрасывать энергию с 28.09, пока не починили это
 * сегодня. Отдельно нашлась и исправлена вручную в БД вторая жертва того же архитектурного класса
 * (Gameops::applyShmotOwnBonus() начисляет +max_energy НАВСЕГДА, флаг защиты от повтора хранится
 * внутри самого shmot-блока — если вещь позже убрать в обход этого метода, бонус остаётся сиротой).
 *
 * Три места должны посылать/ожидать ОДНО и то же значение '50' для max_energy при полном сбросе:
 * 1. users.php.resetSession() — личный сброс (единственный, где баг реально жил).
 * 2. users.php._defaultResetUdata() — используется resetAllPlayers() (админ, пароль).
 * 3. dev_panel.js._resetAccount() — клиентский payload обычного users.save (другие поля).
 * Текстовая проверка здесь уместна: баг был структурным (ключ ПОЛНОСТЬЮ ОТСУТСТВОВАЛ в списке),
 * не поведенческим — reflect/vm не нужен, достаточно убедиться, что ключ на месте и со значением
 * ровно '50' (тот же базовый дефолт, что у нового аккаунта).
 *
 * Run: node tests/users-reset-session-max-energy-parity.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function check(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else { console.error('  ❌ FAIL:', msg); failed++; }
}

const usersPhp = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const devPanelJs = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');

function extractFunctionBody(text, fnName) {
    const m = new RegExp(`function\\s+${fnName}\\s*\\([^)]*\\)\\s*\\{`).exec(text);
    if (!m) return null;
    let depth = 1, i = m.index + m[0].length;
    const start = i;
    while (depth > 0 && i < text.length) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;
        i++;
    }
    return text.slice(start, i - 1);
}

const resetSessionBody = extractFunctionBody(usersPhp, 'resetSession');
check(!!resetSessionBody, 'users.php.resetSession() найдена');
check(!!resetSessionBody && /'max_energy'\s*=>\s*'50'/.test(resetSessionBody),
    "resetSession() сбрасывает 'max_energy' => '50' (РЕГРЕСС-ПРУФ сегодняшнего бага — ключ раньше отсутствовал здесь вовсе)");

const defaultResetBody = extractFunctionBody(usersPhp, '_defaultResetUdata');
check(!!defaultResetBody, 'users.php._defaultResetUdata() найдена');
check(!!defaultResetBody && /'max_energy'\s*=>\s*'50'/.test(defaultResetBody),
    "_defaultResetUdata() (используется resetAllPlayers()) тоже даёт max_energy='50' — паритет с личным сбросом");

check(/max_energy:\s*'50'/.test(devPanelJs),
    "dev_panel.js._resetAccount() шлёт max_energy:'50' в клиентском payload — паритет всех трёх путей сброса");

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
