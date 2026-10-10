/**
 * Реально запускает PHP-регресс порядка транзакций claimKill().
 * Run: node tests/bosses-php-real-exec-claimkill-transaction-order.test.js
 */
const path = require('path');
const { execFileSync } = require('child_process');
const { findPhpBin } = require('./_php_bin.js');

const phpBin = findPhpBin();
if (!phpBin) {
    console.log('⚠️  PHP не найден локально — PHP-регресс пропущен.');
    process.exit(0);
}

const fixture = path.join(__dirname, '_php_fixtures', 'bosses-claimkill-transaction-order.php');
let output;
try {
    output = execFileSync(phpBin, ['-d', 'display_errors=stderr', fixture], { encoding: 'utf8', timeout: 15000 });
} catch (error) {
    console.error(error.stderr || error.message);
    process.exit(1);
}

process.stdout.write(output);
if (/^FAIL:/m.test(output)) process.exit(1);
console.log('✅ PHP-регресс порядка транзакций claimKill пройден');
