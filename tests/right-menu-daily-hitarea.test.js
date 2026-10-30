const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '../_client/src');
class Container {
    constructor(){this.children=[];this.x=0;this.y=0;this.scale={x:1,y:1};this.handlers={};}
    addChild(...objects){this.children.push(...objects);}
    on(event,fn){this.handlers[event]=fn;return this;}
}
class Graphics extends Container {
    beginFill(){} endFill(){}
    drawRect(x,y,width,height){this.bounds={x,y,width,height};}
    getLocalBounds(){return this.bounds;}
}
class Sprite extends Container {constructor(texture){super();this.texture=texture;}}
class Rectangle {constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
const PIXI={Container,Graphics,Sprite,Rectangle,Text:Container,SCALE_MODES:{LINEAR:1},MIPMAP_MODES:{ON:1},
    filters:{ColorMatrixFilter:class {brightness(){}}},
    Texture:{from:file=>({file,orig:{width:236,height:57},baseTexture:{setStyle(){}}})}};
for(const mobile of [false,true]){
    const context=vm.createContext({console:{log(){}},PIXI,window:{PIXI,isMobile:mobile,hide_unreleased_features:false},root:{layer1_mc:new Container}});
    const helper=fs.readFileSync(path.join(root,'modules/universal_helper.js'),'utf8')
        .replace(/^import .*;\r?\n/gm,'').replace('export default class UniHelp','class UniHelp');
    vm.runInContext(helper+'\nthis.helper=new UniHelp();',context);
    const panels=fs.readFileSync(path.join(root,'game/interface/interface-panels.js'),'utf8').replace('export function','function');
    vm.runInContext(panels+'\nthis.proto={};attachInterfacePanels(proto);',context);
    const opened=[];
    const iface=Object.assign({},context.proto,{openModule:name=>opened.push(name)});
    iface._buildPngSidePanels();
    const panel=iface._pngRightPanel;
    const hitAt=(x,y)=>panel.children.filter(c=>{
        if(!c.interactive)return false;
        const b=c.hitArea||c.getLocalBounds();
        return x>=c.x+b.x&&x<c.x+b.x+b.width&&y>=c.y+b.y&&y<c.y+b.y+b.height;
    });
    for(const [index,name] of [[0,'dvor'],[2,'habar'],[3,'svod'],[4,'raznaryadka']]){
        const hits=hitAt(118,index*61+28);
        assert.strictEqual(hits.length,1,`exactly one hit for ${name}, mobile=${mobile}`);
        hits[0].handlers.pointerdown();assert.strictEqual(opened.pop(),name);
        hits[0].handlers.pointerover();
        const visibleHover=panel.children.filter(c=>c instanceof Sprite && (c.texture.file.includes(' hover.png') || c.texture.file.endsWith('raznaryadka-button-hover.png')) && c.visible===true);
        assert.strictEqual(visibleHover.length,1);
        assert(visibleHover[0].texture.file.includes(index===4?'raznaryadka-button':index===0?'двор':index===2?'Хабар':'Сводка'));
        hits[0].handlers.pointerout();
    }
}
console.log('Right menu: daily hit area does not intercept Dvor, desktop and touch passed');
