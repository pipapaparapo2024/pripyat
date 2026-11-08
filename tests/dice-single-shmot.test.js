const {execFileSync}=require('node:child_process'),path=require('node:path');const {findPhpBin}=require('./_php_bin.js');
process.stdout.write(execFileSync(findPhpBin(),[path.join(__dirname,'_php_fixtures/dice-single-shmot.php')],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
