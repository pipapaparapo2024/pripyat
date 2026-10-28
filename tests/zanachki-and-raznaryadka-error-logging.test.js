/**
 * Test: 28.10.2026, по прямому указанию (ПРАВИЛО №8 — подробное логирование) — две серверные
 * правки, связанные с расследованием двух багов этого дня:
 *
 * 1) zanachki.php::giveCard() — ни одна fail-ветка не логировалась (только успех), из-за чего
 *    "кнопка ОТПРАВИТЬ ничего не делает" было невозможно диагностировать по логам сервера.
 *    Теперь каждая fail-ветка (54/93/99/91/код из ZanachkiModel) пишет в error_log.
 *
 * 2) raznaryadka.php::getState() — та же проблема (fail-ветки молчали) плюс отсутствовала защита
 *    от фатальных исключений. Всё тело метода обёрнуто в try/catch НА МЕСТЕ (без вынесения в
 *    отдельный метод — это разорвало бы текстовый поиск "внутри getState()" в нескольких уже
 *    существующих тестах, см. raznaryadka-pre-launch-no-failed-days.test.js).
 *
 * Run: node tests/zanachki-and-raznaryadka-error-logging.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\nTest 1: zanachki.php::giveCard() — каждая fail-ветка логируется');
{
    const src = readSrc('server/core/controllers/zanachki.php');
    const start = src.indexOf('function giveCard(){');
    const end = src.indexOf('\n        }\n\n        // ── DEV-ПАНЕЛЬ');
    const body = src.slice(start, end);
    assert(start !== -1 && end !== -1, 'giveCard() найден целиком');
    assert(/error_log\('\[Zanachki\.giveCard\] FAIL 54/.test(body), 'код 54 (targetId<=0) логируется');
    assert(/error_log\('\[Zanachki\.giveCard\] FAIL 93/.test(body), 'код 93 (targetId===uid) логируется');
    assert(/error_log\('\[Zanachki\.giveCard\] FAIL 99 \(loadUser giver\)/.test(body), 'код 99 (loadUser) логируется');
    assert(/error_log\('\[Zanachki\.giveCard\] FAIL 91/.test(body), 'код 91 (getData target) логируется');
    assert(/error_log\('\[Zanachki\.giveCard\] FAIL ' \. \$giveResult \. ' \(ZanachkiModel::giveCard\)/.test(body),
        'код ошибки из ZanachkiModel::giveCard (87/97/98) логируется с конкретным значением');
    assert(/error_log\('\[Zanachki\.giveCard\] FAIL 99 \(saveUser giver\)/.test(body), 'код 99 (saveUser) логируется');
    assert(/error_log\('\[Zanachki\.giveCard\] uid=/.test(body), 'успешный путь по-прежнему логируется (не регрессия)');
}

console.log('\nTest 2: raznaryadka.php — getState() целиком обёрнут в try/catch (без вынесения в отдельный метод)');
{
    const src = readSrc('server/core/controllers/raznaryadka.php');
    const start = src.indexOf('function getState(){');
    const end = src.indexOf('\n        function claim(){');
    assert(start !== -1 && end !== -1, 'getState() найден целиком');
    const body = src.slice(start, end);
    assert(/try \{\s*\n\s*\$user = \$this->ops->loadUser\(\);/.test(body), 'try{ открывается сразу перед прежним первым действием метода');
    assert(/\} catch \(\\Throwable \$e\) \{/.test(body), 'catch (\\Throwable) закрывает тело метода');
    assert(/error_log\('\[Raznaryadka\.getState\] EXCEPTION uid=' \. abs\(intval\(\$this->registry\['uid'\] \?\? 0\)\) \. ' \| ' \. get_class\(\$e\)/.test(body),
        'любое исключение логируется с классом/сообщением/файлом/строкой');
    assert(/return \$this->ops->fail\(99\);\s*\n\s*\}\s*\n\s*\}/.test(body), 'catch-ветка возвращает fail(99) и корректно закрывает функцию');
    // Регресс-гвард: прежняя логика (используется другими тестами через текстовый поиск "внутри
    // getState()") должна остаться БУКВАЛЬНО внутри этой же функции, не переехать в другой метод.
    assert(/\$featureLive = !\$launchMonth \|\| \$data\['month'\] >= \$launchMonth;/.test(body),
        'featureLive по-прежнему вычисляется прямо внутри getState() (не вынесено)');
    assert(/\$this->ops->ok\(\[/.test(body), 'успешный ответ ok([...]) по-прежнему строится прямо внутри getState()');
    assert(/\$this->permits = \['getState', 'claim',/.test(src),
        'permits по-прежнему ссылается только на публичный "getState"');
    assert(/error_log\('\[Raznaryadka\.getState\] FAIL 99 \(loadUser\)/.test(body), 'fail-ветка loadUser логируется');
    assert(/error_log\('\[Raznaryadka\.getState\] FAIL 99 \(saveUser\)/.test(body), 'fail-ветка saveUser логируется');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
