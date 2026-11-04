const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync('_client/src/game/zone/zone-biz.js','utf8').replace('export function','function');
const requested=[];const context={PIXI:{Texture:{from(url){requested.push(url)}}}};vm.createContext(context);vm.runInContext(source+';this.proto={};attachZoneBiz(this.proto);',context);context.proto._preloadLocationAssets();
assert(requested.length>20);
for(const url of requested){assert(fs.existsSync(path.join('assets',url.replace(/^\.\//,''))),'Отсутствует ресурс предзагрузки: '+url);assert(!/\/loc_(kordon|svalka|dolina|agroprom|yantar)\.png$/.test(url),'Устаревший адрес');}
console.log('Локации: все ресурсы реального метода предзагрузки существуют в assets, устаревших URL нет');
