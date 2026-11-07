const {execFileSync}=require('node:child_process'),path=require('node:path');
const {findPhpBin}=require('./_php_bin.js');const php=findPhpBin();if(!php)throw new Error('PHP required');
process.stdout.write(execFileSync(php,[path.join(__dirname,'_php_fixtures/boss-friend-recovery.php')],{encoding:'utf8'}));
