/**
 * Test: 04.10.2026, аудит проекта ("пройдись по всему проекту, найди дыры/важные тесты") нашёл
 * AchievementEngine::checkAll() (server/core/models/achievementengine.php) — реальный расчёт
 * очков достижений (achievement_stars) и rollover-начисление патронов ящика (bullets, каждые 50
 * очков достижений = 1 патрон) — С НУЛЕВЫМ покрытием тестами. Это активная экономика: функция
 * вызывается КАЖДЫЙ раз, когда achievements.php.sync() проверяет прогресс игрока против 300+
 * порогов каталога, и реально списывает/начисляет игровые ресурсы (патроны).
 *
 * Метод статический, не трогает $link/БД (принимает $catalog обычным массивом) — поэтому
 * тестируется РЕАЛЬНЫМ исполнением без моков mysqli, только с минимальным фейковым Gameops
 * (i()/j() с той же сигнатурой). PHP-код — в tests/_php_fixtures/achievementengine-checkall-
 * core.php (не встроен JS-строкой — та же причина, что у остальных PHP-фикстур: обратные
 * кавычки/бэктики в PHP-коде ломают JS template literals).
 *
 * Покрыто: базовое начисление очков, непересечённый порог не засчитывается, уже earned
 * достижение не дублирует очки, revoked-достижение не возвращается, rollover ach_score→bullets
 * (1 патрон/50 очков, несколько патронов за проход, остаток сохраняется, УЖЕ накопленный до
 * этого прохода ach_score учитывается), безопасность _getPath() на несуществующем пути.
 *
 * Если локального PHP нет — тест мягко пропускается (exit 0), не ломая прогон на машине без PHP.
 *
 * Run: node tests/achievementengine-checkall-real-exec.test.js
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

const fixture = path.join(__dirname, '_php_fixtures', 'achievementengine-checkall-core.php');

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
