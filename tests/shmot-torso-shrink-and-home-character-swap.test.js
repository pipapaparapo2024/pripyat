/**
 * Test: 24.09.2026, по прямому указанию, три отдельные правки:
 *
 * 1) Все шмотки типа "торс" (cat:1) уменьшены в 6 раз (manScale:0.167 ≈ 1/6, они раньше не
 *    имели manScale и рендерились eq.manScale||1 = натуральный размер), КРОМЕ явно исключённых
 *    id55 (Майка Баркут), id87 (Футболка Тинейджер), id99 (Футболка Зарики) — последние два уже
 *    имели свой отдельный manScale:0.1 (не 1/6), не тронуты. Майка Баркут (id55) вместо этого
 *    получила позиционную поправку manDx:1, manDy:4 (даёт x:805 y:262 от базы 804/258).
 * 2) dvor-poker-screen.js — уровень покера центрирован через общий window._centerTextIn().
 * 3) home.js — главный экран: персонаж заменён на новый файл, голова теперь выше торса по
 *    z-индексу, добавлено левое предплечье выше торса по z-индексу.
 *
 * Run: node tests/shmot-torso-shrink-and-home-character-swap.test.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

const shmotSrc = read('_client/src/game/shmot.js');
const pokerScreenSrc = read('_client/src/game/dvor/dvor-poker-screen.js');
const homeSrc = read('_client/src/game/home.js');

// 24.09.2026: здесь был тест на "торс уменьшен в 6 раз, manScale:0.167" (id55 Майка Баркут —
// единственное исключение, с позиционной поправкой manDx:1/manDy:4).
// 25.09.2026 (по прямому указанию — новая эталонная позиция для ВСЕХ торс-предметов): весь
// 6x-shrink-подход заменён — теперь ВСЕ торс-предметы (кроме Футболки Тинейджер) используют
// ТУ ЖЕ позицию, что и Майка Баркут (manDx:1, manDy:4, без отдельного manScale), включая
// бывшие "id87/id99 новые координаты" ниже — они тоже отменены новым общим правилом (кроме
// id87, который снова стал явным исключением, но уже с другими числами). Полная актуальная
// проверка — tests/shmot-batch-25-09-torso-shorts-forearm-hand-items.test.js.
console.log('\nШмотки-торс (cat:1) — историческая правка 24.09.2026 заменена батчем 25.09.2026 (см. shmot-batch-25-09-torso-shorts-forearm-hand-items.test.js)');
assert(/\{id:55, cat:1, name:'Майка \(Баркут\)',[\s\S]{0,220}?manDx:1, manDy:4,/.test(shmotSrc),
    'id55 (Майка Баркут) — эталон manDx:1/manDy:4 остаётся в силе (теперь применяется ко всем торс-предметам, а не как исключение)');

console.log('\nУровень покера — центрирован по горизонтали через общий хелпер');
// 25.09.2026: бокс снят заново через редактор позиций (было x:434 y:97 w:51 h:29).
assert(/window\._centerTextIn\(levelTxt, \{x:439, y:98, w:58, h:27\}\);/.test(pokerScreenSrc),
    'levelTxt центрирован в текст-боксе, снятом редактором позиций (было лево-выровнено x=467 y=100)');

console.log('\nГлавный экран — новый персонаж, голова выше торса, добавлено предплечье');
assert(/PIXI\.Texture\.from\('\.\/images\/персонаж который сидит\.png'\)/.test(homeSrc),
    'персонаж грузится из нового файла "персонаж который сидит.png"');
assert(!/const persTex = PIXI\.Texture\.from\('\.\/images\/pers\.png\?v=188'\);\s*\n\s*this\._persSpr = new PIXI\.Sprite\(persTex\);\s*\n\s*this\._persSpr\.anchor\.set\(0, 0\);\s*\n\s*this\._persSpr\.x = 506;/.test(homeSrc),
    'старая ссылка на pers.png для главного экрана заменена (не осталась дублем)');
assert(/this\._persSpr\.width = 273;\s*\n\s*this\._persSpr\.height = 389;/.test(homeSrc),
    'явные width/height сохраняют прежний видимый размер персонажа (совпадает с натуральным pers.png)');
// pers.png остаётся нетронутым в остальных 4 местах — не должны были трогать (комментарии,
// объясняющие ЭТО решение, упоминают "pers.png" текстом — проверяем реальный вызов загрузки).
assert(!/PIXI\.Texture\.from\('\.\/images\/pers\.png/.test(homeSrc), 'в home.js больше нет ни одного PIXI.Texture.from(pers.png) (заменён на новый файл)');
['base.js', 'shell/overlays/hata.js', 'shell/overlays/player_profile.js', 'shell/overlays/shmot_shop.js'].forEach(f => {
    const src = read('_client/src/game/' + f);
    assert(/pers\.png/.test(src), 'pers.png НЕ тронут в ' + f + ' (правка касалась только главного экрана)');
});

const clothSlotsIdx = homeSrc.indexOf('const CLOTH_SLOTS = [');
const clothSlotsEnd = homeSrc.indexOf('];', clothSlotsIdx);
const clothSlotsBody = homeSrc.slice(clothSlotsIdx, clothSlotsEnd);
const cat3Pos = clothSlotsBody.indexOf('cat: 3');
const cat1Pos = clothSlotsBody.indexOf('cat: 1');
const cat0Pos = clothSlotsBody.indexOf('cat: 0');
assert(cat3Pos !== -1 && cat1Pos !== -1 && cat0Pos !== -1, 'все три слота (Обувь/Торс/Голова) найдены в CLOTH_SLOTS');
assert(cat1Pos < cat0Pos, 'Торс (cat:1) стоит в массиве РАНЬШЕ Головы (cat:0) — addChild-порядок = z-порядок, значит Голова рисуется поверх Торса');

assert(/this\._leftForearmSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/левое предплечье\.png'\)\);/.test(homeSrc),
    'добавлен новый спрайт левого предплечья');
const forearmIdx = homeSrc.indexOf('this._leftForearmSpr = new PIXI.Sprite');
const clothForEachEnd = homeSrc.indexOf('this.updateClothes();');
assert(forearmIdx > clothForEachEnd, 'предплечье добавляется В СЦЕНУ ПОСЛЕ всего цикла CLOTH_SLOTS.forEach (включая Торс) — значит z-индекс выше торса');

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);
