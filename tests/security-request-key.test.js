const assert=require('assert');
const path=require('path');
const {execFileSync}=require('child_process');
const {findPhpBin}=require('./_php_bin');
const php=findPhpBin();assert(php,'PHP required for security regression');
process.stdout.write(execFileSync(php,['-d','display_errors=stderr',path.join(__dirname,'_php_fixtures/security-request-key.php')],{encoding:'utf8',timeout:15000}));
