/**
 * Test: 09.10.2026 — реальное исполнение users.php._sanitizeBossesData() (прямой вызов метода,
 * Reflection не нужен, метод public). По прямому указанию пользователя ("переживаю что игроки
 * могут читерить") найдена дыра: bosses_data был в whitelist users.save() БЕЗ валидации с
 * 17.09.2026 — тот самый JSON-блоб, про который предупреждал комментарий того же дня ("требует
 * отдельной, более глубокой валидации схемы"), но валидация так и не была написана. keys[]
 * (валюта похода на босса) и dailyKills/killsTotal/medalKills (лимит попыток/статистика, которые
 * bosses.php.startFight() читает НАПРЯМУЮ из этого же поля) можно было подделать ОДНИМ
 * users.save({bosses_data: JSON.stringify({keys:[999,...]})}) из консоли браузера.
 *
 * См. tests/_php_fixtures/users-sanitize-bosses-data-currency-guard.php.
 * Если локального PHP нет — тест мягко пропускается (exit 0), см. tests/_php_bin.js.
 *
 * Run: node tests/users-php-real-exec-sanitize-bosses-data-currency-guard.test.js
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

const fixture = path.join(__dirname, '_php_fixtures', 'users-sanitize-bosses-data-currency-guard.php');

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

// Структурная проверка: сам по себе валидатор бесполезен, если save() его не вызывает —
// подтверждаем, что guard реально подключён к конвейеру $jsonBlobGuards, а не просто существует
// как мёртвый код (та же проверка проводилась бы и для _sanitizeWeapons/_sanitizeInventory).
const fs = require('fs');
const usersSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'users.php'), 'utf-8');

console.log('\nСтруктурная проверка: _sanitizeBossesData() подключена к $jsonBlobGuards и $current подтягивает bosses_data');
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}
assert(/\$jsonBlobGuards\s*=\s*\['weapons' => '_sanitizeWeapons', 'inventory' => '_sanitizeInventory', 'bosses_data' => '_sanitizeBossesData'\];/.test(usersSrc),
    "'bosses_data' => '_sanitizeBossesData' зарегистрирован в \$jsonBlobGuards — не просто написанная, но неподключённая функция");
assert(/isset\(\$incoming\['weapons'\]\) \|\| isset\(\$incoming\['inventory'\]\) \|\| isset\(\$incoming\['bosses_data'\]\)/.test(usersSrc),
    "SELECT текущего состояния выполняется, когда клиент присылает bosses_data (иначе guard сравнивал бы с пустым \$current и пропускал бы ЛЮБОЕ значение keys как 'новое')");
assert(/\['weapons', 'inventory', 'bosses_data', 'ammo_auto', 'ammo_gun', 'ammo_machete'\]/.test(usersSrc),
    "bosses_data реально включена в список колонок SELECT");

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed (реальное исполнение PHP ${phpBin})`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
