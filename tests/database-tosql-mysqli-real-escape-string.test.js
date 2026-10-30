/**
 * Test: 24.09.2026, продолжение поиска в poker-blackjack-session-unescaped-unicode-cyrillic-ranks.test.js.
 *
 * Тот регресс-тест точечно закрыл конкретное проявление (json_encode() без JSON_UNESCAPED_UNICODE
 * в poker.php/blackjack.php), но КОРНЕВАЯ причина жила в database.php::toSQL() — значения
 * вставлялись в SQL-литерал голой конкатенацией ("`col`='".implode('', (array)$values[$i])."'"),
 * без mysqli_real_escape_string() и без prepared statements. Любой буквальный `\` или `'` в
 * значении (не только "\uXXXX" от кириллицы) MySQL при INSERT интерпретирует как escape-символ
 * литерала и молча портит строку при следующем чтении — тот же класс бага мог повториться в
 * любом другом месте кода, которое пишет через saveData()/toSQL(), а не только в poker/blackjack.
 *
 * Фикс: экранировать значение через mysqli_real_escape_string($this->link, ...) перед вставкой
 * в литерал. Ветка "сырого SQL-выражения" (`gold`=`gold`+1, count(explode("`", ...)) > 1)
 * намеренно НЕ экранируется — это доверенный код-сгенерированный SQL-фрагмент, не пользовательские
 * данные.
 *
 * Run: node tests/database-tosql-mysqli-real-escape-string.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const dbSrc = fs.readFileSync(path.join(root, 'server', 'core', 'models', 'database.php'), 'utf-8');

const toSqlMatch = dbSrc.match(/function toSQL\(\$array\)\{[\s\S]*?\n\t\t\}/);
if (!toSqlMatch) {
    console.error('  ❌ FAIL: не нашёл функцию toSQL() в database.php — возможно, изменилась сигнатура');
    failed++;
} else {
    const body = toSqlMatch[0];

    assert(body.includes("$this->link->real_escape_string("), "Все значения экранируются");
    assert(!body.includes("count(explode"), "Нет автоматического исполнения SQL из значения");
    assert(body.includes("Invalid column"), "Имена колонок проверяются");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
