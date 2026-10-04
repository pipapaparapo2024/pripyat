/**
 * Test: 04.10.2026 — контрактный тест фикса гонки boss_fight_session (_syncFightSessionLocked()/
 * _commitFightSession() в bosses.php, добавлены при разборе "друг бьёт, HP кэша не падает" на
 * реальных данных прод-БД). НЕ воспроизводит настоящую многопоточную гонку (см. подробное
 * объяснение ограничения в самом PHP-фикстурном файле) — проверяет контракт, без которого фикс
 * не работал бы: каждый read-under-lock реально видит результат предыдущего commit, несколько
 * последовательных циклов корректно компонуются (урон не теряется), транзакции не утекают.
 *
 * См. tests/_php_fixtures/bosses-fight-session-lock-contract.php.
 * Если локального PHP нет — тест мягко пропускается (exit 0), см. tests/_php_bin.js.
 *
 * Run: node tests/bosses-php-real-exec-fight-session-lock.test.js
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

const fixture = path.join(__dirname, '_php_fixtures', 'bosses-fight-session-lock-contract.php');

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
