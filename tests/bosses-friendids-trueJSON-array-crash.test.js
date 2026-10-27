/**
 * Test: 26.10.2026 — прод-репорт, /var/log/php_errors.log, 54+ падений за день, систематически
 * uid=63547944:
 *
 *   PHP Fatal error: Uncaught TypeError: explode(): Argument #2 ($string) must be of type
 *   string, array given in server/core/controllers/bosses.php (_friendIds())
 *
 * Корень: Database::trueJSON() (server/core/models/database.php) для таблицы users не находит
 * файл-сэмпл (server/core/samples/tables/ пуст) и попадает в "ручную" ветку, которая превращает
 * ЛЮБОЕ поле (кроме явного списка строковых исключений, где 'friends' не числится) в ПУСТОЙ
 * МАССИВ [], если сырое значение в БД — NULL, '' или "0". Для игрока, который не выдал доступ
 * к списку друзей ВК (friends_scope_granted != 1), поле friends в БД ровно такое — это обычное,
 * не редкое состояние. Тот же класс бага, что уже чинили для dev_force_N/nick/energy (см.
 * комментарии в database.php и память агента incident_devforce_array_truejson.md), просто для
 * ДРУГОГО поля, которое туда ещё не попадало.
 *
 * Из 7 мест вызова _friendIds() в bosses.php 6 защищены проверкой !empty($user['friends'])
 * перед вызовом (при [] она просто не даёт дойти до _friendIds()). Ровно одно — rating() —
 * этой проверки не имело, поэтому голый explode(',', $user['friends']) падал на массиве.
 *
 * Фикс — два слоя:
 *   1. rating() получил пропущенную проверку !empty($me['friends']) (как у остальных 6 мест).
 *   2. _friendIds() сама стала безопасной к обоим форматам (строка ИЛИ массив) — защита в
 *      глубину, чтобы та же трубная бомба trueJSON() не взорвалась на будущем месте вызова,
 *      которое забудут обвязать проверкой.
 *
 * Этот тест реально ИСПОЛНЯЕТ _friendIds() через Reflection (не grep по тексту файла) — PHP-код
 * вынесен в отдельный .php файл (tests/_php_fixtures/bosses-friendids-array-crash.php), не
 * встроен JS template literal'ом, по той же причине, что и другие такие тесты в проекте: PHP
 * активно использует обратные кавычки для имён SQL-колонок, которые ломают JS template literals
 * той же обратной кавычкой.
 *
 * Если локального PHP нет — тест мягко пропускается (exit 0, предупреждение), см. tests/_php_bin.js.
 *
 * Run: node tests/bosses-friendids-trueJSON-array-crash.test.js
 */
const path = require('path');
const { findPhpBin } = require('./_php_bin.js');
const { execFileSync } = require('child_process');

let passed = 0, failed = 0;

const phpBin = findPhpBin();
if (!phpBin) {
    console.log('⚠️  PHP не найден локально — тест реального исполнения PHP пропущен (это не провал, см. tests/_php_bin.js). Прогнать с PHP: положить портативный в ~/tools/php/php.exe, или задать PHP_BIN=путь.');
    process.exit(0);
}

const fixture = path.join(__dirname, '_php_fixtures', 'bosses-friendids-array-crash.php');

let stdout;
try {
    stdout = execFileSync(phpBin, ['-d', 'display_errors=stderr', fixture], { encoding: 'utf-8', timeout: 15000 });
} catch (e) {
    console.error('❌ PHP-скрипт упал (фатальная ошибка) — именно это и ловит этот тест:');
    console.error(e.stderr || e.message);
    process.exit(1);
}

stdout.trim().split('\n').forEach(line => {
    if (line.startsWith('PASS:')) { console.log('  ✅', line.slice(6)); passed++; }
    else if (line.startsWith('FAIL:')) { console.error('  ❌ FAIL:', line.slice(6)); failed++; }
    else if (line.startsWith('EXCEPTION:')) console.error('  ', line);
    else if (line.startsWith('===')) console.log('\n' + line.replace(/=== | ===/g, ''));
    else if (line.trim()) console.log('  ', line);
});

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed (реальное исполнение PHP ${phpBin})`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
