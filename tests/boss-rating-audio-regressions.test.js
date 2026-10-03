const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const sounds={};for(const [p,n] of [['bg_music_',2],['dvor_music_',3],['zone_ambient_',5]]) for(let i=0;i<n;i++) sounds[p+i]={volume:1};
const ctx={window:{_sndVol:0,_musVol:0.8,PIXI:{}},PIXI:{sound:{volumeAll:0.2,exists:k=>!!sounds[k],find:k=>sounds[k]}},console:{log(){}}};
vm.createContext(ctx);vm.runInContext(read('_client/src/modules/audio-volumes.js').replace('export function','function'),ctx);
ctx.applyAudioVolumes();assert.equal(ctx.PIXI.sound.volumeAll,1);assert.equal(sounds.bg_music_0.volume,0.8);assert.equal(sounds.dvor_music_0.volume,0);
ctx.window._sndVol=1;ctx.window._musVol=0;ctx.applyAudioVolumes();assert.equal(sounds.bg_music_0.volume,0);assert.equal(sounds.zone_ambient_0.volume,1);
for(const p of ['_client/src/modules/background-music.js','_client/src/game/dvor/dvor-music.js']){const s=read(p);assert(s.includes('applyAudioVolumes();'));assert(s.includes('volume: 1,'));}
// 25.09.2026: zone-ambient.js получил нарастание громкости для одного трека (звуки зона 3,
// см. screen-transition-compass-loader.test.js/тест этого батча) — 'volume: 1,' там больше не
// голая строка, а часть тернарника 'volume: isFadeIn ? 0.001 : 1,'; проверяем это явно.
{const s=read('_client/src/game/shell/overlays/zone-ambient.js');assert(s.includes('applyAudioVolumes();'));assert(s.includes('volume: isFadeIn ? 0.001 : 1,'));}
const popup=read('_client/src/game/shell/popups/sound.js');assert(popup.includes('applyAudioVolumes();'));assert(!popup.includes('volumeAll = soundVol'));
const src=read('_client/src/game/shell/overlays/bosses_fight.js');const begin=src.indexOf('proto._fetchBossFightRating =');const end=src.indexOf('    // ── ТАЙМЕР',begin);
// 04.10.2026 (баг найден по прямому указанию — "урон засчитывается, но игроки не выводятся в
// рейтинге урона"): ник/урон теперь выставляются СИНХРОННО из top (не ждут _resolveVkUsers) —
// только АВАТАРКА по-прежнему приходит асинхронно и должна игнорировать устаревший ответ.
let request,resolve;const rows=[{nameTxt:{},dmgTxt:{},avSpr:{}}];const c={proto:{},bosses:{_bossStartMs:[[100]],_resolveVkUsers(ids,cb){resolve=cb;}},TS:{php(action,args,cb){request=cb;}},console:{log(){}},window:{},PIXI:{Texture:{EMPTY:'empty'}}};vm.createContext(c);vm.runInContext(src.slice(begin,end),c);
const ui={...c.proto,_bossFightDiffIdx:0,_bossFightRatingRows:rows};ui._fetchBossFightRating(0);request({top:[{id:1,damage:1000,nick:'one'}]});
assert.equal(rows[0].dmgTxt.text,'× 1000','text/nick update synchronously from a legitimately-current response, no longer gated behind the avatar resolve callback');
c.bosses._bossStartMs[0][0]=200;resolve({});
assert.equal(rows[0].avSpr.texture,undefined,'stale avatar callback for an old fight must not touch the row once a new fight has started');
ui._fetchBossFightRating(0);c.bosses._bossStartMs[0][0]=0;request({top:[{id:1,damage:12200}]});assert.equal(rows[0].dmgTxt.text,'× 1000','response for an already-ended fight (bossStartMs reset) must not overwrite the last legitimate value');
ui._showBossFightRating([{id:1,damage:1000,nick:'one'}]);resolve({});assert.equal(rows[0].dmgTxt.text,'× 1000');
console.log('PASS: independent music/effects, stale fight responses, final rating snapshot');
