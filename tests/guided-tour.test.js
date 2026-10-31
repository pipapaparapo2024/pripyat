const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
class Node{
 constructor(){this.children=[];this.visible=true;this.renderable=true;this.style={};this.anchor={set(){}};this.scale={set(){}};this.events={};this.x=10;this.y=20;}
 addChild(n){if(n.parent)n.parent.removeChild(n);this.children.push(n);n.parent=this;return n;}removeChild(n){this.children=this.children.filter(x=>x!==n);n.parent=null;}
 on(e,f){this.events[e]=f;return this;}emit(e,v){if(this.events[e])this.events[e](v);}toLocal(p){return p;}getBounds(){return{x:this.x,y:this.y,width:40,height:40};}
 beginFill(){return this;}drawRect(){return this;}endFill(){return this;}lineStyle(){return this;}drawCircle(){return this;}clear(){return this;}
}
const ticks=new Set(),root=new Node();root.layer2_mc=new Node();root.addChild(root.layer2_mc);
const PIXI={Container:Node,Graphics:Node,Sprite:Node,Texture:{from:x=>x},Point:class{constructor(x,y){this.x=x;this.y=y;}},Ticker:{shared:{add:f=>ticks.add(f),remove:f=>ticks.delete(f)}},sound:{}};
const texts=JSON.parse(fs.readFileSync('_client/src/game/onboarding/narration-texts.json','utf8'));
assert.equal(texts['10 описание валюты'],'Давай по части валюты. Не знаю, как было там, где ты был до этого, но здесь тушёнка премиальная валюта. Можно приобрести только у Сидоровича. Рубли можно заработать, участвуя в разных событиях, купить у Сидоровича, в целом проще заработать.');
const scope={PIXI,root,window:{_sndVol:0},udata:{zone_fights:0},texts,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('_client/src/game/onboarding/guided-tour.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function')+';this.attach=attachGuidedTour;',scope);
class Tour{}scope.attach(Tour);
const t=new Tour();t._popupWin=new Node();t._onboardingText=new Node();t._mergeBtn={passive:new Node(),active:new Node(),hit:new Node()};t._continueBtn={passive:new Node(),active:new Node(),hit:new Node()};t._hidePopup=()=>{if(t._popupWin.parent)t._popupWin.parent.removeChild(t._popupWin);};let completed=0;t._advanceTour=()=>completed++;
const exit=new Node();exit._tutorialTarget='exit';let closed=0;exit.on('pointerdown',()=>closed++);root.layer2_mc.addChild(exit);
// Real explanation tick must highlight semantic sprites without depending on texture URLs.
const bag=new Node(),parcel=new Node();
for(const sprite of [bag,parcel]){sprite.alpha=0.9;sprite.scale.x=sprite.scale.y=1;sprite._tutorialExplanationHighlight=true;root.layer2_mc.addChild(sprite);}
t._beginGuidedExplanation({key:'sidorovich',label:'Сидорович',sound:'./sounds/9 описание сидорович.mp3'});
t._guidedPopupTick();
for(const sprite of [bag,parcel])assert(sprite.alpha<0.9,'Bag and parcel blink while explanation is visible');
// Simulate deferred texture loading correcting scale for explicit 339x374 dimensions.
bag.scale.x=0.25;bag.scale.y=0.3;
t._guidedPopupTick();
assert.equal(bag.scale.x,0.25,'Highlight must not overwrite scale after texture load');
t._guidedContinue();
assert.equal(bag.scale.x,0.25,'Completion must preserve texture-corrected width');
assert.equal(bag.scale.y,0.3,'Completion must preserve texture-corrected height');
for(const sprite of [bag,parcel])assert.equal(sprite.alpha,0.9,'Explanation completion restores original alpha');
t._guidedCleanup();root.layer2_mc.removeChild(bag);root.layer2_mc.removeChild(parcel);
t._beginGuidedExplanation({key:'dvor',label:'Двор',sound:'./sounds/2 описание двора.mp3'});
assert.equal(t._onboardingText.text,texts['2 описание двора']);assert(t._continueBtn.hit.interactive);assert.equal(closed,0);
t._guidedContinue();assert.equal(closed,0);const overlay=root.layer2_mc.children.at(-1);const hand=overlay.children[2],hit=overlay.children[3];assert.equal(hand.x,1194);
exit.x=180;for(const tick of [...ticks])tick();assert.equal(hand.x,1364,'Pointer must follow moved exit');
hand.x=250;hand._uOnTransform();for(const tick of [...ticks])tick();assert.equal(hand.x,250,'Editor drag must survive next frame');
exit.x=200;for(const tick of [...ticks])tick();assert.equal(hand.x,270,'Edited offset follows moved target');
assert.equal(overlay.children[1].visible,true,'Pulse is visible');assert(exit.alpha<1,'Target itself blinks');
scope.window.iface={_uEditOn:true};scope.iface=scope.window.iface;hit.emit('pointerdown',{stopPropagation(){}});assert.equal(closed,0,'Editor drag does not activate tutorial action');scope.window.iface._uEditOn=false;
hit.emit('pointerdown',{stopPropagation(){}});assert.equal(closed,1);assert.equal(completed,1);assert.equal(ticks.size,0);
let voiceDone;scope.window._sndVol=0.7;t._playNarration=(url,done)=>voiceDone=done;t._beginGuidedExplanation({key:'habar',label:'Хабар',sound:'./sounds/5 описание хабара.mp3'});assert(t._continueBtn.hit.interactive,'Playing narration can be skipped');t._guidedContinue();const beforeLate=ticks.size;voiceDone();assert.equal(ticks.size,beforeLate,'Late completion after skip cannot advance twice');assert(!t._popupWin.parent);t._guidedCleanup();assert.equal(ticks.size,0);
console.log('Guided tour: transcript, muted fallback, speech lock, automatic dismissal, moving target, one exit and ticker cleanup passed');
t._playNarration=(url,done,failed)=>failed();
t._beginGuidedExplanation({key:'habar',label:'Хабар',sound:'./sounds/5 описание хабара.mp3'});
assert(t._continueBtn.hit.interactive,'Failed voice load must offer Continue');t._guidedContinue();t._guidedCleanup();
console.log('Guided tour: failed voice load falls back to text without deadlock');

