/**
 * Test: 18.09.2026 — КРИТИЧЕСКИЙ баг, репорт пользователя "если что, чтобы ты понимал,
 * ни одна игра не работает, я нажимаю, ничего не происходит" + консольная ошибка:
 *
 *   game-boot.js Uncaught InvalidCharacterError: Failed to execute 'btoa' on 'Window':
 *   The string to be encoded contains characters outside of the Latin1 range.
 *
 * Корень: modules/server.js.loadReq() кодировал параметры запроса как
 * btoa(btoa(this.parameters)) — голый btoa() кидает исключение на ЛЮБОЙ строке с
 * символами вне Latin1, а this.parameters — это JSON.stringify(...) параметров запроса,
 * которые сплошь и рядом содержат кириллицу (ник игрока, названия предметов в udata_json
 * и т.д. — практически любой users.save). Критично то, ЧТО происходило после броска:
 * исключение вылетало НЕПОЙМАННЫМ внутри loadReq(), ДО this.MSS.send() — запрос не
 * уходил, ни onComplete, ни onError НИКОГДА не срабатывали, а главное — this.wait
 * оставался true НАВСЕГДА (сброс в false происходит только в completeRequest(), которая
 * теперь недостижима). nextReq() при this.wait===true всегда возвращается немедленно —
 * то есть ОДИН упавший запрос с кириллицей намертво вешал ВСЮ очередь запросов до конца
 * страницы. Этим объяснялись внешне разные баги: "бой с боссом вылетает в главное меню"
 * (bosses.startFight никогда не отвечал), "Зарики не работают, нет ни ошибки, ни броска"
 * (dice.start так же зависал) — оба чинить по отдельности не нужно, i корень один.
 *
 * Run: node tests/server-request-queue-cyrillic-btoa-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(path.join(__dirname, '..', '_client/src/modules/server.js'), 'utf-8');

console.log('\nTest 1: loadReq() кодирует параметры безопасно для кириллицы (encodeURIComponent+unescape перед btoa)');
{
    const start = src.indexOf('loadReq(method, yourParameters){');
    const end   = src.indexOf('\n    }', src.lastIndexOf('this.nextReq();', src.length));
    const body  = src.slice(start, end !== -1 ? end : src.length);

    assert(!/btoa\(btoa\(this\.parameters\)\)/.test(body),
        'старый небезопасный btoa(btoa(this.parameters)) — без encodeURIComponent — удалён');
    assert(/btoa\(unescape\(encodeURIComponent\(this\.parameters\)\)\)/.test(body),
        'внутренний слой кодирования — btoa(unescape(encodeURIComponent(this.parameters))) — Unicode-safe');
    assert(/btoa\(b64safe\)/.test(body) || /btoa\(\s*btoa\(unescape/.test(body),
        'внешний (второй) слой btoa применяется поверх уже безопасной ASCII-строки — формат для сервера не меняется');
}

console.log('\nTest 2: ошибка внутри loadReq() больше не вешает очередь запросов навсегда');
{
    const start = src.indexOf('loadReq(method, yourParameters){');
    const end   = src.indexOf('\n    }\n\t\n\tcompleteRequest', src);
    const body  = src.slice(start, end !== -1 ? end : src.length);

    assert(/try\s*\{/.test(body), 'тело loadReq обёрнуто в try (любая будущая непредвиденная ошибка тоже не подвесит очередь)');
    assert(/catch\s*\(e\)\s*\{/.test(body), 'есть catch-блок');
    const catchStart = body.indexOf('catch(e){');
    const catchBody  = catchStart !== -1 ? body.slice(catchStart) : '';
    assert(/this\.wait\s*=\s*false;/.test(catchBody),
        'в catch — this.wait сбрасывается в false (без этого nextReq() всегда мгновенно выходит для ВСЕХ будущих запросов)');
    assert(/this\.nextReq\(\);/.test(catchBody),
        'в catch — nextReq() вызывается снова, чтобы очередь продолжила обрабатывать следующие запросы, а не встала намертво');
    assert(/failedReq\[.e.\]\(/.test(catchBody) || /this\.thisReq\[.e.\]\(/.test(catchBody),
        'error-колбэк упавшего запроса вызывается — вызывающий код узнаёт о неудаче, а не просто теряет запрос молча');
}

console.log('\nTest 3: универсальный вход TS.php(method, params, onC, onE) не изменился (обратная совместимость всех ~30+ мест вызова в проекте)');
{
    assert(/php\(method,\s*yourParameters,\s*onC,\s*onE\)\{/.test(src), 'сигнатура php() осталась прежней');
    assert(/this\.reqs\.push\(\{"m":method,\s*"p":yourParameters,\s*"c":onC,\s*"e":onE\}\);/.test(src),
        'формат элемента очереди запросов не менялся — фикс локален внутри loadReq()');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
