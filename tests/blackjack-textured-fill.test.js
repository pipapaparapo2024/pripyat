/**
 * Test: заливка вертикальной шкалы уровня в блэкджеке — тот же фикс, что и в рулетке
 * (см. tests/roulette-textured-fill.test.js): не плоский цветной прямоугольник поверх
 * картинки линейки, а тонированная копия ТОЙ ЖЕ картинки, замаскированная под ту же
 * геометрию. Плюс угол наклона уменьшен в 7 раз (было 2°, как жаловались на рулетку —
 * тот же артефакт был и в блэкджеке, но раньше его не тронули).
 *
 * Run: node tests/blackjack-textured-fill.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-blackjack.js'), 'utf-8'
);

// ── Test 1: маска не рендерится сама по себе ──────────────────────────────────
console.log('\nTest 1: _bjLevelFill — служебная геометрия маски, сама не рисуется');
{
    assert(/const levelFill = new PIXI\.Graphics\(\);\s*\n\s*levelFill\.renderable = false;/.test(src),
        'levelFill.renderable = false сразу после создания');
    assert(/this\._bjLevelFill = levelFill;/.test(src), 'сохранён как this._bjLevelFill');
}

// ── Test 2: тонированная копия линейки замаскирована этой геометрией ────────
console.log('\nTest 2: levelTrackLit — тонированная копия "уровень игры.png", замаскированная levelFill');
{
    const m = src.match(/const levelTrackLit = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'уровень игры\.png'\)\);([\s\S]*?)win\.addChild\(levelTrackLit\);/);
    assert(!!m, 'levelTrackLit создан из "уровень игры.png"');
    if (m) {
        const body = m[1];
        assert(/levelTrackLit\.tint = 0xffab2e;/.test(body), 'тонирован (tint)');
        assert(/levelTrackLit\.mask = levelFill;/.test(body), 'замаскирован levelFill');
    }
    assert(/this\._bjLevelTrackLit = levelTrackLit;/.test(src), 'сохранён как this._bjLevelTrackLit');
}

// ── Test 3: _updateBlackjackUI рисует маску сплошным цветом, угол /7 ─────────
console.log('\nTest 3: _updateBlackjackUI — маска сплошным цветом, угол уменьшен в 7 раз');
{
    assert(/this\._bjLevelFill\.beginFill\(0xffffff, 1\);/.test(src),
        'маска рисуется сплошным цветом (цвет не важен — только форма/альфа)');
    assert(/this\._bjLevelFill\.rotation = \(2 \/ 7\) \* Math\.PI \/ 180;/.test(src),
        'угол наклона = 2/7° (уменьшен в 7 раз, как в рулетке)');
    assert(!/this\._bjLevelFill\.beginFill\(0xe38b08, 0\.65\);/.test(src),
        'старый полупрозрачный оранжевый Graphics-фон убран');
    assert(/if\(this\._bjLevelTrackLit\) this\._bjLevelTrackLit\.visible = fillH > 0;/.test(src),
        'тонированная копия видна только когда есть прогресс (fillH > 0)');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
