/**
 * Test: батч 25.09.2026 (по прямому указанию):
 *
 * 1) Фон экрана покера (poker_screen.png) заменён новым локальным файлом пользователя
 *    ("вкладка двор/покер экран.png", тот же размер 1016×532 — код и позиция не менялись,
 *    заменено только содержимое файла).
 * 2) Кнопка "ВСКРЫТЬСЯ" на экране покера переставлена на новую позицию, снятую через
 *    редактор позиций: x:584, y:512, scale:1.000 (было x:491, y:478).
 *
 * Run: node tests/poker-screen-swap-and-button-reposition.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker-screen.js'), 'utf-8');

console.log('\n1) Кнопка "ВСКРЫТЬСЯ" — новая позиция x:584, y:512 (scale не менялся, по умолчанию 1.0)');
{
    assert(/confirmGfx\.x = 584; confirmGfx\.y = 512;/.test(src), 'confirmGfx.x = 584, confirmGfx.y = 512');
    assert(!/confirmGfx\.x = 491; confirmGfx\.y = 478;/.test(src), 'старая позиция (491,478) нигде не осталась');
    // 29.09.2026 (по прямому указанию — "для всех кнопок небольшой hover эффект увеличения
    // scale"): confirmGfx получил scale.set() ВНУТРИ pointerover/pointerout (1.08/1) — это не
    // редкий базовый (resting) масштаб, а временный hover-эффект поверх implicit-1.0 базы,
    // которую и просили не трогать. Проверяем именно отсутствие БАЗОВОГО scale.set (вне
    // обработчиков наведения), а не полное отсутствие scale.set в файле.
    assert(!/confirmGfx\.x = 584; confirmGfx\.y = 512;\s*\n\s*confirmGfx\.scale\.set/.test(src),
        'scale по-прежнему НЕ задаётся явно сразу после позиции (нативный базовый масштаб = 1.000, как и просили — hover-scale не в счёт)');
}

console.log('\n2) Фон экрана покера — тот же путь в коде, файл заменён физически (та же ширина/высота PNG)');
{
    assert(/PIXI\.Texture\.from\('\.\/images\/poker_screen\.png'\)/.test(src), 'код по-прежнему ссылается на poker_screen.png (путь не менялся, заменён только сам файл)');
    const imgPath = path.join(root, '_client', 'development', 'images', 'poker_screen.png');
    assert(fs.existsSync(imgPath), 'файл poker_screen.png существует локально');
    const buf = fs.readFileSync(imgPath);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    assert(w === 1016 && h === 532, 'размер файла не изменился — 1016×532 (та же координатная сетка, позиции остальных элементов экрана не пересчитывались)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
