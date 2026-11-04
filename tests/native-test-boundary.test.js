const {execFileSync}=require('node:child_process');const {findPhpBin}=require('./_php_bin.js');
const php=findPhpBin();if(!php)throw new Error('Для проверки TEST требуется PHP');
process.stdout.write(execFileSync(php,['tests/_php_fixtures/native-test-boundary.php'],{encoding:'utf8'}));
