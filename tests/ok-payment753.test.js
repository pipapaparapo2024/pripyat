const {execFileSync}=require('node:child_process'),{findPhpBin}=require('./_php_bin.js');
process.stdout.write(execFileSync(findPhpBin(),['tests/_php_fixtures/ok-payment753.php'],{encoding:'utf8'}));
