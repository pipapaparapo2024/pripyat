/**
 * Test: 04.10.2026 — первый тест в проекте, который РЕАЛЬНО ИСПОЛНЯЕТ server/core/controllers/
 * bosses.php (не grep по тексту файла). Контекст: в этот же вечер нашёлся баг (друзья не
 * попадали в рейтинг урона, хотя их удар честно снижал HP) — три вызывающих места передавали
 * сырой список id друзей ($friendIds) в параметр, который _ratingTop() трактует как карту
 * uid=>effectiveSinceMs ($friendsSince). ВСЕ существующие тесты на эту тему — regex по тексту
 * файла ("вызов содержит такую-то подстроку") — они физически не могли поймать баг такого рода,
 * потому что не исполняют код, а просто ищут ожидаемый текст (который сам же баг и писал).
 *
 * Этот файл — противоядие именно от такого класса багов: PHP-скрипт в
 * tests/_php_fixtures/bosses-friendssince-core.php вызывает НАСТОЯЩИЕ приватные методы
 * _myFightStart()/_friendsSinceMap()/_friendsSinceConds() через Reflection (PHP не даёт звать
 * private напрямую — тот же приём, что private-доступ в unit-тестах других языков), с реальными
 * аргументами, и проверяет РЕАЛЬНЫЙ результат — не текст файла. (PHP-код вынесен в отдельный
 * .php файл, а не встроен JS-строкой — PHP активно использует обратные кавычки для имён колонок
 * в SQL, которые ломают JS template literals той же обратной кавычкой.)
 *
 * Все три метода чистые (ни DB, ни registry/ops не трогают, кроме Gameops::i()/j(), которые тоже
 * чистые — см. gameops.php) — поэтому тест не поднимает MySQL и не мокает mysqli, просто
 * создаёт Bosses с пустым registry и вызывает методы напрямую.
 *
 * Если локального PHP нет — тест мягко пропускается (exit 0, предупреждение), не ломая весь
 * прогон на машине без PHP (см. tests/_php_bin.js).
 *
 * Run: node tests/bosses-php-real-exec-friendssince-core.test.js
 */
const fs   = require('fs');
const path = require('path');
const { findPhpBin } = require('./_php_bin.js');
const { execFileSync } = require('child_process');

let passed = 0, failed = 0;

const phpBin = findPhpBin();
if (!phpBin) {
    console.log('⚠️  PHP не найден локально — тест реального исполнения PHP пропущен (это не провал, см. tests/_php_bin.js). Прогнать с PHP: положить портативный в ~/tools/php/php.exe, или задать PHP_BIN=путь.');
    process.exit(0);
}

const fixture = path.join(__dirname, '_php_fixtures', 'bosses-friendssince-core.php');

let stdout;
try {
    stdout = execFileSync(phpBin, ['-d', 'display_errors=stderr', fixture], { encoding: 'utf-8', timeout: 15000 });
} catch (e) {
    console.error('❌ PHP-скрипт упал (фатальная ошибка):');
    console.error(e.stderr || e.message);
    process.exit(1);
}

stdout.trim().split('\n').forEach(line => {
    if (line.startsWith('PASS:')) { console.log('  ✅', line.slice(6)); passed++; }
    else if (line.startsWith('FAIL:')) { console.error('  ❌ FAIL:', line.slice(6)); failed++; }
    else if (line.startsWith('===')) console.log('\n' + line.replace(/=== | ===/g, ''));
    else if (line.trim()) console.log('  ', line);
});

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed (реальное исполнение PHP ${phpBin})`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
