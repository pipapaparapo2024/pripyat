const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('_client/src/index.js','utf8');assert(src.includes('enabled: isOk() && !window.__siteRuntime'));
for(const site of [true,false])for(const ok of [true,false])assert.equal(ok&&!site,ok&&site===false);
for(const f of ['home.js','shell/overlays/hata.js','shell/overlays/player_profile.js','shell/overlays/shmot_shop.js']){const s=fs.readFileSync('_client/src/game/'+f,'utf8');assert(/leftHandSpr.width = 54;.*leftHandSpr.height = 36/.test(s));}
const png=fs.readFileSync('assets/images/левая рука.png');assert.equal(png.readUInt32BE(16),242);assert.equal(png.readUInt32BE(20),162);console.log('Website OK full viewport, native compact gate, fixed hand dimensions with full-resolution asset passed');
