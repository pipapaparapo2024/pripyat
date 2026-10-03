/**
 * Test: 04.10.2026, по прямому указанию — "1 картинка ты растянул фон блекджека не нужно это
 * делать вставляй файл в натуральном размере" (отменяет правку 03.10.2026, тогда просили
 * letterbox-вписывание со scale 1.3218×, w:1108 h:690).
 *
 * dvor-blackjack.js: bg больше НЕ получает width/height (никакого масштабирования) — нативный
 * размер файла 838×522, центрирован в области 1280×690 (y от 15): x=(1280-838)/2=221,
 * y=15+(690-522)/2=99.
 *
 * Зависимая подсветка строки "ТАБЛИЦЫ ВЫПЛАТ" (BJ_ROW_X/BJ_ROW_W/BJ_ROW_Y/BJ_ROW_H) была
 * откалибрована 03.10.2026 под letterbox-масштаб — пересчитана той же пропорцией (доля от
 * старого 1280×690 файла) под новый нативный размер/позицию.
 *
 * Run: node tests/blackjack-bg-native-size-no-stretch.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-blackjack.js'), 'utf-8');

console.log('\nTest 1: фон блэкджека вставляется без width/height — нативный размер, центрирован');
{
    const start = src.indexOf("new PIXI.Sprite(PIXI.Texture.from(BASE + 'блекджек фон v2.png'))");
    const line = src.slice(start, src.indexOf('\n', start) + 60);
    assert(/bg\.x = 221; bg\.y = 99;/.test(line), 'bg.x=221 (центр по ширине 1280 для 838px), bg.y=99 (центр по высоте 690 от y=15 для 522px)');
    assert(!/bg\.width = \d+; bg\.height = \d+;/.test(line), 'width/height больше НЕ выставляются (никакого масштабирования)');
}

console.log('\nTest 2: координаты подсветки таблицы выплат пересчитаны под нативный размер фона');
{
    assert(/const BJ_ROW_X = 895, BJ_ROW_W = 279, BJ_ROW_H = 37;/.test(src),
        'BJ_ROW_X/W/H пересчитаны пропорционально новой позиции/размеру фона');
    // 04.10.2026 (повторная правка тем же днём — реальный замер ВСЕХ 9 строк разом через
    // редактор позиций): заменяет предыдущую калибровку по одной точке ("семерки").
    assert(/'туз':\s*245,/.test(src), 'BJ_ROW_Y.туз — реальный замер (не экстраполяция)');
    assert(/'__nonpair':\s*522,/.test(src), 'BJ_ROW_Y.__nonpair — реальный замер (не экстраполяция)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
