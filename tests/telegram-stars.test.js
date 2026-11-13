const {execFileSync}=require('node:child_process'),{findPhpBin}=require('./_php_bin');
const assert=require('node:assert/strict'),fs=require('node:fs');
const php=findPhpBin();if(!php)throw new Error('Нужен PHP');
process.stdout.write(execFileSync(php,['tests/_php_fixtures/telegram-stars.php'],{encoding:'utf8'}));
const api=fs.readFileSync('server/telegram-api.php','utf8');
assert.match(api,/if\(!TelegramAccess::canUseStars\(\$external\)\)/,'API must restrict Stars orders/status to verified owner ID');
const entry=fs.readFileSync('_client/src/telegram-entry.js','utf8');
assert.match(entry,/installTelegramPayments\(app,starsCatalog,session\.environment==='prod'\|\|session\.owner_diagnostics===true\)/,'Client payment gate uses verified PROD environment or TEST owner identity');
console.log('Stars: создание/статус счёта закрыты для других допущенных тестеров');
