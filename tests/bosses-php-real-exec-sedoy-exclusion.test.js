/**
 * Test: 04.10.2026 — реальное исполнение _ratingTop() (bosses.php) через fake $link, который
 * ЗАПИСЫВАЕТ фактически сгенерированный SQL. Проверяет две вещи, которые регекс-тест по тексту
 * файла не ловит: (1) `is_sedoy`=0 реально присутствует в запросах, которые _ratingTop() В ЭТОТ
 * РАЗ построил для урона "моего" и урона друга — не просто где-то лежит в файле; (2) для Соло
 * (diffIdx=3) запрос урона друзей вообще не выполняется (gate до SQL, не после) — друг с
 * огромным "подсунутым" уроном в моке физически не может просочиться.
 *
 * Живой smoke-тест (по образцу smoke_test_vk.js) для этого конкретного пути оказался
 * непропорционально дорогим: useSedoy() требует sedoy_dmg_left > 0, которое недоступно ни через
 * users.save (поле убрано из client-writable whitelist 26.09.2026), ни через dev-эндпоинты
 * (devGrantCurrency — только coins/stew/cigarettes) — только через полный цикл
 * habar.buy()+habar.collectDay() с реальной покупкой контейнера и кулдауном. Реальное исполнение
 * PHP с фейковым $link даёт ту же гарантию (настоящий код, настоящий SQL), без этого разгона.
 *
 * См. tests/_php_fixtures/bosses-sedoy-exclusion-core.php — сам фикстурный PHP-скрипт.
 * Если локального PHP нет — тест мягко пропускается (exit 0), см. tests/_php_bin.js.
 *
 * Run: node tests/bosses-php-real-exec-sedoy-exclusion.test.js
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

const fixture = path.join(__dirname, '_php_fixtures', 'bosses-sedoy-exclusion-core.php');

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
