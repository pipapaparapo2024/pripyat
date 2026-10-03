/**
 * Test: бесплатный ежедневный бросок в зариках — серверная сторона (16.09.2026, возвращён по
 * прямому указанию пользователя после подтверждения, что прошлый убравший его фикс был про
 * другую проблему — тихое списание рублей вместо честной проверки поинта). Клиентская логика
 * и текст таймера уже покрыты в run_tests.js; здесь — whitelist/миграция/сброс аккаунта.
 *
 * Run: node tests/dice-free-throw-server-and-reset.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const usersPhp   = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const migrate14  = fs.readFileSync(path.join(root, 'server', 'migrate14.php'), 'utf-8');
const devPanelSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');

console.log('\nTest 1: dice_free_ts сохраняется на сервере и есть колонка под него');
{
    assert(/'dice_free_ts'/.test(usersPhp), "'dice_free_ts' есть в whitelist users.php — иначе не сохранится вообще");
    assert(/ALTER TABLE `\{\$registry\['utb'\]\}` ADD COLUMN `\$col` \$def/.test(migrate14) && /\$col = 'dice_free_ts'/.test(migrate14),
        'migrate14.php добавляет колонку dice_free_ts');
}

console.log('\nTest 2: сброс аккаунта обнуляет dice_free_ts (снова доступен бесплатный бросок)');
{
    assert(/dice_free_ts:'0'/.test(devPanelSrc), "_resetAccount включает dice_free_ts:'0' в дефолты");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
