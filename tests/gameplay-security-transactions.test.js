const path = require('path');
const { execFileSync } = require('child_process');
const { findPhpBin } = require('./_php_bin');
const php = findPhpBin();

if (!php) {
    console.log('PHP не найден, проверка транзакций пропущена.');
} else {
    const fixture = path.join(__dirname, '_php_fixtures', 'gameplay-security-transactions.php');
    const result = execFileSync(php, ['-n', fixture], { encoding: 'utf8', timeout: 15000 });
    console.log(result.trim());
}
