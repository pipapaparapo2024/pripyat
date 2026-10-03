/**
 * Test: 26.09.2026, по прямому репорту ("выскакивает ошибка про истёкший токен, откуда она
 * берётся, я не понимаю") —
 *
 * Коды 0/2/3/5/6 (checkToken() в universal.php) — все про сломанную сессию/токен, текст
 * сервера уже человекочитаем ("Обнови страницу с игрой, чтобы продолжить" и т.п.), но раньше
 * это тонуло в консольных console.error каждого конкретного места вызова — сам игрок не видел
 * никакого попапа и не понимал, что вообще происходит. server.js.onError() теперь показывает
 * ОДИН попап (iface._openSidorovichError) на первый такой код за сессию — не дублирует его на
 * каждый следующий проваленный запрос той же серии (burst с одним и тем же сломанным токеном).
 *
 * Run: node tests/server-auth-error-visible-popup.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const serverSrc = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'server.js'), 'utf-8');

console.log('\nTest 1: server.js.onError() — коды 0/2/3/5/6 показывают попап один раз за сессию');
{
    const start = serverSrc.indexOf('onError(){');
    const body = serverSrc.slice(start, start + 1400);
    assert(/const authCode = this\.json && \[0, 2, 3, 5, 6\]\.includes\(this\.json\['code'\]\);/.test(body),
        'все 5 auth-кодов из checkToken() распознаются');
    assert(/if\(authCode && !this\._authErrorShown\)\{/.test(body),
        'попап показывается только один раз за сессию (флаг _authErrorShown)');
    assert(/this\._authErrorShown = true;/.test(body), 'флаг взводится сразу, до повторного показа');
    assert(/iface\._openSidorovichError\('Сессия сброшена', this\.json\['text'\] \|\| 'Обнови страницу с игрой, чтобы продолжить'\);/.test(body),
        'показывается стандартный попап ошибки с текстом СЕРВЕРА (уже человекочитаем)');
    assert(/if\(Boolean\(this\.thisReq\['e'\]\)\)this\.thisReq\['e'\]\(this\.json\);/.test(body),
        'исходный обработчик ошибки конкретного запроса по-прежнему вызывается (регресс-гвард)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
