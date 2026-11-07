const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('_client/src/modules/platform.js','utf8').replace(/export /g,'');
for(const platform of ['site','vk','ok']){
 const scope={window:{__siteRuntime:{platform}}};vm.runInNewContext(source+';this.names=currencyNames();',scope);assert.deepEqual(Array.from(scope.names),['₽','₽','₽']);
}
const prices=JSON.parse(fs.readFileSync('server/json/site_prices.json','utf8'));assert.deepEqual(prices.stew,[7,21,42,140,350,700,3500,7000]);assert.equal(prices.energy[6],595);
console.log('Website: RUB regardless of social login, approved catalog preserved');
