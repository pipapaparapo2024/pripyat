const {execFileSync}=require('node:child_process');const {findPhpBin}=require('./_php_bin.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'erasure-guard-'));const file=path.join(tmp,'ledger.json');
fs.writeFileSync(file,JSON.stringify({entries:{[require('node:crypto').createHash('sha256').update('vk:123').digest('hex')]:true}}));
const php=`require 'server/core/models/erasedaccounts.php'; $p=$argv[1]; ErasedAccounts::assertAllowed('ok',123,$p); ErasedAccounts::assertAllowed('site',123,$p); try{ErasedAccounts::assertAllowed('vk',123,$p);exit(1);}catch(DomainException $e){} echo "Erasure guard: restored ID denied, other worlds allowed\\n";`;
try{process.stdout.write(execFileSync(findPhpBin(),['-r',php,file],{encoding:'utf8'}));}finally{fs.rmSync(tmp,{recursive:true});}
