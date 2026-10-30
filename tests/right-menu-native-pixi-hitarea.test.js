// Actual bundled PixiJS 6.5.10 hit testing, not a hand-written geometry model.
// Canvas is stubbed only because no rendering/GPU is required for input tests.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
class Canvas {
    constructor(){this.width=236;this.height=57;this.style={};}
    getContext(){return {fillRect(){},drawImage(){},getImageData(){return {data:new Uint8ClampedArray(4)};}};}
    addEventListener(){} removeEventListener(){}
}
const context=vm.createContext({console:{log(){}},setTimeout,clearTimeout,Uint8ClampedArray,
    HTMLCanvasElement:Canvas,Image:class{},navigator:{userAgent:'node'},addEventListener(){},removeEventListener(){},
    document:{createElement:()=>new Canvas(),addEventListener(){},removeEventListener(){}}});
context.window=context;context.self=context;
vm.runInContext(fs.readFileSync(path.join(root,'_client/development/libs/pixi-legacy.min.js'),'utf8'),context);
const PIXI=context.PIXI;
PIXI.Texture.from=file=>{const texture=new PIXI.Texture(PIXI.BaseTexture.from(new Canvas()));texture.file=file;return texture;};
// Text rasterization is irrelevant to native sprite geometry/input checks.
PIXI.Text=class extends PIXI.Container { constructor(text){super();this.text=text;} };
vm.runInContext(fs.readFileSync(path.join(root,'_client/src/modules/universal_helper.js'),'utf8')
    .replace(/^import .*;\r?\n/gm,'').replace('export default class UniHelp','class UniHelp')+'\nthis.helper=new UniHelp();',context);
vm.runInContext(fs.readFileSync(path.join(root,'_client/src/game/interface/interface-panels.js'),'utf8')
    .replace('export function','function')+'\nthis.proto={};attachInterfacePanels(proto);',context);
for(const mobile of [false,true])for(const scale of [0.5,1,1.4]){
    context.isMobile=mobile;context.hide_unreleased_features=false;
    context.scene={renderer:{resolution:2.25}};
    const stage=new PIXI.Container();stage.parent=new PIXI.Container();
    stage.scale.set(scale);stage.position.set(19,31);
    context.root={layer1_mc:stage};
    const opened=[];
    context.hata={open(){opened.push('base');}};
    const iface=Object.assign({},context.proto,{openModule:name=>opened.push(name),_closeAllPanels(){}});
    iface._buildPngSidePanels();
    const panel=iface._pngRightPanel;
    stage.updateTransform();
    const manager=new PIXI.InteractionManager({view:new Canvas(),resolution:1},{useSystemTicker:false});
    for(const [index,name] of ['dvor','base','habar','svod','raznaryadka'].entries()){
        for(const dx of [1,118,235])for(const dy of [1,28,55]){
            const point=panel.toGlobal(new PIXI.Point(dx,index*61+dy));
            const hit=manager.hitTest(point,stage);
            assert(hit,`no hit: ${name}, touch=${mobile}, scale=${scale}`);
            hit.emit('pointerdown');
            assert.strictEqual(opened.pop(),name,`wrong target at ${name}, touch=${mobile}, scale=${scale}`);
            hit.emit('pointerover');
            const hover=panel.children.filter(c=>c.texture && (String(c.texture.file).includes(' hover.png') || (String(c.texture.file).endsWith('raznaryadka-button.png') && c.alpha===1)) && c.visible);
            assert.strictEqual(hover.length,1);
            const file=['двор','База','Хабар','Сводка','задания'][index];
            assert(hover[0].texture.file.endsWith(index===4?'raznaryadka-button.png':file+' hover.png'));
            if(index===4){
                const normal=panel.children.find(c=>c.texture===hover[0].texture && c!==hover[0]);
                assert(normal && !normal.visible,'hover uses the exact normal texture');
                assert.strictEqual(normal.alpha,0.4);
                assert.strictEqual(hover[0].alpha,1);
                assert(!hover[0].filters,'alpha hover does not resample through a filter');
                assert.strictEqual(hover[0].width,236);
                assert.strictEqual(hover[0].height,57);
            }
            hit.emit('pointerout');
            if(index===4){
                assert.strictEqual(hover[0].visible,false);
                assert(panel.children.some(c=>c!==hover[0] && c.texture===hover[0].texture && c.visible));
            }
        }
        if(index<4){
            const gap=panel.toGlobal(new PIXI.Point(118,index*61+59));
            assert.strictEqual(manager.hitTest(gap,stage),null,'gap between menu rows is intercepted');
        }
    }
    manager.destroy();stage.destroy({children:true});
}
console.log('Native PixiJS: all five menu targets and hover, desktop/touch, three scales passed');
