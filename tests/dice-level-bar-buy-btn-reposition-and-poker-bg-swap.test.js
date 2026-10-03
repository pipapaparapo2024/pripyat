/**
 * Test: батч 19.09.2026 — точный снимок пользователя через встроенный редактор позиций
 * (universal_pos_editor.js) для 4 элементов экрана «Зарики», плюс замена фонового файла
 * экрана «Покер» на новый (папка «сводка», файл «покер экран .png», 1016×532 — другое
 * разрешение, чем у прежнего файла 1280×690).
 *
 * Координаты из readout редактора (x/y/w/h/scale = сырые s.x/s.y/s.width/s.height/s.scale.x,
 * см. universal_pos_editor.js._uUpdateReadout — без анкор-коррекции, готовые к прямой записи):
 *  - шкала уровня (фон+тонированная копия): x=370 y=97 w=525 h=28
 *  - кнопка «купить поинты»: x=195 y=535
 *  - текущий уровень (текст): x=342 y=113
 *  - следующий уровень (текст): x=934 y=113
 *
 * Run: node tests/dice-level-bar-buy-btn-reposition-and-poker-bg-swap.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const diceScreenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice-screen.js'), 'utf-8');
const diceSrc       = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice.js'), 'utf-8');
const pokerScreenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker-screen.js'), 'utf-8');

console.log('\nTest 1: шкала уровня зариков (фон levelScale + тонированная копия levelTrackLit) — новая позиция/размер');
{
    assert(/levelScale\.x = 370; levelScale\.y = 97;/.test(diceScreenSrc), 'levelScale: x=370 y=97');
    assert(/levelScale\.width = 525; levelScale\.height = 28;/.test(diceScreenSrc), 'levelScale: width=525 height=28');
    assert(/levelTrackLit\.x = 370; levelTrackLit\.y = 97;/.test(diceScreenSrc), 'levelTrackLit: x=370 y=97 (синхронно с фоном)');
    assert(/levelTrackLit\.width = 525; levelTrackLit\.height = 28;/.test(diceScreenSrc), 'levelTrackLit: width=525 height=28 (синхронно с фоном)');
}

console.log('\nTest 2: заливка прогресса (barFill, маска тонированной копии) синхронизирована с новой геометрией шкалы');
{
    assert(/const w = Math\.max\(0, Math\.floor\(525 \* pct\)\);/.test(diceSrc),
        'максимальная ширина заливки — 525 (было 523, синхронно с levelScale.width)');
    assert(/this\._diceExpBarFill\.drawRoundedRect\(370, 97, w, 28, 12\);/.test(diceSrc),
        'заливка рисуется от (370,97) — того же угла, что и фон шкалы (было 371,85 — рассинхрон дал бы сдвиг заливки относительно фона)');
}

console.log('\nTest 3: текст текущего/следующего уровня — новая позиция');
{
    assert(/levelTxt\.x = 342; levelTxt\.y = 113;/.test(diceScreenSrc), 'levelTxt (текущий уровень): x=342 y=113');
    assert(/nextLvlTxt\.x = 934; nextLvlTxt\.y = 113;/.test(diceScreenSrc), 'nextLvlTxt (следующий уровень): x=934 y=113');
}

console.log('\nTest 4: кнопка «купить поинты» — новая Y (X не менялся)');
{
    assert(/buyBtn\.x = 195; buyBtn\.y = 535;/.test(diceScreenSrc), 'buyBtn: x=195 (не менялся) y=535 (было 526)');
}

console.log('\nTest 5: фон экрана «Покер» заменён на новый файл и явно приведён к стандартному размеру экрана');
{
    const imgPath = path.join(root, '_client', 'development', 'images', 'poker_screen.png');
    assert(fs.existsSync(imgPath), 'poker_screen.png существует локально');
    const buf = fs.readFileSync(imgPath);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    assert(w === 1016 && h === 532, `poker_screen.png — это НОВЫЙ файл (1016×532), получили ${w}x${h}`);

    // По прямому указанию — файлы вставляются в НАТИВНОМ размере, без растяжения/сжатия под
    // произвольный размер экрана, даже если разрешение отличается от прежнего фона (1280×690).
    assert(!/bg\.width = \d+; bg\.height = \d+;/.test(pokerScreenSrc.slice(pokerScreenSrc.indexOf("Texture.from('./images/poker_screen.png')"))),
        'bg НЕ получает принудительные width/height — рендерится в родном размере файла (1016×532)');
    // 19.09.2026 (следующий батч): позиция уточнена через редактор до (157,72) — см.
    // poker-screen-darken-overlay-and-12px-reposition.test.js. Здесь только проверяем,
    // что width/height по-прежнему отсутствуют (main-проверка выше это и делает).
    assert(/const bg = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/poker_screen\.png'\)\);\s*\n\s*bg\.x = 157; bg\.y = 72;/.test(pokerScreenSrc),
        'bg.x = 157, bg.y = 72 (уточнено редактором позиций), без width/height');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
