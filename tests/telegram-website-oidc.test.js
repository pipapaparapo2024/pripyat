const {execFileSync}=require('node:child_process');
const {findPhpBin}=require('./_php_bin.js');
const php=findPhpBin();
if(!php)throw new Error('Для OIDC-проверки требуется PHP');
const loaded=execFileSync(php,['-r',"echo extension_loaded('openssl')?'yes':'no';"],{encoding:'utf8'}).trim()==='yes';
process.stdout.write(execFileSync(php,[...(loaded?[]:['-d','extension=openssl']),'tests/_php_fixtures/telegram-website-oidc.php'],{encoding:'utf8'}));
