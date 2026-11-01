const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{findPhpBin}=require('./_php_bin.js');
const output=execFileSync(findPhpBin(),['tests/_php_fixtures/habar-midnight748.php'],{encoding:'utf8'});
const cases=JSON.parse(output.split('\n').find(line=>line.startsWith('MIDNIGHT_CASES=')).slice('MIDNIGHT_CASES='.length));
const ctx={};vm.runInNewContext(fs.readFileSync('_client/src/modules/habar-progress.js','utf8').replace(/export function/g,'function')+';this.end=habarExpiresAtMs;this.day=habarElapsedDay;',ctx);
for(const row of cases){assert.equal(ctx.end(row.start),row.end);assert.equal(ctx.day(row.start,row.end-1),29);assert.equal(ctx.day(row.start,row.end),30);}
assert.equal(ctx.end(0),0);assert.equal(ctx.end(NaN),0);assert.equal(ctx.end(Date.now(),0),0);
process.stdout.write(output.replace(/^MIDNIGHT_CASES=.*\n/m,''));
