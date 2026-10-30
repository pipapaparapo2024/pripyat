const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const callbacks=[];
const context=vm.createContext({window:{bosses:{}},bosses:{_resolveVkUsers(ids,cb){callbacks.push({ids,cb});}},
    PIXI:{Texture:{from:url=>({url,baseTexture:{valid:true}})}},formatAchNum:String});
const source=fs.readFileSync(path.join(__dirname,'../_client/src/game/game2048/game2048-top-popup.js'),'utf8')
    .replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
vm.runInContext(source,context);const proto={};context.attachGame2048TopPopup(proto);
const sprite=()=>({width:36,height:36});
const obj=Object.assign({_topEmptyTxt:{},_top1Nick:{},_top1Games:{},_top1Avatar:sprite(),_top1LifetimeTxts:{},
    _topRows:[{placeTxt:{},avatar:sprite(),nameTxt:{},gamesTxt:{}}]},proto);
obj._renderGame2048Top({top1:{id:123,nick:'one',gamesCompleted:3},rest:[{id:456,nick:'two',gamesCompleted:2}]});
assert.strictEqual(callbacks[0].ids.join(','),'123,456');
callbacks[0].cb({'123':{photo:'https://example.test/one.jpg'},'456':{photo:'https://example.test/two.jpg'}});
assert.strictEqual(obj._top1Avatar.texture.url,'https://example.test/one.jpg');
assert.strictEqual(obj._topRows[0].avatar.texture.url,'https://example.test/two.jpg');
assert.strictEqual(obj._topRows[0].avatar.width,36);
obj._renderGame2048Top({top1:{id:789,nick:'new',gamesCompleted:4},rest:[]});
assert.strictEqual(obj._topRows[0].avatar.visible,false);
callbacks[0].cb({'123':{photo:'https://example.test/stale.jpg'}});
assert(obj._top1Avatar.texture.url.includes('заглушка'),'old callback overwrote new leader');
callbacks[1].cb({});assert(obj._top1Avatar.texture.url.includes('заглушка'),'missing photo removed fallback');
obj._renderGame2048Top({top1:null,rest:[]});assert.strictEqual(obj._top1Avatar.visible,false);
console.log('2048 top avatars: leader, rows, stable size, fallback and stale-response protection passed');
