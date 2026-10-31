const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),{EventEmitter}=require('events');
const events=new Map();const scope={window:{isMobile:true,addEventListener:(e,f)=>events.set(e,f),removeEventListener:(e)=>events.delete(e)},attachGame2048RulesPopup(){},attachGame2048TopPopup(){}};
let source=fs.readFileSync('_client/src/game/game2048.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export default class','class');vm.runInNewContext(source+';this.C=Game2048;',scope);
const g=Object.create(scope.C.prototype);g._win=new EventEmitter();let moves=[];g._sendMove=d=>moves.push(d);
const point=(x,y)=>({data:{pointerType:'touch',getLocalPosition:()=>({x,y})}});
g._attachInput();g._attachInput();assert.equal(g._win.listenerCount('pointerdown'),1);assert(!events.has('keydown'));
for(const [x,y,dir]of [[100,0,'right'],[-100,0,'left'],[0,-100,'up'],[0,100,'down']]){g._win.emit('pointerdown',point(0,0));g._win.emit('pointerup',point(x,y));assert.equal(moves.at(-1),dir);}
g._win.emit('pointerdown',point(0,0));g._win.emit('pointercancel');g._win.emit('pointerup',point(100,0));assert.equal(moves.length,4);g._win.emit('pointerdown',point(0,0));g._win.emit('pointerdown',point(10,0));g._win.emit('pointerup',point(100,0));assert.equal(moves.length,4,'Two fingers must not move tiles');g._detachInput();assert.equal(g._win.listenerCount('pointerup'),0);
scope.window.isMobile=false;g._attachInput();assert(events.has('keydown'));events.get('keydown')({key:'ArrowLeft',preventDefault(){}});assert.equal(moves.at(-1),'left');g._detachInput();assert.equal(events.size,0);
console.log('2048 input: mobile four-way swipe, desktop keys, repeat-open cleanup and cancelled gestures passed');
const panels={};vm.runInNewContext(fs.readFileSync('_client/src/game/interface/interface-panels.js','utf8').replace('export function','function')+';this.attachPanels=attachInterfacePanels;',scope);scope.attachPanels(panels);
const layer={removeChild(node){node.parent=null;}};
g._win.parent=layer;g._topWin={parent:layer};let topClosed=0,returned=0;
g._closeGame2048TopPopup=()=>{g._topWin.parent.removeChild(g._topWin);topClosed++;};
scope.window.game2048=g;scope.window.iface=scope.iface={openModule:(name,options)=>{assert.equal(name,'dvor');assert.equal(options.forceOpen,true);returned++;}};
panels._closeCurrentModule();assert.equal(topClosed,1);assert(g._win.parent,'Global close from TOP preserves 2048');assert.equal(returned,0);
panels._closeCurrentModule();assert.equal(returned,1,'Next global close returns to Dvor');assert.equal(g._win.parent,null);
console.log('2048 global close: TOP -> game -> Dvor passed');
