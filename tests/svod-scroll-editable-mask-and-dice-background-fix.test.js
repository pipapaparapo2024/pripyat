/**
 * Test: батч 22.09.2026 (по прямому указанию) —
 *
 *  1) svod-scroll.js: маска списка (mask viewport) теперь ДОСТУПНА для редактирования через
 *     universal_pos_editor.js — помечена _uDraggable=true (тот же общий механизм, что уже
 *     используется для текст-боксов/Graphics-меток, БЕЗ единой правки в самом редакторе —
 *     _uCollectAt уже подхватывает любой объект с этим флагом). Геометрия прямоугольника
 *     перенесена в (0,0) локальных координат, offset — в maskGfx.x/y, чтобы редактор показывал
 *     x/y как ГОТОВОЕ значение viewX/viewY для копирования в код. Этот же модуль переиспользуют
 *     И достижения, И лидерборд Сводки — фикс общий для обоих ("проблема не только здесь").
 *     ВАЖНО: interactive НЕ ставится — иначе маска (выше карточек по z-order) перехватывала бы
 *     клики по карточкам (аккордеон достижений) даже вне режима редактора.
 *
 *  2) svod-scroll.js: бегунок скролла сдвинут на -1px по X (было точно по центру трека).
 *
 *  3) dvor-dice-screen.js: фон экрана "Зарики" был дефектным файлом (серые прямоугольники-
 *     артефакты в углах + впечатанная "0" рядом с ПОИНТЫ) — заменён содержимым эталона от
 *     пользователя, передискретизирован в те же 1280×705, что и раньше (имя файла/код рендера
 *     не менялись — обновилось только содержимое картинки).
 *
 * Run: node tests/svod-scroll-editable-mask-and-dice-background-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const svodScrollSrc = readSrc('_client/src/game/svod/svod-scroll.js');

console.log('\nTest 1: svod-scroll.js — маска списка помечена _uDraggable, но НЕ interactive (не перехватывает обычные клики)');
{
    const start = svodScrollSrc.indexOf('const maskGfx = new PIXI.Graphics();');
    const end   = svodScrollSrc.indexOf('parent.addChild(maskGfx);', start);
    assert(start !== -1 && end !== -1, 'блок создания maskGfx найден');
    const body = svodScrollSrc.slice(start, end);

    assert(/maskGfx\.drawRect\(0, 0, viewW, viewH\);/.test(body), 'геометрия рисуется в (0,0) — не сразу в (viewX,viewY)');
    assert(/maskGfx\.x = viewX; maskGfx\.y = viewY;/.test(body), 'offset вынесен в maskGfx.x/y — редактор покажет готовое viewX/viewY');
    assert(/maskGfx\._uDraggable = true;/.test(body), 'маска помечена _uDraggable — подхватывается общим механизмом редактора');
    assert(!/maskGfx\.interactive = true;/.test(body),
        'interactive НЕ ставится — иначе маска (добавлена в parent ПОСЛЕ cardsContainer, значит выше по z-order) перехватывала бы клики по карточкам даже вне режима редактора');
}

console.log('\nTest 2: svod-scroll.js — бегунок скролла сдвинут на -1px');
{
    assert(/thumb\.x = trackX - Math\.round\(\(thumb\.width - track\.width\) \/ 2\) - 1;/.test(svodScrollSrc),
        'формула позиции бегунка получила "-1" в конце (было без него)');
}

console.log('\nTest 3: dvor-dice-screen.js — задний фон зариков рендерится тем же способом (BASE+файл, y=15); 02.10.2026 (найдено при разборе полного прогона tests/, см. dice-screen-correct-themed-background.test.js): файл с тех пор переименован на "задний фон зарики новыйй.png" (новая картинка, без дата-комментария с обоснованием, но реально 1280×705 и в предзагрузке) — код рендера (BASE+имя, y=15) не менялся, меняется только проверяемое имя файла');
{
    const diceScreenSrc = readSrc('_client/src/game/dvor/dvor-dice-screen.js');
    assert(/const bg = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'задний фон зарики новыйй\.png'\)\);/.test(diceScreenSrc),
        'код рендера фона не менялся (BASE+имя файла, Sprite/Texture.from) — указывает на актуальное имя "задний фон зарики новыйй.png"');
    assert(/bg\.y = 15;/.test(diceScreenSrc), 'позиционирование (y=15) не менялось');
}

console.log('\nTest 4: файл-ассет "задний фон зарики новыйй.png" реально существует на диске и имеет 1280×705');
{
    const { execSync } = require('child_process');
    const imgPath = path.join(root, '_client', 'development', 'images', 'задний фон зарики новыйй.png');
    assert(fs.existsSync(imgPath), 'файл существует локально');
    // Проверяем натуральный размер через IHDR-заголовок PNG (offset 16-24) — тот же приём,
    // что уже использовался в этом проекте для чтения PNG-размеров без внешних библиотек.
    const buf = fs.readFileSync(imgPath);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    assert(w === 1280 && h === 705, `натуральный размер файла остался 1280×705 (получено ${w}×${h})`);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
