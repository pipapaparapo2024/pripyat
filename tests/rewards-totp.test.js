const {execFileSync}=require('node:child_process');
const {findPhpBin}=require('./_php_bin.js');
const php=findPhpBin();if(!php)throw new Error('PHP required');
process.stdout.write(execFileSync(php,['tests/_php_fixtures/rewards-totp.php'],{encoding:'utf8'}));
