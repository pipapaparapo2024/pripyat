const assert = require('node:assert/strict'), fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const acorn=require('../_client/node_modules/acorn');
const root=path.resolve(__dirname,'..'),base=path.join(root,'assets');
const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
const keys=Object.keys(manifest), folded=new Set();
for(const name of keys){
 assert(!folded.has(name.toLowerCase()),'Case collision: '+name);folded.add(name.toLowerCase());
 const raw=fs.readFileSync(path.join(base,name));assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),manifest[name].sha256,name);
 assert(!/\.(bak|pending)$|temp_ruka_test/.test(name),'Backup in runtime: '+name);
}
function has(name){assert(Object.hasOwn(manifest,name),'Missing exact-case runtime dependency: '+name);}
const boot=fs.readFileSync(path.join(root,'_client/src/game/game-boot.js'),'utf8');
const ast=acorn.parse(boot,{ecmaVersion:'latest',sourceType:'module'});let pngs;
function visit(n){if(!n||typeof n!=='object')return;if(n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&n.left.property.name==='_allGamePngs')pngs=vm.runInNewContext(boot.slice(n.right.start,n.right.end));for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}
visit(ast);assert(pngs&&pngs.length>300);for(const file of pngs)has('images/'+file);
const links=JSON.parse(fs.readFileSync(path.join(root,'server/json/links.json'),'utf8'));for(const name of Object.values(links))has('libs/'+name+'.min.js');
const html=fs.readFileSync(path.join(root,'_client/development/index.html'),'utf8');for(const [,name]of html.matchAll(/(?:src|href)=["'](?:\.\/)?((?:libs|fonts)\/[^"'?]+)(?:\?[^"']*)?["']/g))if(name!=='libs/index.js')has(name);
const css=fs.readFileSync(path.join(base,'fonts/fonts.css'),'utf8');for(const [,uri]of css.matchAll(/url\(["']?([^"')]+)["']?\)/g))has('fonts/'+decodeURI(uri));
for(const suit of ['пики','крести','буби','черви'])for(const rank of ['2','3','4','5','6','7','8','9','10','J','Q','K','A'])has('images/покер масть '+suit+'/'+rank+(['2','3','4','5','6'].includes(rank)?' '+suit:'')+'.png');
for(const boss of ['охотник','счастливчик','ястреб','меченный','крыс','баркут','борода','жгут'])for(const medal of ['бронза','серебро','золото'])has('images/'+boss+' '+medal+' медаль.png');
const source=fs.readFileSync(path.join(root,'_client/src/game/shell/overlays/spine-boss.js'),'utf8');
const tree=acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'});const binding=tree.body.find(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='BOSS_SPINE')).declarations.find(d=>d.id.name==='BOSS_SPINE');
const bosses=vm.runInNewContext(source.slice(binding.init.start,binding.init.end));assert.equal(bosses.length,8);
for(const boss of bosses){has('images/spine/'+boss.json);has('images/spine/'+boss.atlas);const skeleton=JSON.parse(fs.readFileSync(path.join(base,'images/spine',boss.json),'utf8'));assert(skeleton.bones.length&&Object.keys(skeleton.animations).length);for(const page of fs.readFileSync(path.join(base,'images/spine',boss.atlas),'utf8').split(/\r?\n/).filter(s=>/\.(png|webp)$/.test(s.trim())))has('images/spine/'+page.trim());}
console.log(`Asset contract: ${keys.length} hashes, ${pngs.length} preload entries, 52 poker cards, 24 medals, 8 Spine bosses, fonts and libraries passed`);

for(const name of ['двор','База','Хабар','Сводка'])for(const suffix of ['', ' hover'])has('images/'+name+suffix+'.png');
for(const boss of ['ohotnik','schastlivchik','yastreb','mecheniy','krys','barkut','boroda','zhgut'])has('images/layers/popups/bosses/boss_'+boss+'.png');
const narration=fs.readFileSync(path.join(root,'_client/src/game/onboarding/onboarding-data.js'),'utf8');
for(const [,name] of narration.matchAll(/['"](?:\.\/)?sounds\/([^'"]+\.mp3)['"]/g))has('sounds/'+name);
has('images/хабар отмена подписки.png');

for(const [,name] of narration.matchAll(/SOUND_BASE \+ ['"]([^'"]+\.mp3)['"]/g))has('sounds/'+name);

// Pixi spritesheets resolve PNG pages through JSON meta.image, not through JS.
let atlasPages=0;
for(const file of keys.filter(n=>n.endsWith('.json'))){
 const json=JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
 if(!json.meta || !json.meta.image)continue;
 const page=path.posix.normalize(path.posix.join(path.posix.dirname(file),json.meta.image));
 assert(!page.startsWith('../'));has(page);atlasPages++;
 for(const related of json.meta.related_multi_packs || [])has(path.posix.join(path.posix.dirname(file),related));
}
assert(atlasPages>=4,'Core Pixi spritesheets must be checked');
console.log('JSON atlas texture pages verified:',atlasPages);
