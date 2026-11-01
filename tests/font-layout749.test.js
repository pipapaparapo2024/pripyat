const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 let done,epochCallback,loaded=false,cleared=0;
 class Text{constructor(){this.dirty=true;this.resolution=2;this.worldTransform={a:1,d:1};} updateText(){if(this.dirty){this.measured=loaded?'real':'fallback';this.dirty=false;}} _render(){} }
 const fonts={ready:{then(fn){epochCallback=fn;}},addEventListener(){}};
 const ctx={window:{document:{fonts}},PIXI:{Text,TextMetrics:{clearMetrics(){cleared++;}}}};
 vm.runInNewContext(fs.readFileSync('_client/src/modules/text-quality.js','utf8').replace(/export function/g,'function')+';installTextQuality(PIXI,window)',ctx);
 const text=new Text();text.updateText();assert.equal(text.measured,'fallback');loaded=true;epochCallback();text.updateText();assert.equal(text.measured,'real','font changes must apply before bounds/transform measurement');
 let requested;const delayed=new Promise(resolve=>done=resolve);const redraw={document:{fonts:{check:()=>false,ready:Promise.resolve(),load:(css,sample)=>{requested={css,sample};return delayed;}}},console:{log(){}},PIXI:{TextMetrics:{clearMetrics(){cleared++;}}}};
 vm.runInNewContext(fs.readFileSync('_client/src/modules/font-ready.js','utf8').replace('export function','function')+';this.run=scheduleFontRedraw',redraw);
 const target={dirty:false},destroyed={dirty:false,destroyed:true};redraw.run("16px 'Bebas Neue Book'",[target,destroyed]);await Promise.resolve();assert(!target.dirty);assert(requested.sample.includes('Награда'));done([]);await delayed;await Promise.resolve();assert(target.dirty);assert(!destroyed.dirty);assert(cleared>=2);
 console.log('Font loading: Cyrillic face requested, cached metrics cleared, layout updated before rendering, destroyed text skipped');
})().catch(e=>{console.error(e);process.exitCode=1;});
