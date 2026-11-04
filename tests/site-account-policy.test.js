const {execFileSync}=require('node:child_process');
const {findPhpBin}=require('./_php_bin.js');
const php=findPhpBin();if(!php)throw new Error('Для проверки аккаунтов сайта требуется PHP');
process.stdout.write(execFileSync(php,['tests/_php_fixtures/site-account-policy.php'],{encoding:'utf8'}));
