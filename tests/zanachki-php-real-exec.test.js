/**
 * Test: 26.10.2026 — РЕАЛЬНОЕ исполнение server/core/models/zanachkimodel.php (не grep по
 * тексту). Тот же паттерн, что raznaryadka-php-real-exec.test.js (см. AGENTS.md "Реальное
 * исполнение PHP в тестах") — PHP-код в отдельном файле (tests/_php_fixtures/zanachki-core.php),
 * методы ZanachkiModel статические и не трогают $link/registry — вызываются напрямую, без
 * ReflectionMethod и без мока (тот же класс "чистая логика на входных данных", что
 * _rollWeapons()/_friendsSinceMap() в ryukzak.php/bosses.php, см. AGENTS.md).
 *
 * Если локального PHP нет — тест мягко пропускается (exit 0), см. tests/_php_bin.js.
 *
 * Run: node tests/zanachki-php-real-exec.test.js
 */
const path = require('path');
const { findPhpBin } = require('./_php_bin.js');
const { execFileSync } = require('child_process');

let passed = 0, failed = 0;

const phpBin = findPhpBin();
if (!phpBin) {
    console.log('⚠️  PHP не найден локально — тест реального исполнения PHP пропущен (не провал). Прогнать с PHP: ~/tools/php/php.exe или PHP_BIN=путь.');
    process.exit(0);
}

const fixture = path.join(__dirname, '_php_fixtures', 'zanachki-core.php');

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
