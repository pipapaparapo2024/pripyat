/**
 * Test: 18.09.2026 — репорт пользователя со скриншотами лидерборда "Топ по авторитету":
 *
 *  1) "Когда я меняю свой никнейм, он не меняется в списке, даже если я перезахожу" —
 *     nick.js._saveNick() менял только локальный udata['nick'] в браузере и вызывал
 *     api.setNick() (VK Bridge, не имеет отношения к нашей БД) — TS.php('users.save', ...)
 *     не вызывался ВООБЩЕ. Ник никогда не долетал до сервера, поэтому topj.php (читает из
 *     БД) продолжал отдавать старое/пустое значение бесконечно.
 *
 *  2) Два реальных аккаунта в топе показывали "[]" вместо ника — последствие уже
 *     исправленного бага database.php.trueJSON() (пустой nick подменялся на массив [],
 *     затем куда-то сохранялся уже как JSON-строка "[]"). Регрессионный тест на то, что
 *     null/nick не подменяется массивом при чтении.
 *
 * Run: node tests/nick-save-persists-to-server.test.js
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

const nickSrc = readSrc('_client/src/game/shell/popups/nick.js');
const dbSrc   = readSrc('server/core/models/database.php');
const topSrc  = readSrc('server/core/controllers/top.php');
const usersSrc= readSrc('server/core/controllers/users.php');

console.log('\nTest 1: nick.js._saveNick() реально сохраняет ник на сервер через users.save');
{
    const start = nickSrc.indexOf('proto._saveNick = function(val){');
    const end   = nickSrc.indexOf('\n\t};', start);
    assert(start !== -1, '_saveNick найден в nick.js');
    const body = nickSrc.slice(start, end);
    assert(/udata\['nick'\]\s*=\s*val;/.test(body), 'локальный udata[\'nick\'] по-прежнему обновляется сразу (для мгновенного отклика UI)');
    assert(/TS\.php\('users\.save',\s*\{udata_json:\s*JSON\.stringify\(udata\)\}/.test(body),
        'ДОБАВЛЕН вызов TS.php(\'users.save\', {udata_json: JSON.stringify(udata)}) — раньше отсутствовал совсем');
    assert(/if\(window\.TS\)/.test(body), 'вызов защищён проверкой на существование window.TS (тот же паттерн, что и везде в проекте)');
}

console.log('\nTest 2: \'nick\' зарегистрирован в whitelist users.php (иначе users.save тихо отбросит поле)');
{
    assert(/'nick'/.test(usersSrc), "'nick' есть в \$allowed whitelist users.php");
}

console.log('\nTest 3: database.php.trueJSON() НЕ подменяет пустой/null nick на массив [] (регрессия)');
{
    const start = dbSrc.indexOf('function trueJSON($array){');
    const end   = dbSrc.indexOf('\n\t\t}', dbSrc.indexOf('return $array;', start));
    const body  = dbSrc.slice(start, end !== -1 ? end : dbSrc.length);
    // 18.09.2026 (аудит безопасности, отдельный от этого фикса): проверки name/balabol/nick/
    // nickname объединены в один флаг $isStringField, используемый в ДВУХ местах (null→[] и
    // is_array($value)→[] — см. security-audit-weapons-shmot-bp-tasks-nick.test.js).
    assert(/\$isStringField\s*=\s*\$keys\[\$i\]\s*===\s*'name'.*\$keys\[\$i\]\s*===\s*'balabol'/s.test(body),
        "'name'/'balabol' по-прежнему часть исключения (регресс-гвард на старое исправление)");
    assert(/\$keys\[\$i\]\s*===\s*'nick'/.test(body),
        "'nick' явно исключён из общей логики \"null -> []\" (иначе strval(nick) даёт строку \"Array\"/JSON \"[]\")");
    assert(/\$keys\[\$i\]\s*===\s*'nickname'/.test(body),
        "'nickname' тоже исключён (на случай использования этого альтернативного поля)");
}

console.log('\nTest 4: top.php отдаёт nick как обычную строку (strval), не как JSON/массив');
{
    assert(/'nick'\s*=>\s*strval\(\$r\['nick'\]\s*\?\?\s*''\)/.test(topSrc),
        "top.get() оборачивает nick в strval(... ?? '') — гарантированно строка, не массив/null");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
