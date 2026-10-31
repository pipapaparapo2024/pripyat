const {execFileSync}=require('node:child_process');const {findPhpBin}=require('./_php_bin.js');
const php=findPhpBin();if(!php)throw new Error('PHP required for launch regression');
process.stdout.write(execFileSync(php,['tests/_php_fixtures/ok-launch742.php'],{encoding:'utf8'}));
