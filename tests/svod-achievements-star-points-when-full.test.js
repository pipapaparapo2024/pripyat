/**
 * «Мои достижения» — число очков ВНУТРИ звёздочки-индикатора прогресса (27.09.2026, по прямому
 * указанию, скриншот со стрелкой на звёздочку справа от карточки: "если звёздочка полная, то
 * нужно в ней писать кол-во очков достижений которое даёт либо вся категория (если категория
 * выполнена), либо конкретное достижение, если оно одно в списке").
 *
 * 04.10.2026 (повторный репорт, по прямому указанию — "я уже просил это сделать, но там ничего
 * не выводится"): условие "только при starProgress===1" убрано — для многотировых тем (урон/
 * автоматы/стволы и т.п., 10+ тиров) оно выполнялось только при заработке АБСОЛЮТНО ВСЕХ тиров
 * темы, что почти никогда не происходит рано — звезда оставалась пустой даже когда младшие тиры
 * уже заработаны. Теперь число — это opts.totalPtsEarned (сумма уже заработанных тиров темы) для
 * базовой карточки/одиночного достижения, и a.pts (если тир уже заработан) для строки тира.
 *
 * Run: node tests/svod-achievements-star-points-when-full.test.js
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf8');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

console.log('\nstarPtsTxt создан в пуле карточек, спозиционирован на самой звезде, скрыт по умолчанию');
assert(/const starPtsTxt = new PIXI\.Text\('', \{ fontFamily:'Southbank LT', fontSize:12, fill:'#ffffff', fontWeight:'bold' \}\);/.test(src),
    'новый текстовый узел под число очков внутри звезды');
// 29.09.2026 (по прямому указанию): x сдвинут на +1px (star.x + 1) — число сидело чуть левее
// геометрического центра иконки; y по-прежнему совпадает со star/starFill.
assert(/starPtsTxt\.x = star\.x \+ 1; starPtsTxt\.y = star\.y;/.test(src), 'позиция — на звезде, с поправкой +1px по X (та же Y-точка, что star/starFill)');
assert(/starPtsTxt\.visible = false;/.test(src), 'по умолчанию скрыт в пуле (как и остальные элементы карточки)');

console.log('\nstarPtsTxt попадает в co (пул переиспользуемых карточек)');
assert(/const co = \{ card, iconTxt, nameTxt, descTxt, ptsTxt, checkMark, starsGotBadge, bar, barFillMask, fracTxt, star, starFill, starFillMask, starPtsTxt,/.test(src),
    'starPtsTxt добавлен в объект co рядом с остальными элементами карточки');

console.log('\n_fillCard — видимость и текст звезды считаются от starProgress и showBar/themeComplete');
const noComments = src.replace(/\/\/[^\n]*\n\s*/g, '');
// 04.10.2026: earnedStarPts больше не гейтится starProgress===1 — для строки тира (isTierRow)
// показывает a.pts, только если этот тир уже заработан (done), для базовой карточки темы/
// одиночного достижения — всегда opts.totalPtsEarned (сумма уже заработанных тиров, 0 если
// ещё ничего не заработано). Видимость дополнительно требует earnedStarPts>0, чтобы не
// показывать "0" внутри пустой звезды.
assert(/const earnedStarPts = isTierRow \? \(done \? \(a\.pts \|\| 0\) : 0\) : \(opts\.totalPtsEarned \|\| 0\);/.test(noComments),
    'число — totalPtsEarned для темы/одиночного достижения, a.pts (если done) для строки тира — без гейта на starProgress===1');
assert(/c\.starPtsTxt\.visible = earnedStarPts > 0;/.test(noComments), 'видимость текста звезды = earnedStarPts > 0');
assert(/c\.starPtsTxt\.text = earnedStarPts > 0 \? String\(earnedStarPts\) : '';/.test(noComments),
    'значение — a.pts для одиночного достижения/тира (showBar), opts.totalPtsEarned для полностью завершённой многотирной темы (иначе)');

console.log('\nОбновление звезды идёт ДО смены её текстуры/заливки прогресса (тот же вызов _fillCard)');
const starBlockIdx = noComments.indexOf('const earnedStarPts = isTierRow ? (done ? (a.pts || 0) : 0) : (opts.totalPtsEarned || 0);');
const textureIdx = noComments.indexOf("c.star.texture = PIXI.Texture.from(IMG + 'звездочка пустая.png');");
assert(starBlockIdx > -1 && textureIdx > -1 && starBlockIdx < textureIdx,
    'блок starPtsTxt расположен перед сбросом текстуры/заливки звезды (порядок в _fillCard)');

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);
