const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('_client/src/modules/reward-link.js','utf8').replace(/^import .*$/mg,'').replace('export function','function');
for(const reason of ['habar_active','habar_date_missing']){
 let popup;const iface={_showRewardPopup(v){popup=v;}};
 const ctx={window:{location:{hash:'#reward=fixture'},TS:true,iface},iface,TS:{php(method,args,done){done({claimed:0,reason});}},console:{log(){},error(){}},applyPatch(){throw Error('blocked claim patched');}};
 vm.runInNewContext(source+';checkRewardLink();',ctx);assert.equal(popup.length,2);assert.ok(popup[0].includes(reason==='habar_active'?'действующий':'срок'));
}
// Исполнить реальные конструкторы трёх текстов, проверить и динамические значения наград.
const stash=fs.readFileSync('_client/src/game/svod/svod-zanachki.js','utf8');
for(const name of ['rewardLabelTxt','sukhariRewardTxt','expRewardTxt']){
 const match=stash.match(new RegExp('const '+name+' = new PIXI.Text\\([\\s\\S]*?\\n            \\}\\);'));
 assert.ok(match,name);let captured;vm.runInNewContext(match[0],{FONT:'Southbank LT',amt:80,PIXI:{Text:class{constructor(text,style){captured={text,style};}}}});
 assert.equal(captured.style.fontSize,20,name);if(name!=='rewardLabelTxt')assert.ok(captured.text.startsWith('+80 '));
}
console.log('Blocked reward notices and all three stash reward text styles passed');

for(const rowIdx of [0,1,14]){
 const ctx={rowY:200,STAR_Y_OFF:80,rowIdx,rewardLabelTxt:{},sukhariRewardTxt:{},expRewardTxt:{}};
 for(const name of ['rewardLabelTxt','sukhariRewardTxt','expRewardTxt']){
  const m=stash.match(new RegExp(name+'\\.y = ([^;]+);'));vm.runInNewContext(name+'.y = '+m[1],ctx);
 }
 assert.equal(ctx.rewardLabelTxt.y,280-50-(rowIdx===0?10:6));assert.equal(ctx.sukhariRewardTxt.y,250);assert.equal(ctx.expRewardTxt.y,281);
}
console.log('Stash reward offsets: first row -10, other rows -6, amounts -4 passed');
