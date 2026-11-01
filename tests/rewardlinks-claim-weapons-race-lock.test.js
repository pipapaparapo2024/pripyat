// Реальное исполнение claim с транзакционной фиктивной БД вместо проверки прежней схемы saveUser.
const {execFileSync}=require('node:child_process');
const {findPhpBin}=require('./_php_bin.js');
process.stdout.write(execFileSync(findPhpBin(),['tests/_php_fixtures/rewardlinks750.php'],{encoding:'utf8'}));
