/**
 * Test: 04.10.2026 — реальное исполнение users.php._sanitizeWeapons() (вызывается прямо, метод
 * public, Reflection не нужен) — регресс-тест на баг 28.09.2026: игрок без единой покупки/
 * прокачки оружия получал отклонённое ЛЮБОЕ users.save с полем weapons, потому что бесплатные
 * слоты 0-2 (нож/цепь/бита) читались как "эскалация" owned false→true. Заодно проверяет, что
 * фикс (принудительный curOwned=true для i<3) НЕ ослабил защиту для платного оружия и
 * qty/upg-эскалации — тот класс читерства, ради которого _sanitizeWeapons() вообще существует.
 *
 * См. tests/_php_fixtures/users-sanitize-weapons-free-slots-invariant.php.
 * Если локального PHP нет — тест мягко пропускается (exit 0), см. tests/_php_bin.js.
 *
 * Run: node tests/users-php-real-exec-sanitize-weapons-free-slots.test.js
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

const fixture = path.join(__dirname, '_php_fixtures', 'users-sanitize-weapons-free-slots-invariant.php');

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
