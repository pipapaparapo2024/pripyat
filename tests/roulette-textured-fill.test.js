/**
 * Test: заливка вертикальной шкалы уровня в рулетке — не плоский цветной прямоугольник
 * поверх картинки линейки, а тонированная копия ТОЙ ЖЕ картинки, замаскированная под ту
 * же геометрию — визуально выглядит как "закрашивание" самого изображения (деления и
 * текстура дерева остаются видны), а не как отдельный блок, лежащий сверху и их скрывающий.
 *
 * Run: node tests/roulette-textured-fill.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const screenSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-roulette-screen.js'), 'utf-8'
);
const roulSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-roulette.js'), 'utf-8'
);

// ── Test 1: маска не рендерится сама по себе (renderable=false) ──────────────
console.log('\nTest 1: roulLvlMask — служебная геометрия маски, сама не рисуется');
{
    assert(/const roulLvlMask = new PIXI\.Graphics\(\);/.test(screenSrc), 'roulLvlMask создан как Graphics');
    assert(/roulLvlMask\.renderable = false;/.test(screenSrc), 'renderable=false — не рисуется как обычный объект, только задаёт форму маски');
    assert(/this\._roulLvlBarFill = roulLvlMask;/.test(screenSrc), 'сохранён под тем же именем this._roulLvlBarFill (остальной код его использует)');
}

// ── Test 2: тонированная копия картинки линейки замаскирована этой геометрией ─
console.log('\nTest 2: levelTrackLit — та же текстура "уровень игры.png", тонированная и замаскированная');
{
    const m = screenSrc.match(/const levelTrackLit = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'уровень игры\.png'\)\);([\s\S]*?)win\.addChild\(levelTrackLit\);/);
    assert(!!m, 'levelTrackLit создан из той же текстуры "уровень игры.png", что и обычный levelTrack');
    if (m) {
        const body = m[1];
        assert(/levelTrackLit\.tint = 0xffab2e;/.test(body), 'тонирован (tint), а не нарисован поверх отдельным Graphics-прямоугольником');
        assert(/levelTrackLit\.mask = roulLvlMask;/.test(body), 'замаскирован той же геометрией, что раньше рисовала плоский фон');
    }
    assert(/this\._roulLvlLitSpr = levelTrackLit;/.test(screenSrc), 'ссылка сохранена как this._roulLvlLitSpr');
}

// ── Test 3: dvor-roulette.js больше не красит фон полупрозрачным плоским цветом ──
console.log('\nTest 3: _updateRouletteUI больше не рисует непрозрачный цветной прямоугольник поверх картинки');
{
    assert(!/beginFill\(0xe38b08, 0\.65\);/.test(roulSrc),
        'старый полупрозрачный оранжевый Graphics-фон убран (был "плоским блоком поверх картинки")');
    assert(/this\._roulLvlBarFill\.beginFill\(0xffffff, 1\);/.test(roulSrc),
        'маска рисуется сплошным цветом (значение цвета не используется — важна только форма/альфа)');
}

// ── Test 4: геометрия заливки (позиция/поворот/размер) не изменилась ─────────
console.log('\nTest 4: сама геометрия/поворот шкалы сохранены (визуальный размер бара не поехал)');
{
    assert(/this\._roulLvlBarFill\.pivot\.set\(989, 125\);/.test(roulSrc), 'pivot не изменился');
    assert(/this\._roulLvlBarFill\.rotation = \(2 \/ 7\) \* Math\.PI \/ 180;/.test(roulSrc), 'наклон уменьшен в 7 раз по просьбе (было 2°, стало 2/7°)');
    assert(/const TRACK_H = 407; const TRACK_BOTTOM = 532; const TRACK_X = 977; const TRACK_W = 23;/.test(roulSrc),
        'размеры трека (TRACK_H/BOTTOM/X/W) не тронуты');
}

// ── Test 5: видимость "закрашенной" копии переключается по ratio ─────────────
console.log('\nTest 5: levelTrackLit скрыт при ratio=0 (иначе была бы видна тонированная линейка без прогресса)');
{
    assert(/if\(this\._roulLvlLitSpr\) this\._roulLvlLitSpr\.visible = ratio > 0;/.test(roulSrc),
        'visible = ratio > 0 — тонированная копия видна только когда есть прогресс');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
