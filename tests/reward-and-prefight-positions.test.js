/**
 * Test: точные позиции, снятые пользователем через универсальный редактор позиций, во
 * второй большой волне правок этой сессии.
 *
 * 1) reward.js — иллюстрация «не жирно будет» (countArt) для попапа с РОВНО 4 наградами
 *    была смещена/уменьшена по сравнению с формулой из layouts[4]; заменена на измеренные
 *    константы, формула для 1/2/3 наград не тронута.
 * 2) bosses_prefight.js — иконка босса (общая для всех 8 боссов, один код на всех),
 *    текст HP и кнопка НАПАСТЬ передвинуты на измеренные координаты.
 *
 * Run: node tests/reward-and-prefight-positions.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const rewardSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'popups', 'reward.js'), 'utf-8'
);
const prefightSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_prefight.js'), 'utf-8'
);

console.log('\nTest 1: reward.js — countArt для 4 наград зафиксирован на измеренных координатах');
{
    const m = rewardSrc.match(/if\(items\.length === 4\)\{([\s\S]*?)\} else \{/);
    assert(!!m, 'ветка items.length===4 найдена');
    if (m) {
        const body = m[1];
        assert(/countArt\.x = 41; countArt\.y = -91;/.test(body), 'x=41, y=-91');
        assert(/countArt\.width = 390; countArt\.height = 199;/.test(body), 'width=390, height=199');
    }
    assert(/countArt\.x = \(layout\.x - 1408 \/ 2\) \* bgScale;/.test(rewardSrc),
        'формула для 1/2/3 наград (layouts[1..3]) не тронута — используется в ветке else');
}

console.log('\nTest 2: bosses_prefight.js — иконка босса (общая для всех 8), HP-текст, кнопка НАПАСТЬ');
{
    // 26.09.2026: ещё раз уточнено редактором позиций (93,126 → 116,154, добавлен scale 0.937).
    assert(/icon\.x = 116; icon\.y = 154; icon\.scale\.set\(0\.937\);/.test(prefightSrc),
        'иконка босса на новых координатах — один код на всех 8 боссов (BOSS_ICON[bossIdx] лишь меняет файл)');
    // 26.09.2026: уточнено ещё раз редактором позиций (892,151→866,175), цвет также переведён
    // на #cbc9c9 (см. gambling-reward-highlight.test.js / отдельный тест на палитру экрана).
    assert(/xpTxt\.anchor\.set\(0\.5, 0\.5\); xpTxt\.x = 866; xpTxt\.y = 175;/.test(prefightSrc), 'HP-текст на новых координатах');
    assert(/xpTxt\.scale\.set\(1\.240\);/.test(prefightSrc), 'HP-текст увеличен (scale 1.24)');
    assert(/napBtn\.x = 880; napBtn\.y = 663;/.test(prefightSrc), 'кнопка НАПАСТЬ на новых координатах');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
