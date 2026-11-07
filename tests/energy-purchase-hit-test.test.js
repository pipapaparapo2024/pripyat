// Real Pixi 6 InteractionManager hit test -> actual IAP -> actual site checkout.
// Canvas text rasterisation and external payment APIs are isolated; no browser/purchase is used.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const canvasContext=new Proxy({getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(t,p)=>p in t?t[p]:()=>{}});
const canvas={getContext:()=>canvasContext,style:{},addEventListener(){},removeEventListener(){}};
const c={console:{log(){},warn(){},error(){}},navigator:{userAgent:'Node unit test'},document:{createElement:()=>canvas,addEventListener(){},removeEventListener(){}},addEventListener(){},removeEventListener(){},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},performance:{now:()=>0},requestAnimationFrame:()=>0,cancelAnimationFrame(){},HTMLCanvasElement:class{},Image:class{},Uint8Array,crypto:{getRandomValues:b=>b.fill(1)}};
c.window=c;c.self=c;vm.createContext(c);vm.runInContext(fs.readFileSync('_client/development/libs/pixi-legacy.min.js','utf8'),c);
const P=c.PIXI;
Object.defineProperty(P.Texture,'WHITE',{value:new P.Texture(new P.BaseTexture(null,{width:16,height:16})),configurable:true});
const delayed=[];
P.Texture.from=url=>{const bytes=fs.readFileSync('assets/'+url.replace(/^\.\//,''));const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);const base=new P.BaseTexture(null,{width:1,height:1});const texture=new P.Texture(base);delayed.push(()=>base.setSize(width,height));return texture;};
P.Text=class extends P.Container{constructor(text,style){super();this.text=text;this.style=style;this.anchor={set(){}};}};
c.energyPacks=require('../_client/src/data/energy_packs.json');c.isOk=()=>false;c.helper={numberEnd:()=> '₽'};c._sa=()=>{};c._ss=()=>{};
c._makeModalDimmer=()=>{const g=new P.Graphics();g.beginFill(0);g.drawRect(0,0,1280,720);g.endFill();g.interactive=true;return g;};
c.root=new P.Container();c.root.layer2_mc=new P.Container();c.root.addChild(c.root.layer2_mc);c.root.parent=new P.Container();
c.__siteRuntime=true;c.siteRubCatalog={energy:[21,49,70,140,280,420,595,840]};
const storage=new Map();c.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
let opens=0;const products=[],messages=[];
c.open=()=>{opens++;return {closed:false,location:{replace(){}},close(){}};};
c.TS={php(method,params,done){if(method==='sitepayments.create'){products.push(params.product_id);done({order_id:'order-'+params.product_id,confirmation_url:'https://yoomoney.ru/checkout/test'});}else done({status:'credited'});}};
c.iface={_openSidorovichError:(title,text)=>messages.push(text)};
for(const file of ['_client/src/modules/iap.js','_client/src/modules/site-payments.js','_client/src/game/shell/popups/energy_buy.js'])vm.runInContext(fs.readFileSync(file,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export function/g,'function'),c);
vm.runInContext('installSitePayments(true);attachEnergyBuy(iface);iface._openEnergyPopup();',c);
const manager=new P.InteractionManager({view:canvas,resolution:1},{useSystemTicker:false});
// Reproduce late loading: all sprites were created against 1x1 placeholders.
for(const load of delayed)load();
const popup=c.iface._energyWin,slots=popup.children.filter(n=>n.name?.startsWith('energy-purchase-'));assert.equal(slots.length,8);assert(slots.every(slot=>slot instanceof P.Sprite),'original image sprites receive purchases');
(async()=>{
 // The former fixed placeholder fails at an ordinary point inside the image.
 c.root.updateTransform();const goodArea=slots[0].hitArea;slots[0].hitArea=new P.Rectangle(-0.5,-0.5,1,1);
 assert.notEqual(manager.hitTest(new P.Point(slots[0].x+30,slots[0].y),c.root),slots[0],'legacy 1x1 area reproduces non-clickable artwork');
 slots[0].hitArea=goodArea;
 for(let i=0;i<slots.length;i++){
  const slot=slots[i];
  for(const [dx,dy] of [[0,0],[-75,-65],[75,65]]){
   c.root.updateTransform();const hit=manager.hitTest(new P.Point(slot.x+dx,slot.y+dy),c.root);assert.equal(hit,slot,'card must receive the actual scene hit');
  }
  const before=opens;slot.emit('pointerdown',{data:{global:new P.Point(slot.x,slot.y)}});await Promise.resolve();assert.equal(opens,before+1);assert.equal(products.at(-1),100+i);
 }
 assert.equal(messages.length,0);
 const nativeCalls=[];c.__siteRuntime=false;c.logOkPayment=()=>{};c.donuts_info={stew:{default:Array(8)},coins:{default:Array(8)},cigarettes:{default:Array(8)}};
 for(const world of ['vk','ok']){
  c.isOk=()=>world==='ok';c.vk_params=world==='ok'?{vk_client:'ok'}:{};
  c.platformRuntime={platform:world,startNativePurchase:(item,details)=>{nativeCalls.push({world,item,details});return Promise.resolve({success:true});}};
  for(let i=0;i<slots.length;i++){
   slots[i].emit('pointerdown',{});for(let j=0;j<8;j++)await Promise.resolve();
   assert.equal(nativeCalls.at(-1).item,(world==='ok'?'ok_item':'item')+(100+i));
   if(world==='ok')assert.equal(nativeCalls.at(-1).details.price,c.energyPacks[i].price_ok);
  }
 }
 // Rejecting or unavailable adapters must never leave a silent, dead popup.
 c.__siteRuntime=true;c.__sitePurchase=()=>{throw Error('adapter unavailable');};popup.visible=true;slots[0].emit('pointerdown',{});assert.equal(popup.visible,false);assert.equal(messages.length,1);
 c.__sitePurchase=()=>Promise.reject(Error('checkout unavailable'));popup.visible=true;slots[1].emit('pointerdown',{});await new Promise(resolve=>setImmediate(resolve));assert.equal(popup.visible,false);assert.equal(messages.length,2);
 manager.destroy();
 console.log('Energy purchase: real Pixi scene hit tests at centres/edges, actual site/VK/OK IAP routing, all eight products and visible adapter errors passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
