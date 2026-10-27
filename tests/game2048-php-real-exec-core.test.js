/**
 * Test: 26.10.2026 — реальное исполнение server/core/controllers/game2048.php (новая мини-игра
 * "2048", отдельная вкладка, не часть Двора). Тот же приём, что
 * bosses-php-real-exec-friendssince-core.test.js — вызывает НАСТОЯЩИЕ приватные методы через
 * Reflection, не просто ищет текст в файле. Все протестированные методы (_slideLine,
 * _applyMove, _hasValidMoves, _weightedSpawn, _grantNewThresholds) чистые/почти чистые (не
 * трогают $link, _grantNewThresholds мутирует только переданные по ссылке $user/$session) —
 * не поднимает MySQL, new Game2048([]) с пустым registry.
 *
 * Покрывает самые бага-склонные места классической 2048 (слияние ровно один раз за ход, не
 * цепочкой; направление слайда; детект отсутствия ходов) + экономику ТЗ (идемпотентность
 * награды порога В РАМКАХ партии и доступность заново в НОВОЙ партии — п.4 ТЗ, приёмочный
 * критерий "второй порог 256 не даёт ничего").
 *
 * Если локального PHP нет — тест мягко пропускается (см. tests/_php_bin.js).
 * Run: node tests/game2048-php-real-exec-core.test.js
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

const fixture = path.join(__dirname, '_php_fixtures', 'game2048-core.php');

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
