const {execFileSync}=require('node:child_process');
const {findPhpBin}=require('./_php_bin.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
for(const mode of ['missing','enroll','wrong_user','valid_session','rotated','success','replay','limited','csrf','auth_partial','auth_full','auth_expired']){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rewards-gate-'));
 try{
 const output=execFileSync(findPhpBin(),['tests/_php_fixtures/rewards-gate.php',mode,dir],{encoding:'utf8'});
 const result=JSON.parse(fs.readFileSync(path.join(dir,'result.json')));
 if(mode==='enroll'){assert(output.includes('otpauth://totp/Pripyat:admin?secret='));assert(output.includes('/rewards-admin/qrcode-generator-2.0.4.js'));}
 if(mode==='auth_partial')assert(output.includes('otpauth://totp/Pripyat:admin?secret='));
 if(mode==='valid_session'||mode==='auth_full')assert.equal(output,'ALLOWED');
 else if(mode==='success'){assert.equal(result.status,303);assert.equal(result.session.totp_user,'admin');assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'state.json'))).enabled,true);}
 else {assert.equal(result.status,{missing:503,enroll:403,wrong_user:503,rotated:403,replay:403,limited:429,csrf:403,auth_partial:403,auth_expired:303}[mode]);assert(!output.includes('ALLOWED'));}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
console.log('TOTP gate: enrollment, sessions, key rotation, replay, rate limit, CSRF and fail-closed passed');