(async()=>{
 const layer=root.layer2_mc;for(const child of [...layer.children])layer.removeChild(child);
 const menu=new Node(),location=new Node(),cordon=new Node(),action=new Node(),innerExit=new Node(),outerExit=new Node();
 cordon._tutorialTarget='cordon';action._tutorialTarget='zone-action';innerExit._tutorialTarget=outerExit._tutorialTarget='exit';
 menu.addChild(cordon);menu.addChild(outerExit);location.addChild(action);location.addChild(innerExit);layer.addChild(menu);
 scope.zone={locations:[{checkpoints:[{filled:0,cells:5,cell_cost:4}]}],_fillInFlight:false};scope.window.zone=scope.zone;scope.udata.energy=50;
 let energySpent=0,exitCount=0;
 cordon.on('pointerdown',()=>layer.addChild(location));action.on('pointerdown',()=>{energySpent+=4;scope.udata.zone_fights++;});innerExit.on('pointerdown',()=>{layer.removeChild(location);exitCount++;});outerExit.on('pointerdown',()=>{layer.removeChild(menu);exitCount++;});
 t._guideActions({key:'zone'});const guide=layer.children.at(-1),hit=guide.children[3];const click=()=>{for(const f of [...ticks])f();hit.emit('pointerdown',{stopPropagation(){}});};
 click();click();click();assert.equal(energySpent,4,'Double click while awaiting server may not spend energy twice');await new Promise(r=>setTimeout(r,130));click();click();assert.equal(exitCount,2);assert.equal(completed,2);assert.equal(ticks.size,0);
 console.log('Guided Zone: Cordon, one energy action, pending double-click guard and two exits passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
// Execute the real Dvor highlight method, including crumbs and the 2048 cloud.
{
 const acorn=require('../_client/node_modules/acorn');const source=fs.readFileSync('_client/src/game/dvor.js','utf8');let method;
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='MethodDefinition'&&n.key.name==='_setTutorialCloudHighlight')method=n.value;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}
 walk(acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'}));assert(method);
 let tick;const ctx={PIXI:{Ticker:{shared:{add:f=>tick=f,remove:()=>{tick=null;}}}}};vm.runInNewContext('this.highlight=function'+source.slice(method.start,method.end),ctx);
 const sprites=Array.from({length:8},()=>({alpha:1,scale:{value:1,set(n){this.value=n;}}}));const d={_dvorCloudSprites:sprites.slice(0,4),_cigSprites:sprites.slice(4,7),_game2048PressSpr:sprites[7]};
 ctx.highlight.call(d,true);assert(tick);for(const sprite of sprites){assert(sprite.alpha<1);assert(sprite.scale.value>1);}
 ctx.highlight.call(d,false);assert.equal(tick,null);for(const sprite of sprites){assert.equal(sprite.alpha,1);assert.equal(sprite.scale.value,1);}
 console.log('Actual Dvor: all four games, three crumbs and 2048 pulse and restore');
}
// The first menu pointer also flashes its real Sprite, not a circle.
{
 class Sprite extends Node{};const stage=new Node();stage.layer2_mc=new Node();stage.addChild(stage.layer2_mc);
 const button=new Sprite();button.x=100;button.y=100;button.alpha=1;stage.layer2_mc.addChild(button);
 const localTicks=new Set();const pixi={...PIXI,Sprite,Ticker:{shared:{add:f=>localTicks.add(f),remove:f=>localTicks.delete(f)}}};
 const c={PIXI:pixi,root:stage,window:{},TOUR_TABS:[],console};
 vm.runInNewContext(fs.readFileSync('_client/src/game/onboarding/onboarding-tour.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function')+';this.attach=attachOnboardingTour;',c);
 class Initial{}c.attach(Initial);const initial=new Initial();initial._buildTourOverlay({key:'zone',target:{x:120,y:120}});
 assert(button.alpha<1,'Menu button itself flashes');assert.equal(initial._tourWin.children[1].visible,true,'Menu pulse visible');
 initial._destroyTourOverlay();assert.equal(button.alpha,1);assert.equal(localTicks.size,0,'All pointer tickers removed');
 console.log('Initial tutorial pointer: real button flash, no circle, original alpha restored');
}
