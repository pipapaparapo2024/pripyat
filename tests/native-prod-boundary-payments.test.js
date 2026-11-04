const {execFileSync}=require('node:child_process'),{findPhpBin}=require('./_php_bin.js');const php=findPhpBin();if(!php)throw new Error('Требуется PHP');
process.stdout.write(execFileSync(php,['tests/_php_fixtures/native-prod-boundary-payments.php'],{encoding:'utf8'}));
