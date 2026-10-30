const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
class Canvas {constructor(){this.width=48;this.height=48;this.style={};}getContext(){return {fillRect(){},drawImage(){},getImageData(){return {data:new Uint8ClampedArray(4)};}};}addEventListener(){}removeEventListener(){}}
const ctx=vm.createContext({console:{log(){}},setTimeout,clearTimeout,Uint8ClampedArray,HTMLCanvasElement:Canvas,Image:class{},navigator:{userAgent:'node'},addEventListener(){},removeEventListener(){},document:{createElement:()=>new Canvas(),addEventListener(){},removeEventListener(){}}});
ctx.window=ctx;ctx.self=ctx;
vm.runInContext(fs.readFileSync(path.join(root,'_client/development/libs/pixi-legacy.min.js'),'utf8'),ctx);
const P=ctx.PIXI;P.Texture.from=file=>{const t=new P.Texture(P.BaseTexture.from(new Canvas()));t.file=file;return t;};
vm.runInContext(fs.readFileSync(path.join(root,'_client/src/game/svod/svod-zanachki-wishlist.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function')+'\nthis.proto={};attachSvodZanachkiWishlist(proto);',ctx);
const stage=new P.Container();stage.parent=new P.Container();const profile=new P.Container();stage.addChild(profile);
ctx.root={layer2_mc:stage};ctx.isMobile=false;
const owner=Object.assign({},ctx.proto);ctx.svod=owner;
const popup=owner._buildZanachkiWishlistPopup([],'friend',{parentWin:profile});
assert.strictEqual(popup.parent,profile,'friend popup must stay inside the friend screen');
const exit=popup.children.find(c=>c.texture && c.texture.file.endsWith('/выход.png'));
let stopped=0;exit.emit('pointerdown',{stopPropagation(){stopped++;}});
assert.strictEqual(stopped,1);assert.strictEqual(popup.parent,null);
assert.strictEqual(profile.parent,stage,'closing wishlist closed friend screen');
assert.strictEqual(owner._zanachkiWishlistWin,null);
stage.removeChild(profile);
assert.strictEqual(owner._buildZanachkiWishlistPopup([],'friend',{parentWin:profile}),null,'late reply reopened a closed friend screen');
// Global close must consume the modal before closing any underlying module.
vm.runInContext(fs.readFileSync(path.join(root,'_client/src/game/interface/interface-panels.js'),'utf8').replace('export function','function')+'\nthis.ifaceProto={};attachInterfacePanels(ifaceProto);',ctx);
stage.addChild(profile);const modal=owner._buildZanachkiWishlistPopup([],'friend',{parentWin:profile});
let profileCloses=0,dvorCloses=0;ctx.dvor={close(){dvorCloses++;}};
const iface=Object.assign({},ctx.ifaceProto,{_profileWin:profile,_closePlayerProfile(){profileCloses++;}});
iface._closeCurrentModule();assert.strictEqual(modal.parent,null);assert.strictEqual(profileCloses,0);assert.strictEqual(dvorCloses,0);
iface._closeCurrentModule();assert.strictEqual(profileCloses,1);assert.strictEqual(dvorCloses,0);
console.log('Native PixiJS: friend modal close, global close priority and stale callback guard passed');
