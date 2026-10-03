/**
 * Test: 18.09.2026 — Gameops::j() падал фатальной TypeError для ЛЮБОГО непустого JSON-поля.
 *
 * Причина: core/samples/tables/*.php физически не существуют (core/samples/ — пустая папка),
 * поэтому Database::trueJSON() всегда идёт по "no sample" ветке, которая для КАЖДОГО непустого
 * JSON-подобного поля молча подменяет сырую строку из БД на уже распарсенный PHP-массив прямо
 * в $user (это уже описано в комментарии zone.js._loadFromUdata: "Database::trueJSON может
 * вернуть JSON-поле уже декодированным объектом"). Gameops::j() передавала $user[$key]
 * напрямую в json_decode() без проверки типа — начиная с PHP 8 передача массива в
 * json_decode(string $json, ...) кидает TypeError (массив не приводится к string), а не
 * просто возвращает null.
 *
 * Живой пострадавший: bosses.php._isLocCleared() читает 'zone' через $this->ops->j(...) —
 * у ЛЮБОГО игрока с непустым прогрессом зоны вызов startFight() падал бы 500-й ошибкой.
 * zone.php сам себя обошёл — там везде ручной is_array()-aware декод, а не Gameops::j().
 *
 * Run: node tests/gameops-j-array-typeerror-fix.test.js
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

const gameopsSrc = readSrc('server/core/models/gameops.php');
const databaseSrc = readSrc('server/core/models/database.php');
const bossesSrc = readSrc('server/core/controllers/bosses.php');

console.log('\nTest 1: Database::trueJSON() действительно не имеет доступа к core/samples/tables (регресс-гвард на сам механизм бага)');
{
    // Папка core/samples/tables/ существует, но пустая — SampleLoader::load('users') ищет
    // КОНКРЕТНЫЙ файл core/samples/tables/users.php, которого там нет.
    const usersSampleFile = path.join(root, 'server', 'core', 'samples', 'tables', 'users.php');
    assert(!fs.existsSync(usersSampleFile),
        'core/samples/tables/users.php по-прежнему не существует — $this->sample всегда false для таблицы users, "no sample" ветка trueJSON() всегда активна. ' +
        'Если этот тест начал падать (файл добавили) — Gameops::j() всё равно теперь безопасна, но стоит перепроверить сам сценарий бага.');
    // 18.09.2026 (аудит безопасности, отдельный от этого фикса): условие обросло
    // "and !$isStringField" — nick/nickname/name/balabol теперь исключены из подмены (см.
    // security-audit-weapons-shmot-bp-tasks-nick.test.js), но для ЛЮБОГО другого JSON-поля
    // механизм не изменился — строка по-прежнему подменяется распарсенным массивом.
    assert(/if \(is_array\(\$value\) and !\$isStringField\) \{/.test(databaseSrc),
        'trueJSON() по-прежнему подменяет строку на распарсенный массив для непустых JSON-полей (механизм бага не изменился, только сама Gameops::j() стала устойчива к этому)');
}

console.log('\nTest 2: Gameops::j() безопасно обрабатывает уже декодированный массив, не падая на json_decode(array)');
{
    const start = gameopsSrc.indexOf('function j($user, $key, $default = []){');
    const end   = gameopsSrc.indexOf('\n    }', start);
    const body  = gameopsSrc.slice(start, end);
    assert(/if\(is_array\(\$user\[\$key\]\)\) return \$user\[\$key\];/.test(body),
        'j() возвращает $user[$key] напрямую, если это УЖЕ массив (не зовёт json_decode на массиве — TypeError с PHP 8)');
    // Проверка порядка: guard на is_array должен идти ДО вызова json_decode, иначе бесполезен.
    const guardIdx  = body.indexOf('if(is_array($user[$key]))');
    const decodeIdx = body.indexOf('json_decode($user[$key]');
    assert(guardIdx !== -1 && decodeIdx !== -1 && guardIdx < decodeIdx,
        'guard на is_array() стоит РАНЬШЕ вызова json_decode() — иначе не защищает');
}

console.log('\nTest 3: bosses.php._isLocCleared() — живой пострадавший вызов — теперь безопасен благодаря фиксу выше');
{
    assert(/\$zoneData = \$this->ops->j\(\$user, 'zone', \[\]\);/.test(bossesSrc),
        '_isLocCleared() по-прежнему читает zone через Gameops::j() — именно этот вызов был бы фатальным до фикса');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
