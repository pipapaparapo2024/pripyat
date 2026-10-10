/**
 * Test: батч 26.09.2026 (по прямому указанию):
 *
 *  1) Красная точка-калибратор (rewardMarker, dvor-roulette-screen.js) убрана целиком —
 *     отладочный маркер (x=693,y=323, красный круг d=12) появлялся поверх стрелки колеса
 *     после каждого спина и был не нужен в проде.
 *
 *  2) Мини-игра "9 стаканчиков" — раскладка стаканчиков переведена с сетки 3×3 на ОДИН ряд
 *     (так на фоне мини-игры нарисован стол): 1-й стаканчик x=216 y=431, шаг по X — 93px
 *     (=ширина стаканчика впритык), Y один и тот же для всех 9. Координаты — центр спрайта
 *     (anchor 0.5,0.5), координаты сняты редактором позиций по прямому указанию пользователя.
 *
 * Run: node tests/roulette-cup-row-layout-and-reward-marker-removed.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\n1) dvor-roulette-screen.js — rewardMarker (красная точка) убран целиком');
{
    const src = read('_client/src/game/dvor/dvor-roulette-screen.js');
    assert(!/rewardMarker/.test(src), 'ни создания, ни использования rewardMarker в файле больше нет');
    assert(!/0xff2020/.test(src), 'заливка красного круга (0xff2020) убрана вместе с маркером');
    assert(!/this\._roulRewardMarker/.test(src), 'ссылка this._roulRewardMarker больше нигде не хранится/не читается');
}

console.log('\n2) dvor-roulette-minigame.js — стаканчики в ОДИН ряд, координаты 216/431, шаг 93');
{
    const src = read('_client/src/game/dvor/dvor-roulette-minigame.js');
    // 10.10.2026 (по прямому указанию — "все эти файлы стаканчиков опусти вниз на 50 пикселей"):
    // CUP_Y 431→481.
    assert(/const START_X = 216, CUP_Y = 481, STEP_X = 93;/.test(src), 'константы раскладки — x=216 первый, y=481 для всех (опущено на 50px 10.10.2026), шаг 93');
    assert(/const x = START_X \+ i \* STEP_X;/.test(src), 'X растёт равномерно с шагом STEP_X для всех 9 индексов');
    assert(/const y = CUP_Y;/.test(src), 'Y одинаковый для всех стаканчиков (не зависит от индекса)');
    assert(!/const col = i % COLS, row = Math\.floor\(i \/ COLS\);/.test(src), 'старая сетка 3×3 (col/row по модулю) удалена');
    assert(/const CW = 93, CH = 140;/.test(src), 'хит-бокс/фит-бокс подогнан под шаг 93 (native-масштаб ~1.0 для закрытого стаканчика)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
