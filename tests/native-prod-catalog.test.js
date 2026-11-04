const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{findPhpBin}=require('./_php_bin.js');
const php=findPhpBin();if(!php)throw new Error('Требуется PHP');
for(const scenario of ['vk','ok','site-game','site-native','site-ok-app','site-ok-app-wrong-site','site-other-app','site-wrong-native','site-vk-conflict','site-unknown','site-tampered','other-native','other-ok-app','tampered-native','missing','wrong-app','forged']){
 const reply=JSON.parse(execFileSync(php,['tests/_php_fixtures/native-prod-catalog.php',scenario],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 if(['vk','ok','site-game','site-native','site-ok-app'].includes(scenario)){
  assert(reply.response,scenario);assert.equal(reply.response.item_id,scenario==='vk'?0:scenario==='ok'?'ok_item0':'item0');
  assert.equal(reply.response.price,scenario==='vk'?1:7);assert(!reply.response.title.includes('TEST'));
 }else {assert(reply.error,scenario+' must be denied');if(scenario==='site-tampered')assert(reply.error.error_msg.includes('invalid_signature'));}
}
console.log('Каталог PROD: ВК/ОК, подписанный native ID, app ID, подмена, отсутствующая связь и подпись проверены без БД');
