const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'_client/src/modules/physical-render-resolution.js'),'utf8').replace('export function','function')+';this.compute=physicalRendererResolution;',context);
const cases=[
 [1000,1.25,1,1250], [1280,1,1,1280], [1920,1,1,1920],
 [375,2,1,750], [844,3,1,2532], [844,3,2,5064],
 [800,1.5625,1,1250], [991.3,1.1,1,1090], [1000,NaN,NaN,1000]
];
for(const [width,dpr,zoom,pixels] of cases){const res=context.compute(width,dpr,zoom);assert.equal(Math.round(1280*res),pixels);assert(res>0);}
assert(context.compute(1000,1.25,1)<1,'No forced oversize backing buffer for a smaller window');
assert.equal(context.compute(1000,1.25),context.compute(800,1.5625),'Browser zoom with same physical display must keep the same pixel buffer');
const index=fs.readFileSync(path.join(root,'_client/src/index.js'),'utf8');
assert(index.includes('plugins.interaction.resolution = scene.renderer.resolution'),'Pointer mapping must track backing resolution');
assert(index.includes('physicalRendererResolution(w, dpr, 1)'));
assert(index.includes('if(!scene.renderer._stableBufferInitialized)'),'A one-pixel physical change must not be ignored');
assert(index.includes('autoDensity: false'),'Pixi must not overwrite manually fitted canvas CSS dimensions');
console.log('Physical canvas pixels: fractional DPR, sub-1 resolution, desktop/mobile zoom, stable physical size and pointer resolution passed');

class Canvas {
 constructor(){this.width=1;this.height=1;this.style={};this.parentElement={};}
 getContext(){return {setTransform(){},fillRect(){},clearRect(){},save(){},restore(){},drawImage(){},getImageData(){return {data:new Uint8ClampedArray(4)};}};}
 addEventListener(){} removeEventListener(){} setAttribute(){} appendChild(){} removeChild(){}
 getBoundingClientRect(){return this.rect;}
}
const native=vm.createContext({console:{log(){},warn(){}},setTimeout,clearTimeout,requestAnimationFrame:()=>0,cancelAnimationFrame(){},performance:{now:()=>0},Uint8ClampedArray,HTMLCanvasElement:Canvas,HTMLElement:Canvas,Image:class{},navigator:{userAgent:'node'},addEventListener(){},removeEventListener(){},document:{createElement:()=>new Canvas(),addEventListener(){},removeEventListener(){},body:{appendChild(){},removeChild(){}}}});
native.window=native;native.self=native;
vm.runInContext(fs.readFileSync(path.join(root,'assets/libs/pixi-legacy.min.js'),'utf8'),native);
for(const [width,dpr,zoom,pixels] of cases.slice(0,7)){
 const resolution=context.compute(width,dpr,zoom),view=new Canvas();
 view.style.width=width+'px';view.style.height=(width*720/1280)+'px';
 view.rect={left:10,top:20,width,height:width*720/1280};
 const renderer=new native.PIXI.CanvasRenderer({width:1280,height:720,resolution,autoDensity:false,view});
 assert.equal(view.width,pixels);assert.equal(view.style.width,width+'px');
 const point=new native.PIXI.Point();
 renderer.plugins.interaction.mapPositionToPoint(point,10+width/2,20+view.rect.height/2);
 assert(Math.abs(point.x-640)<0.01,'Native pointer X must stay in logical coordinates');
 assert(Math.abs(point.y-360)<1,'Native pointer Y remains within one logical pixel after integer buffer rounding');
 renderer.destroy(false);
}
console.log('Actual Pixi CanvasRenderer: backing width, unchanged CSS fit and pointer mapping passed');
// Execute the actual resize guard: zoom must never allocate/clear the full canvas again.
const acorn=require('../_client/node_modules/acorn');
const ast=acorn.parse(index,{ecmaVersion:'latest',sourceType:'module'});let guard;
function visit(n){if(!n||typeof n!=='object')return;if(n.type==='IfStatement'&&n.test.type==='UnaryExpression'&&n.test.argument.type==='MemberExpression'&&n.test.argument.property.name==='_stableBufferInitialized')guard=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}
visit(ast);assert(guard);let resizes=0,renders=0;const renderer={resolution:1,resize(){resizes++;},render(){renders++;},plugins:{interaction:{}}};
const resizeGuard=new Function('scene','targetRes','PIXI','dpr','w',index.slice(guard.start,guard.end));
for(const resolution of [1,1.25,2,0.75,3,1])resizeGuard({renderer,stage:{}},resolution,{settings:{}},1,1280);
assert.equal(renderer.plugins.interaction.resolution,renderer.resolution,'Input uses stable canvas density');assert.equal(resizes,1,'Zoom must not clear/reallocate the full framebuffer');assert.equal(renders,1,'First allocation is immediately painted');
assert(index.includes('_textPixelDensity = targetRes * pinchDensity()'),'Pinch changes text density separately');
console.log('Actual resize guard: repeated zoom preserves the backing buffer and updates text density separately');
