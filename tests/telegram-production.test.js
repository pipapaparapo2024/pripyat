const {execFileSync}=require('node:child_process');
const {findPhpBin}=require('./_php_bin');
process.stdout.write(execFileSync(findPhpBin(),['tests/_php_fixtures/telegram-production.php'],{encoding:'utf8'}));
