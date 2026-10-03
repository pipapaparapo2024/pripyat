/**
 * Проверяет чистую карточку достижений: без "статуса"/стрелки раскрытия (текст очков теперь
 * ЕСТЬ, см. svod-achievements-earned-points-checkmark-and-star-badge.test.js — 24.09.2026,
 * по прямому указанию, отменяет прежнее "текст очков не выводится") и с серой звездой, поверх
 * которой цвет показывает пройденную часть темы против часовой стрелки.
 * Run: node tests/svod-achievements-clean-ui-and-star-progress.test.js
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf8');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

console.log('\nКарточка достижений: чистый интерфейс и звезда прогресса');
// 26.09.2026 (по прямому указанию, скриншот — "Охотник повержен выполнен, но галочка не
// стоит, а должна стоять"): галочка больше не скрывается жёстко в ветке бара — теперь
// c.checkMark.visible = done (виден бар прогресса + галочка, если тир уже выполнен).
// 26.09.2026 (повторный репорт тем же днём — "нет ни галочки, ни очков, ни значка звёзд"):
// очки/бейдж звёзд ТЕПЕРЬ ТОЖЕ показываются при done (координаты стоят последовательно после
// конца бара — не перекрывают ни его, ни друг друга).
assert(/c\.checkMark\.visible = done;[\s\S]{0,40}c\.starsGotBadge\.visible = done;[\s\S]{0,60}c\.ptsTxt\.visible = done;/.test(src.replace(/\/\/[^\n]*\n\s*/g, '')), 'для строки тира галочка/очки/бейдж видны вместе если done (у тира свой прогресс-бар)');
assert(/c\.fracTxt\.visible = false;[\s\S]*?c\.fracTxt\.text = ''/.test(src), 'подпись current\/target не выводится');
assert(!/const chevron = new PIXI\.Text/.test(src), 'стрелка раскрытия отсутствует');
// 28.09.2026: card.on('pointerdown') -> helper.onTap(card) (адаптив, свайп-прокрутка списка).
assert(/helper\.onTap\(card, \(\) => \{[\s\S]*?win\._expandedKey =/.test(src), 'раскрытие темы сохранено по клику на карточку');
assert(/const star = new PIXI\.Sprite\(PIXI\.Texture\.from\(IMG \+ 'звездочка пустая\.png'\)\);/.test(src), 'серая звезда является нижним слоем');
assert(/const starFill = new PIXI\.Sprite\(PIXI\.Texture\.from\(IMG \+ 'звездочка фулл\.png'\)\);[\s\S]*?starFill\.mask = starFillMask;/.test(src), 'цветная звезда накладывается поверх через маску');
assert(/const angle = -Math\.PI \/ 2 - \(Math\.PI \* 2 \* fraction \* i \/ segments\);/.test(src), 'сектор заполняется от верхней точки против часовой стрелки');
assert(/const earnedMembers = members\.filter\(tier => !!earned\[tier\.id\]\);[\s\S]*?const earnedCount = earnedMembers\.length;[\s\S]*?const starProgress = members\.length \? earnedCount \/ members\.length : 0;/.test(src), 'доля звезды равна числу выполненных достижений категории');
console.log(`\n✅ All ${passed} tests passed`);
