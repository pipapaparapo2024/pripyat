const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const source = read('_client/src/game/bosses/bosses-combat.js');
const successStart = source.indexOf('(res) => {',source.indexOf("TS.php('bosses.attack'"))+10;
const successEnd = source.indexOf('        }, (err) => {',successStart);
const success = source.slice(successStart,successEnd);
assert(successStart > 9 && successEnd > successStart);
for(let idx=0;idx<8;idx++){
 for(let di=0;di<4;di++){
  const hp=50000-8600;
  let shown;
  const boss={_attackInFlight:true,_diffIdx:di,hpByDiff:Array.from({length:4},()=>Array(8).fill(50000)),keys:Array(8).fill(5),
   _loadFromUdata(){this._diffIdx=(di+1)%4;},
   _setHp(i,h){this.hpByDiff[this._diffIdx][i]=h;},_fmt:n=>String(n),_maxHp:()=>50000,_saveToUdata(){},
   win:{boss_detail:{reward_txt:{},level_txt:{},hp_bar:{setPercent(){}}},boss_list:{}}};
  const iface={_updateBossFightHpDisplay(){shown=boss.hpByDiff[di][idx];},_updateBossFightStats(){},_loadBossFightRating(){}};
  const context={res:{hp,damage:8600,patch:{}},idx,diffIdxAtAttack:di,isFree:false,now:1,d:{keys_needed:0},keySlot:0,
   window:{iface},iface,applyPatch(){},console:{log(){},error(){}},boss};
  vm.runInNewContext('(function(){'+success+'}).call(boss)',context);
  assert.equal(shown,hp,'Confirmed hit must refresh the open fight for every boss and difficulty');
  assert.equal(boss._diffIdx,di,'Saved selection must not redirect the hit to a different difficulty');
 }
}
const pollStart=source.indexOf('proto._syncFriendsDamage =');
const pollEnd=source.indexOf('    // Резолвит',pollStart);
let respond, callbacks=0;
const boss={_diffIdx:0,_bossStartMs:[[100]],_fightHpRevision:1,_hp:()=>40000,_setHp(){throw Error('Stale poll restored old HP');}};
const context={proto:{},window:{TS:{}},TS:{php(m,p,cb){respond=cb;}},console};
vm.runInNewContext(source.slice(pollStart,pollEnd),context);
context.proto._syncFriendsDamage.call(boss,0,()=>callbacks++);
boss._fightHpRevision++;
respond({hp:50000});
assert.equal(callbacks,1);
console.log('Boss HP: confirmed attacks cover 8 bosses × 4 difficulties; stale polling cannot restore old HP');
