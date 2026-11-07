const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const packs=require('../_client/src/data/energy_packs.json');
const source=fs.readFileSync('_client/src/game/shell/popups/energy_buy.js','utf8');
const currency=fs.readFileSync('_client/src/game/interface/interface-currency-purchase.js','utf8');
const expected=vm.runInNewContext('('+currency.match(/const TXT_STYLE_BASE = (\{[\s\S]*?\n    \});/)[1]+')');
class Node{
 constructor(texture){this.texture=texture;this.children=[];this.handlers={};this.anchor={set(){}};this.scale={set(){}};}
 once(){return this;}addChild(v){this.children.push(v);return v;}on(n,f){this.handlers[n]=f;return this;}beginFill(){}drawRect(){}endFill(){}
}
class Text extends Node{constructor(text,style){super();this.text=text;this.style=style;}}
class Texture{on(){return this;}off(){return this;}constructor(baseTexture,frame){this.baseTexture=baseTexture;this.frame=frame;this.orig={width:185,height:194};}static from(url){const texture=new Texture({url});const data=fs.readFileSync('assets/'+url.replace(/^\.\//,''));texture.orig={width:data.readUInt32BE(16),height:data.readUInt32BE(20)};return texture;}}
(async()=>{
 for(const world of ['vk','ok','site','telegram']){
  let resolveFont,loads=0;const purchases=[];const layer=new Node();
  const context={energyPacks:packs,isOk:()=>world==='ok',startPurchase:(...p)=>purchases.push(p),
   PIXI:{Container:Node,Sprite:Node,Text,Texture,Rectangle:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}},Graphics:Node},
   document:{fonts:{load:()=>{loads++;return new Promise(r=>resolveFont=r);}}},
   window:{_makeModalDimmer:()=>new Node(),__siteRuntime:world==='site',siteRubCatalog:{energy:[21,49,70,140,280,420,595,840]},__telegramRuntime:world==='telegram',telegramStarsCatalog:{energy:{stars:[11,25,35,70,140,210,298,420]}}},
   root:{layer2_mc:layer},helper:{numberEnd:()=>world==='site'?'₽':world==='telegram'?'звёзд':world==='ok'?'ОК':'голосов'},_sa(){},_ss(){},console:{log(){},warn(){}}
  };
  vm.createContext(context);vm.runInContext(source.replace(/^import .*;\r?\n/gm,'').replace('export function','function')+'\nthis.attach=attachEnergyBuy;',context);
  const proto={};context.attach(proto);const instance=Object.create(proto);
  instance._openEnergyPopup();instance._openEnergyPopup();assert.equal(loads,1);assert.equal(layer.children.length,0,'no fallback text before font load');
  resolveFont([]);await instance._energyFontLoading;
  const popup=instance._energyWin;assert(popup);const labels=popup.children.filter(c=>c instanceof Text&&c.text!=='×');assert.equal(labels.length,8);
  for(const label of labels)assert.deepEqual(JSON.parse(JSON.stringify(label.style)),JSON.parse(JSON.stringify(expected)),'same style as currency shop');
  assert.equal(popup.children.filter(c=>c.texture?.frame).length,0,'no cropped texture fragments');
  const cards=popup.children.filter(c=>c.texture?.baseTexture.url.includes('/Энергия/кнопка энергии'));
  assert.equal(cards.length,8,'exactly eight complete purchase cards');
  assert.equal(new Set(cards.map(c=>c.texture.baseTexture.url)).size,8,'one sprite per original asset');
  assert.equal(popup.children.filter(c=>c.texture).length,9,'only background plus original eight cards');
  assert(popup.children.filter(c=>c.name?.startsWith('energy-purchase-')).every(c=>c.texture),'purchase targets must be original images');
  assert(!labels.some(t=>/^\+/.test(t.text)),'no detached duplicate quantity labels');
  const expectedOffsets=[[4,1],[5,0],[0,0],[4,0],[3,0],[4,0],[5,0],[9,1]];
  cards.forEach((slot,i)=>{
   assert.equal(labels[i].x,slot.x+3+expectedOffsets[i][0]);assert.equal(labels[i].y,slot.y-76+expectedOffsets[i][1]);
   const hit=popup.children.find(c=>c.name==='energy-purchase-'+(100+i));assert(hit);assert.equal(hit.hitArea.x,-slot.texture.orig.width/2);assert.equal(hit.hitArea.y,-slot.texture.orig.height/2);assert.equal(hit.hitArea.width,slot.texture.orig.width);assert.equal(hit.hitArea.height,slot.texture.orig.height);
   assert.equal(slot.interactive,true);hit.handlers.pointerdown({});instance._energyPurchasePending=false;assert.equal(purchases[i][0],'item'+(100+i));assert.equal(purchases[i][1],packs[i].price_ok);
   assert.equal(purchases[i][2],packs[i].energy+' энергии');
  });
  assert.equal(purchases.length,8,'one purchase per whole-card press');
  instance._openEnergyPopup();assert.equal(instance._energyWin,popup);assert.equal(loads,1);
 }
 console.log('Energy shop: actual font readiness, repeated clicks, matching price typography, all worlds, no fragments or duplicate labels, whole-card purchase routes passed');
})().catch(e=>{console.error(e);process.exit(1);});
