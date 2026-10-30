const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const udata={stash_data:{1:{1:999}},stash_claims:{1:true,2:10,_gifts:{day:'2026-11-01',to:{42:10}}}};
const context=vm.createContext({udata,window:{},console:{log(){}},attachAchievementPopup(){},helper:{safeParseJSON(v,fallback){return typeof v==='string'?JSON.parse(v):v||fallback;}}});
const source=fs.readFileSync(path.join(root,'_client/src/game/achievements.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export default class','class');
vm.runInContext(source+'\nthis.obj=new Achievements();',context);
const state=context.obj._state();assert.strictEqual(state.stash.k_lezv,1);assert.strictEqual(state.stash.k_lyub,10);
assert.strictEqual(state.stash.k_avto,0,'owned cards must not count as exchanged collections');
const actual=context.obj.list.filter(a=>a.cat==='stash');
const expected=JSON.parse(fs.readFileSync(path.join(root,'server/json/achievements_config.json'),'utf8')).filter(a=>a.cat==='stash');
assert.strictEqual(actual.length,30);
for(const entry of actual){
    const server=expected.find(a=>a.id===entry.id);assert(server);
    for(const key of ['name','pts','threshold'])assert.strictEqual(entry[key],server[key]);
    assert.strictEqual(JSON.stringify(entry.statPath),JSON.stringify(server.statPath));
    assert.strictEqual(entry.check(state),Number(state.stash[entry.statPath[1]])>=entry.threshold);
}
console.log('Client: all 30 collection names/points/thresholds match server; progress counts exchanges, not owned cards');
