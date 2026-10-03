/**
 * Test: на экране боя с боссом (bosses_fight.js) универсальный редактор позиций
 * не мог двигать полоску HP, рамки-фоны под аватарки рейтинга урона и полоску
 * прогресса навыков — все они PIXI.Graphics, а хит-тест редактора
 * (_uFindTopmost, universal_pos_editor.js) считает целью только Sprite/Text либо
 * Graphics, явно помеченные флагом _uDraggable = true (тот же приём, что и для
 * красной точки-маркера в рулетке, см. tests/roulette-reward-marker.test.js).
 *
 * Фикс: расставлен _uDraggable = true на hpBarBg/hpBar, avBg (рамки рейтинга,
 * ×3 в цикле) и progBg/progBar. Полноэкранный blocker и invisible hit-зоны
 * (hitBuy/hitCancel в попапе "нет оружия") флаг НЕ получают — их перетаскивание
 * не имеет смысла и увеличивало бы риск случайно зацепить их вместо нужного объекта.
 *
 * Run: node tests/bossfight-draggable-graphics.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8'
);

console.log('\nTest 1: hpBarBg/hpBar помечены _uDraggable');
{
    // 25.09.2026 (регресс найден повторным прогоном тестов): полоска ХП переведена с
    // Graphics-заливки на PIXI.Sprite (присланные PNG — прогрессия/фулл/половина/конец), см.
    // boss-hp-bar-images-and-precision.test.js. Флаг _uDraggable сохранён как есть (безвреден
    // и на Sprite), регекс обновлён под новый конструктор.
    const m = src.match(/const hpBarBg = new PIXI\.Sprite\(/);
    assert(!!m, 'hpBarBg — теперь PIXI.Sprite (не Graphics)');
    const chunk = src.slice(src.indexOf('const hpBarBg = new PIXI.Sprite('), src.indexOf('this._bossFightHpBar = hpBar;'));
    assert(/hpBarBg\._uDraggable = true;/.test(chunk), 'hpBarBg._uDraggable = true');
    assert(/hpBar\._uDraggable = true;/.test(chunk), 'hpBar._uDraggable = true');
}

console.log('\nTest 2: avBg (декоративный серый фон под аватаром рейтинга) убран целиком (26.09.2026, "убери серые прямоугольники")');
{
    // avBg был decorative PIXI.Graphics-подложкой под frameSpr ("боевка рамка фотки для
    // рейтинга.png") — по прямому указанию убран, frameSpr сам даёт нужное обрамление.
    // Регресс-гвард: не должен вернуться незаметно (например, при копипасте цикла).
    assert(!/const avBg = new PIXI\.Graphics\(\);/.test(src), 'avBg не возвращён — decorative фон под аватаром рейтинга остаётся убранным');
}

console.log('\nTest 3: progBg/progBar (полоска прогресса навыков) помечены _uDraggable');
{
    // 25.09.2026 (регресс найден повторным прогоном тестов): та же замена Graphics→Sprite, что
    // и у полоски ХП (см. Test 1) — "полоса пустая"/"полоса заполнения".
    const m = src.match(/const progBg = new PIXI\.Sprite\(/);
    assert(!!m, 'progBg — теперь PIXI.Sprite (не Graphics)');
    const chunk = src.slice(src.indexOf('const progBg = new PIXI.Sprite('), src.indexOf('this._bossFightProgBar = progBar;'));
    assert(/progBg\._uDraggable = true;/.test(chunk), 'progBg._uDraggable = true');
    assert(/progBar\._uDraggable = true;/.test(chunk), 'progBar._uDraggable = true');
}

console.log('\nTest 4: служебные click-catcher/blocker Graphics флаг НЕ получили');
{
    const mBlocker = src.match(/const blocker = new PIXI\.Graphics\(\);([\s\S]*?)win\.addChild\(blocker\);/);
    assert(!!mBlocker && !/_uDraggable/.test(mBlocker[1]), 'полноэкранный blocker без _uDraggable');
    // 24.09.2026: hitBuy/hitCancel перевели с прямоугольного PIXI.Graphics на
    // makeParallelogramHit() (popup-hit-shapes.js) — тот же параллелограммный хелпер, что
    // уже применён в confirm.js/sound.js/nick.js — форма ближе к реальному PNG. Хелпер не
    // проставляет _uDraggable сам по себе, проверяем это здесь же.
    const buyIdx = src.indexOf('const hitBuy = makeParallelogramHit(');
    assert(buyIdx !== -1, 'hitBuy создан через makeParallelogramHit()');
    const buyChunk = src.slice(buyIdx, buyIdx + 200);
    assert(!/_uDraggable/.test(buyChunk), 'hitBuy (invisible hit-зона) без _uDraggable');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
