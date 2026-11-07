const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../_client/src/game/achievements.js'),'utf8');
const a=source.indexOf('\t_loadFromUdata(){'),b=source.indexOf('\n}',a);
const load=source.slice(a,b).replace('_loadFromUdata(){','function(){');
for(const achievements of ['',null,undefined,'{}']){
 const model={earned:{oldAchievement:true}};
 vm.runInNewContext('('+load+').call(model)',{model,udata:{achievements},helper:{safeParseJSON:JSON.parse},console:{log(){}}});
 assert.equal(Object.keys(model.earned).length,0,'An empty server achievement map must clear cached achievements');
}
console.log('Account reset clears cached achievements for empty, null and explicit empty maps');
