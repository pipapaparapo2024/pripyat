const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '../_client/src');
function load(file){
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8').replace(/export /g,''),context);
    return context;
}
const {okBannerViewport} = load('modules/ok-banner-viewport.js');
const {applyRotatedCanvasStyle,mapPositionToPointRotated} = load('modules/forced-landscape.js');
const near = (a,b) => assert(Math.abs(a-b)<1e-6, `${a} != ${b}`);
for(const [w,h,mobile] of [[1280,720,false],[1280,492,false],[1920,1080,false],
    [844,390,true],[667,375,true],[390,844,true],[375,667,true],[1024,768,true]]){
    const physical = {w,h,left:17,top:11,portrait:h>w};
    const original = JSON.stringify(physical);
    assert.strictEqual(okBannerViewport(physical),physical,'VK must keep original viewport');
    assert.strictEqual(okBannerViewport(physical,{enabled:false,mobile}),physical);
    const safe = okBannerViewport(physical,{enabled:true,mobile});
    assert.strictEqual(JSON.stringify(physical),original,'do not mutate safe-area metrics');
    assert.strictEqual(safe.portrait,physical.portrait);
    assert(safe.w>0 && safe.h>0);
    const rotated = mobile && physical.portrait;
    const canvas = {style:{}};
    let box;
    if(rotated){
        const size = applyRotatedCanvasStyle(canvas,safe);
        box={left:safe.left+(safe.w-size.h)/2,top:safe.top+(safe.h-size.w)/2,width:size.h,height:size.w};
        canvas.getBoundingClientRect=()=>box;
        const map=mapPositionToPointRotated(canvas);
        // Real input mapping after CSS rotation, including displaced origin.
        for(const [x,y] of [[1240,83],[1120,210],[640,360],[30,680]]){
            const px=box.left+(1-y/720)*box.width;
            const py=box.top+x/1280*box.height;
            const point={}; map(point,px,py); near(point.x,x);near(point.y,y);
        }
    }else{
        const scale=Math.min(safe.w/1280,safe.h/720);
        box={left:safe.left+(safe.w-1280*scale)/2,top:safe.top+(safe.h-720*scale)/2,width:1280*scale,height:720*scale};
    }
    assert(box.left>=safe.left-1e-6 && box.top>=safe.top-1e-6);
    assert(box.left+box.width<=safe.left+safe.w+1e-6);
    assert(box.top+box.height<=safe.top+safe.h+1e-6);
    // The full canvas is outside either horizontal banner position and either
    // vertical position. Hidden-ad placeholders retain the same reserved area.
    assert(box.top>=physical.top+106);
    assert(box.top+box.height<=physical.top+h-106+1e-6);
    if(!physical.portrait || !mobile){
        const bannerWidth=mobile?120:320;
        assert(box.left>=physical.left+bannerWidth);
        assert(box.left+box.width<=physical.left+w-bannerWidth+1e-6);
    }
}
for(const [w,h] of [[1,1],[200,100]]){
    const safe=okBannerViewport({w,h,left:0,top:0,portrait:h>w},{enabled:true});
    assert(safe.left>=0 && safe.top>=0 && safe.left+safe.w<=w && safe.top+safe.h<=h);
}
console.log('OK banner viewport: geometry, rotation, input and VK isolation passed');
