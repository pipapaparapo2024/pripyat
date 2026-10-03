/**
 * Test: 26.09.2026, по прямому указанию — новый файл "заполнение шкалы ящика.png"
 * (x:449, y:99, тот же размер, что и старая заливка 452×44 — нативный размер файла 452×45,
 * без искажений при растяжении). "Эта система работает так же, как шкала достижений, так же,
 * как шкалы ХП у боссов" — заливка прогресс-бара ящика (наполняется по ach_score) переведена с
 * плоского перекрашиваемого Graphics.drawRect() на статичный PNG-спрайт + растущая по ширине
 * Graphics-маска поверх него — тот же паттерн, что уже используется в svod-achievements.js.
 *
 * Run: node tests/yashik-progress-bar-png-mask-fill.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const yashikSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'yashik.js'), 'utf-8');
const bootSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'game-boot.js'), 'utf-8');

console.log('\nTest 1: координаты прогресс-бара обновлены (449,99), размер бара не менялся (452×44)');
{
    assert(/const BAR_X = 449, BAR_Y = 99, BAR_W = 452, BAR_H = 44;/.test(yashikSrc),
        'BAR_X/BAR_Y обновлены на 449/99, BAR_W/BAR_H без изменений');
}

console.log('\nTest 2: заливка — статичный PNG-спрайт + Graphics-маска (тот же приём, что у бара достижений)');
{
    assert(/const barFill = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'заполнение шкалы ящика\.png'\)\);/.test(yashikSrc),
        'barFill — Sprite с новым файлом (не Graphics)');
    assert(/barFill\.width = BAR_W; barFill\.height = BAR_H;/.test(yashikSrc), 'спрайт растянут на полный размер бара один раз при создании');
    assert(/const barFillMask = new PIXI\.Graphics\(\);/.test(yashikSrc), 'отдельная Graphics-маска создана');
    assert(/barFill\.mask = barFillMask;/.test(yashikSrc), 'маска назначена именно спрайту заливки');
    assert(!/const barFill = new PIXI\.Graphics\(\);/.test(yashikSrc), 'старая Graphics-заливка убрана целиком');
}

console.log('\nTest 3: _updateYashikScreen() перерисовывает МАСКУ (растущий прямоугольник), не красит Graphics напрямую');
{
    const start = yashikSrc.indexOf('proto._updateYashikScreen');
    const body = yashikSrc.slice(start, start + 1200);
    assert(/this\._yashikBarFillMask\.clear\(\);/.test(body), 'маска очищается перед перерисовкой');
    assert(/this\._yashikBarFillMask\.drawRect\(0, 0, fillW, this\._yashikBarH\);/.test(body),
        'маска рисуется в ЛОКАЛЬНЫХ координатах (0,0), ширина растёт пропорционально ach_score/threshold');
    assert(!/this\._yashikBarFill\.beginFill\(0xcc7200/.test(body), 'старая заливка сплошным цветом убрана');
}

console.log('\nTest 4: новый файл добавлен в прелоад (game-boot.js)');
{
    assert(/'заполнение шкалы ящика\.png'/.test(bootSrc), 'файл присутствует в списке прелоада window._allGamePngs');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
