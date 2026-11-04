const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('_client/src/game/dvor/dvor-blackjack.js','utf8');
const line=source.split('\n').find(line=>line.includes('RANKS[Math.floor(Math.random()*8)]')&&line.includes('Texture.from'));
assert(line,'Animation must load an existing card rank');
const ranks=['семерка','восьмерка','девятка','десятка','валет','дама','король','туз'];
for(let i=0;i<ranks.length;i++){
 let loaded;const sprite={};
 vm.runInNewContext(line.trim(),{_bjCardSprites:[sprite],RANKS:ranks,i:0,Math:{floor:Math.floor,random:()=>i/8},PIXI:{Texture:{from(url){loaded=url;return url}}}});
 assert.equal(loaded,'./images/карта ранг '+ranks[i]+'.png?v=221');
 assert(fs.existsSync('assets/images/'+loaded.split('/').pop().split('?')[0]));
}
console.log('Все 8 случайных кадров блэкджека используют существующие изображения');
