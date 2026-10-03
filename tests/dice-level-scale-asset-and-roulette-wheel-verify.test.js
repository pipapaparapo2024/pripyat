/**
 * Test: 2 правки по заменённым художником ассетам.
 *
 * 1) Зарики — добавлен новый ассет "шкала уровня зарики.png" для горизонтальной
 *    полоски уровня (раньше рисовалась чистой Graphics-заливкой без текстуры). Теперь
 *    используется тот же паттерн "фон + маска + тонированная копия", что и в
 *    вертикальной шкале блэкджека (см. dvor-blackjack.js).
 *
 * 2) Рулетка — художник заменил "рулетка колесо.png" (перенумеровал сектора подряд
 *    1-15). Пул наград (SLOTS) сверен вручную с новой картинкой по позициям на круге —
 *    полностью совпадает, код без изменений (кроме уточнения комментария).
 *
 * Run: node tests/dice-level-scale-asset-and-roulette-wheel-verify.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game', 'dvor');
const diceScreenSrc = fs.readFileSync(path.join(root, 'dvor-dice-screen.js'), 'utf-8');
const diceSrc       = fs.readFileSync(path.join(root, 'dvor-dice.js'), 'utf-8');
const roulScreenSrc = fs.readFileSync(path.join(root, 'dvor-roulette-screen.js'), 'utf-8');

console.log('\nTest 1: зарики — шкала уровня использует новый ассет с маской-тонировкой (как в блэкджеке)');
{
    assert(/PIXI\.Texture\.from\(BASE \+ 'шкала уровня зарики\.png'\)/.test(diceScreenSrc), 'фоновый спрайт шкалы использует новый ассет');
    assert(/levelTrackLit\.tint = 0xffab2e;/.test(diceScreenSrc), 'тонированная копия — тот же цвет, что у блэкджека');
    assert(/levelTrackLit\.mask = barFill;/.test(diceScreenSrc), 'тонированная копия замаскирована Graphics-заливкой (не отрисовывается напрямую)');
    assert(/this\._diceLevelTrackLit = levelTrackLit;/.test(diceScreenSrc), 'ссылка на тонированную копию сохранена для управления видимостью');

    assert(/this\._diceLevelTrackLit\.visible = w > 0;/.test(diceSrc), '_updateDiceScreenUI переключает видимость тонированной копии по факту заполнения');
    // 19.09.2026: позиция/размер шкалы уточнены через редактор позиций (371,85→370,97; 523→525),
    // см. dice-level-bar-buy-btn-reposition-and-poker-bg-swap.test.js.
    assert(/this\._diceExpBarFill\.drawRoundedRect\(370, 97, w, 28, 12\);/.test(diceSrc), 'маска рисуется по актуальным координатам ассета (370,97,525,28)');
}

console.log('\nTest 2: рулетка — комментарий про сектора обновлён под новую картинку (1-15 подряд, без разрыва)');
{
    assert(/Художник заменил картинку 14\.09\.2026/.test(roulScreenSrc), 'комментарий отражает актуальное состояние арта колеса');
    assert(/Сама\s*\n\s*\/\/ последовательность наград по позициям на круге НЕ изменилась/.test(roulScreenSrc),
        'явно зафиксировано, что пул наград сверен и не менялся');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
