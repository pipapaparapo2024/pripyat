/**
 * Test: 04.10.2026 — реальное исполнение Users::save() (не Reflection — все методы вовлечены
 * public) с фейковым $udb, перехватывающим то, что РЕАЛЬНО улетело бы в SQL UPDATE. Регресс-тест
 * на 5 критичных дыр, найденных полным аудитом проекта по прямому указанию ("пройдись по всему
 * проекту, найди дыры"): 'zone'/'base_buildings'/'base_stats'/'gang_id'/'zone_collect_0..4' были
 * в client-writable whitelist БЕЗ guard — один users.save с подделанным zone/base_buildings/gang_id мог
 * дать максимальный бизнес/здание/банду с боевым бонусом без единой реальной покупки/вступления;
 * zone_collect_0..4 позволял сбросить 8ч-кулдаун сбора дохода бизнеса на null-команду.
 *
 * См. tests/_php_fixtures/users-save-whitelist-removed-fields.php.
 * Если локального PHP нет — тест мягко пропускается (exit 0), см. tests/_php_bin.js.
 *
 * Run: node tests/users-php-real-exec-save-whitelist-holes-closed.test.js
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

const fixture = path.join(__dirname, '_php_fixtures', 'users-save-whitelist-removed-fields.php');

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
