const {execFileSync}=require('node:child_process'),{findPhpBin}=require('./_php_bin');
const php=findPhpBin();if(!php)throw new Error('Требуется PHP');
process.stdout.write(execFileSync(php,['tests/_php_fixtures/telegram-bot.php'],{encoding:'utf8'}));
