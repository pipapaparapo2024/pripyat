const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'_client/src/modules/stash-count-layout.js'),'utf8').replace('export function','function')+'\nthis.place=placeStashCount;',ctx);
function image(width,height,loaded){
    const callbacks=[];const texture={width:loaded?width:1,height:loaded?height:1,once(event,fn){callbacks.push(fn);}};
    return {x:200,y:254,texture,get width(){return texture.width;},get height(){return texture.height;},load(){texture.width=width;texture.height=height;callbacks.splice(0).forEach(fn=>fn());}};
}
// Every cold/warm combination and both load orders must produce the same geometry.
for(const cardReady of [false,true])for(const buttonReady of [false,true])for(const reverse of [false,true]){
    const card=image(71,93,cardReady),button=image(99,29,buttonReady);button.y=349;
    const text={text:'0'};ctx.place(text,card,button,true);
    if(!cardReady||!buttonReady)assert.strictEqual(text.visible,false,'placeholder geometry must not be displayed');
    if(reverse){button.load();card.load();}else{card.load();button.load();}
    assert.strictEqual(text.x,236.5);assert.strictEqual(text.y,326);assert.strictEqual(text.visible,true);
}
const card=image(71,93,false),text={text:'0'};ctx.place(text,card);card.load();
assert.strictEqual(text.x,235.5);assert.strictEqual(text.y,327);assert.strictEqual(text.visible,true);
const dead=image(71,93,false),deadText={};ctx.place(deadText,dead);deadText.destroyed=true;dead.load();assert.strictEqual(deadText.visible,false);
vm.runInContext(fs.readFileSync(path.join(root,'_client/src/game/svod/svod-zanachki.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function')+'\nthis.proto={};attachSvodZanachki(this.proto);',ctx);
const counts={};for(let c=1;c<=15;c++)for(let p=1;p<=7;p++)counts[c+'_'+p]={};
const owner=Object.assign({},ctx.proto,{_zanachkiState:{stashData:{1:{1:7}}},_zanachkiCountTxts:counts});owner._zanachkiApplyCounts();
assert.strictEqual(Object.values(counts).filter(t=>t.text==='0').length,104);
assert.strictEqual(counts['1_1'].text,'7');
console.log('Stash counts: all 105 labels, zero values, both texture load orders, cold/warm cache, friend -3px and destroyed nodes passed');
