/**
 * Test: батч 22.09.2026 (по прямому указанию, скриншоты редактора позиций) —
 *
 * 1) Кнопка «МОИ ДОСТИЖЕНИЯ» (саб-таб) сдвинута по X: 789→801 (Y не менялся) — координата
 *    снята пользователем через универсальный редактор позиций.
 * 2) «мои достижения пассив.png» имел 12px лишнего прозрачного поля СПРАВА (186×35 при реальном
 *    видимом контенте 174×35, замер по альфа-каналу) — тот же класс бага, что уже чинили у
 *    «друзья актив.png» (asymmetric padding между актив/пассив вариантами одной кнопки при
 *    anchor(0.5,0.5) сдвигает видимый центр). Файл обрезан до 174×35, теперь идентичен по
 *    размеру «мои достижения актив.png».
 * 3) «кароточка достижений.png» (671×149, видимый рисунок только в строках 43..112 = 70px)
 *    обрезан до реальных границ (671×70) — предыдущий фикс (21.09.2026) компенсировал это
 *    только в раскладке (CARD_VISIBLE_TOP-сдвиг), но текстура оставалась полноразмерной, из-за
 *    чего редактор позиций и хит-зона клика (`card.interactive`) по-прежнему видели/ловили
 *    полные 149px, включая прозрачные поля. Теперь текстура == видимый контент.
 *
 * Run: node tests/svod-achievements-tab-position-and-transparent-padding-crop.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const leaderboardSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-leaderboard.js'), 'utf-8');
const achievementsSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');

// Читает width/height прямо из IHDR-чанка PNG (байты 16..23 после 8-байтной сигнатуры) —
// без внешних зависимостей/шелл-вызовов python (ломались на Windows из-за кириллицы в пути).
function pngSize(filePath){
    const buf = fs.readFileSync(filePath);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

console.log('\nTest 1: SUBTAB_SECOND_X сдвинут на 801 (было 789), Y не тронут');
{
    assert(/const SUBTAB_SECOND_X = 801, SUBTAB_SECOND_Y = 191;/.test(leaderboardSrc),
        'svod-leaderboard.js: SUBTAB_SECOND_X=801, SUBTAB_SECOND_Y=191');
}

console.log('\nTest 2: файлы достижений-таба обрезаны до одинакового реального размера (174×35)');
{
    const IMG_DIR = path.join(root, '_client', 'development', 'images');
    const activ  = pngSize(path.join(IMG_DIR, 'мои достижения актив.png'));
    const passiv = pngSize(path.join(IMG_DIR, 'мои достижения пассив.png'));
    assert(activ.width === 174 && activ.height === 35, 'мои достижения актив.png остался 174×35 (реально: ' + activ.width + 'x' + activ.height + ')');
    assert(passiv.width === 174 && passiv.height === 35, 'мои достижения пассив.png теперь тоже 174×35 (реально: ' + passiv.width + 'x' + passiv.height + ', было 186×35)');
}

console.log('\nTest 3: «кароточка достижений.png» обрезан до 672×70 (было 672×149)');
{
    const IMG_DIR = path.join(root, '_client', 'development', 'images');
    const card = pngSize(path.join(IMG_DIR, 'кароточка достижений.png'));
    assert(card.width === 672 && card.height === 70, 'кароточка достижений.png теперь 672×70 (реально: ' + card.width + 'x' + card.height + ')');
}

console.log('\nTest 4: svod-achievements.js — CARD_VISIBLE_TOP убран из кода, раскладка считается от 0 (крой уже сдвинул точку отсчёта)');
{
    assert(!/const CARD_VISIBLE_TOP/.test(achievementsSrc), 'CARD_VISIBLE_TOP как константа больше не объявлен');
    assert(/const CARD_VISIBLE_H = 70;/.test(achievementsSrc), 'CARD_VISIBLE_H=70 остался единственным источником высоты карточки');
    assert(/const ICON_CENTER_Y   = CARD_VISIBLE_H \/ 2;/.test(achievementsSrc), 'ICON_CENTER_Y = CARD_VISIBLE_H/2 (было CARD_VISIBLE_TOP + .../2)');
    // 22.09.2026: NAME_Y уточнён редактором позиций дважды тем же днём (5→14→11).
    assert(/const NAME_Y = 11;/.test(achievementsSrc), 'NAME_Y = 11 (было 5, затем 14, затем ещё раз уточнено редактором позиций)');
    assert(/const DESC_Y          = 29;/.test(achievementsSrc), 'DESC_Y = 29 (было CARD_VISIBLE_TOP + 26, затем 26, затем уточнено редактором позиций)');
    assert(/const PTS_Y           = 50;/.test(achievementsSrc), 'PTS_Y = 50 (было CARD_VISIBLE_TOP + 50)');
    assert(/const CARD_STEP = CARD_VISIBLE_H \+ CARD_GAP;/.test(achievementsSrc), 'CARD_STEP по-прежнему = видимая высота + зазор');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
