const {execFileSync}=require('node:child_process');
const {findPhpBin}=require('./_php_bin');
const php=findPhpBin();if(!php)throw new Error('Требуется PHP');
process.stdout.write(execFileSync(php,['-d','extension=sodium','tests/_php_fixtures/site-phone-identity.php'],{encoding:'utf8'}));
