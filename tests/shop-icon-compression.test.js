const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('_client/src/modules/shop-icon-compression.js','utf8').replace('export function','function');
const ctx={};vm.createContext(ctx);vm.runInContext(source,ctx);
for(const width of [128,129])for(const naturalHeight of [1,185,740]){
 const texture={frame:{x:0,y:0,width,height:naturalHeight}};
 const sprite={texture,y:30,width,height:185};
 ctx.applyShopIconCompression(sprite,{cellWidth:width,cellHeight:185,cellCompressTop:85,cellCompressBottom:15});
 assert.equal(sprite.texture,texture,'Full original texture must remain visible');
 assert.equal(sprite.texture.frame.height,naturalHeight,'Texture must never be cropped');
 assert.equal(sprite.height,85);assert.equal(sprite.width,width);assert.equal(sprite.y,65);
 assert.equal(sprite.y-sprite.height/2,(30-185/2)+85,'Top edge moves down 85');
 assert.equal(sprite.y+sprite.height/2,(30+185/2)-15,'Bottom edge moves up 15');
}
const untouched={texture:{},y:7,height:185};ctx.applyShopIconCompression(untouched,{cellHeight:185});assert.equal(untouched.y,7);assert.equal(untouched.height,185);
const items=fs.readFileSync('_client/src/game/shmot.js','utf8');
for(const width of [128,129]){
 const texture={frame:{x:0,y:0,width,height:740}};
 const sprite={texture,x:72,y:30,width,height:185};
 ctx.applyShopIconCompression(sprite,{cellWidth:width,cellHeight:185,cellCompressTop:85,cellCompressBottom:15,cellCompressLeft:8});
 assert.equal(sprite.width,width-8);assert.equal(sprite.x,76);
 assert.equal(sprite.x-sprite.width/2,72-width/2+8,'Left edge moves right exactly 8 px');
 assert.equal(sprite.x+sprite.width/2,72+width/2,'Right edge stays fixed');
 assert.equal(sprite.height,85);assert.equal(sprite.y,65);assert.equal(sprite.texture,texture);
 assert.equal(sprite.texture.frame.width,width,'Full texture width is preserved');
}
assert.equal((items.match(/cellCompressLeft:8/g)||[]).length,2);
assert.equal((items.match(/cellCompressTop:85, cellCompressBottom:15/g)||[]).length,2);
for(const id of [103,113])assert(items.split('\n').some(line=>line.includes('{id:'+id+',')&&line.includes('cellCompressTop:85, cellCompressBottom:15')));
console.log('Иконки: полная текстура, высота 85, левый край внутрь на 8 px, правый неподвижен');
