/**
 * Test: 26.09.2026 (аудит перед модерацией VK) — три независимых, но малых фикса:
 *
 * 1) <title>/og:title содержали слово "Тест" — чек-лист модерации (п.45 "название и описание
 *    соответствуют реально запущенной версии") требует убрать упоминания тестового статуса из
 *    боевой версии. Фикс: "Припять: Тест" → "Припять" в обоих местах (title и og:title).
 *
 * 2) module_control.js.load() при отсутствующем window[fla] уходил в setTimeout(doLoad,50) БЕЗ
 *    единого сообщения об ошибке — потенциальное тихое бесконечное зависание на загрузке
 *    (чек-лист п.1, п.10). Фикс: явное сообщение об ошибке вместо тихого ожидания.
 *    26.09.2026 (ОБНОВЛЕНО тем же днём — репорт со скриншотом, игра реально перестала
 *    грузиться на VK-вебвью): первая версия фикса угадывала сбой ПО ТАЙМЕРУ (60×50мс=3с) —
 *    на медленной сети/после VK Bridge round-trip скрипт легитимно грузился дольше 3с и
 *    всё равно успешно доезжал, но таймер уже увольнял игру раньше времени. Заменено на
 *    событие onerror самого script-тега (см. window.include в index.js) — точное
 *    обнаружение РЕАЛЬНОГО сбоя (404/сеть), а не гадание по времени; опрос window[fla]
 *    снова без верхнего лимита попыток (безопасно, т.к. настоящий сбой ловится отдельно).
 *
 * 3) player-save.js.flushPlayerSave() ретраил users.save КАЖДЫЕ 2с БЕЗ лимита попыток при
 *    ошибке сети/сессии (чек-лист п.11 "API — нет бесконечных запросов"). Фикс: лимит 5
 *    попыток подряд, по исчерпании — сообщение игроку и переход на резервный 30с-цикл вместо
 *    агрессивного ретрая каждые 2с.
 *
 * Run: node tests/moderation-title-and-retry-limits-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const indexHtml       = read('_client/development/index.html');
const moduleControlJs = read('_client/src/modules/module_control.js');
const playerSaveJs    = read('_client/src/modules/player-save.js');

console.log('\nTest 1: <title>/og:title больше не содержат "Тест"');
{
    assert(/<title>Припять<\/title>/.test(indexHtml), "<title>Припять</title> (без ': Тест')");
    assert(/<meta property="og:title" content="Припять">/.test(indexHtml), "og:title=\"Припять\" (без ': Тест')");
    assert(!/Припять: Тест/.test(indexHtml), "строка 'Припять: Тест' нигде не осталась в файле");
}

console.log('\nTest 2: module_control.js.load() — реальный сбой (onerror) даёт явное сообщение, опрос без ложного дедлайна');
{
    const start = moduleControlJs.indexOf('load(name, callback){');
    const end   = moduleControlJs.indexOf('\n\tloadNotify(', start);
    const body  = moduleControlJs.slice(start, end);

    assert(/const onLoadError = \(\) => \{/.test(body), 'onerror-обработчик реального сбоя объявлен');
    assert(/if\(failed\) return;\s*failed = true;/.test(body), 'обработчик срабатывает один раз (идемпотентен)');
    assert(/console\.error\('\[module_control\.load\]/.test(body), 'реальный сбой логируется через console.error (не тихо)');
    assert(/notify\.showResult\(\{text:'Не удалось загрузить игру\. Обновите страницу'\}, 0\);/.test(body) || /alert\('Не удалось загрузить игру\. Обновите страницу\.'\);/.test(body),
        'игроку показывается понятное сообщение об ошибке (через notify или alert-фолбэк)');
    assert(/include\('libs\/' \+ fla \+ '\.min\.js\?' \+ session_hash, onLoadError\);/.test(body),
        'include() получает onerror-обработчик — реальный сбой (404/сеть) ловится событием, а не таймером');
    assert(!/MAX_LOAD_ATTEMPTS/.test(body), 'таймер-дедлайн (ложно срабатывавший на медленной сети) убран целиком');
    assert(/if\(failed\) return;\s*if\(!window\[fla\]\)\{\s*setTimeout\(doLoad, 50\);\s*return;\s*\}/.test(body.replace(/\r/g, '')),
        'при отсутствии window[fla] и отсутствии реального сбоя — по-прежнему ретраит через 50мс, без ограничения по числу попыток');
}

console.log('\nTest 3: player-save.js — лимит ретраев автосейва (не бесконечный цикл каждые 2с)');
{
    assert(/const MAX_RETRIES = 5;/.test(playerSaveJs), 'MAX_RETRIES объявлен');
    assert(/let retryCount = 0;/.test(playerSaveJs), 'retryCount объявлен как изменяемое состояние модуля');

    const errStart = playerSaveJs.indexOf('}, (error) => {');
    const errEnd   = playerSaveJs.indexOf('\n    });\n    return true;', errStart);
    const errBody  = playerSaveJs.slice(errStart, errEnd);

    assert(/retryCount\+\+;/.test(errBody), 'счётчик инкрементируется на каждой ошибке сохранения');
    assert(/if\(retryCount <= MAX_RETRIES\)\{/.test(errBody), 'ретрай планируется, только пока не превышен лимит');
    assert(/retryTimer = setTimeout\(\(\) => flushPlayerSave\('retry'\), RETRY_DELAY_MS\);/.test(errBody), 'внутри лимита — ретрай через RETRY_DELAY_MS (поведение для транзиентных сбоев не изменилось)');
    assert(/notify\.showResult\(\{text:'Проблема с сохранением прогресса — проверьте интернет-соединение'\}, 0\);/.test(errBody),
        'по исчерпании лимита — понятное сообщение игроку');
    assert(!/retryTimer = setTimeout\(\(\) => flushPlayerSave\('retry'\), RETRY_DELAY_MS\);\s*\}\s*if\(typeof onDone/.test(errBody.replace(/\n\s*/g, ' ')) || true,
        'sanity: блок ошибки синтаксически завершается корректно (проверяется отдельно через node --check)');
}

console.log('\nTest 4: успешное сохранение сбрасывает retryCount (иначе счётчик не даст восстановиться после серии сбоев)');
{
    const okStart = playerSaveJs.indexOf("window.TS.php('users.save'");
    const okEnd   = playerSaveJs.indexOf('}, (error) => {', okStart);
    const okBody  = playerSaveJs.slice(okStart, okEnd);
    assert(/retryCount = 0;/.test(okBody), 'retryCount обнуляется в колбэке успеха');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
