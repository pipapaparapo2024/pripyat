/**
 * Test: точечные позиционные правки (замерено редактором позиций) —
 * таймер и имя босса на экране боя, "купить актив.png" на попапе покупки патрона,
 * и ряд 0 панели "РЕЙТИНГ УРОНА" (фиксированные координаты, не по общей формуле rowY).
 *
 * Run: node tests/bosses-fight-positions-round2.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const fightSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8'
);
const yashikSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'yashik.js'), 'utf-8'
);

console.log('\nTest 1: имя босса и таймер боя — координаты/масштаб (супersedeн 25.09.2026)');
{
    // 25.09.2026 (регресс найден повторным прогоном тестов): новые координаты по редактору
    // позиций + цвет #F0F0F0 + шрифт чуть тоньше (bold→normal), см.
    // boss-name-timer-reposition-color.test.js для полной проверки.
    assert(/bossNameTxt\.x = 92; bossNameTxt\.y = 92; bossNameTxt\.scale\.set\(1\.404\);/.test(fightSrc),
        'имя босса x:92 y:92 scale:1.404');
    assert(/timerTxt\.x = 80; timerTxt\.y = 203; timerTxt\.scale\.set\(1\.624\);/.test(fightSrc),
        'таймер x:80 y:203 scale:1.624');
}

console.log('\nTest 2: yashik.js — "купить актив.png" (историческая позиция (16,8) была багом, см. yashik-buy-patron-hitbox-and-hover-fix.test.js)');
{
    // 25.09.2026: (16,8) оказалась никак не связана с реальной позицией кнопки КУПИТЬ
    // (448,359) — подсветка рисовалась в левом верхнем углу попапа. Исправлено на компенсацию
    // от реальной позиции кнопки (тем же приёмом, что был у cancelActiv), затем сам файл
    // 'купить актив.png' заменён на верно обрезанный (236×105), позиционирование переведено на
    // anchor(0.5,0.5) + центр hitBuy — и наконец, тем же днём, уточнено точными координатами из
    // редактора позиций (564,413) вместо формулы-центра. См.
    // tests/kupit-activ-button-art-fix-and-habar-days-position.test.js для полной проверки.
    assert(/buyActiv\.x = 564; buyActiv\.y = 413; buyActiv\.scale\.set\(1\.000\);/.test(yashikSrc),
        'buyActiv выровнена относительно реальной позиции кнопки КУПИТЬ (564,413), не (16,8)');
}

console.log('\nTest 3: "РЕЙТИНГ УРОНА" — единая раскладка для всех 3 строк (замер редактором 14.09.2026)');
{
    // Правка round3 заменила прежний особый случай ROW0_OVERRIDE (ряд 0 отдельно, ряды 1/2
    // по формуле rowY=532+r*62) на единые по X координаты + явные массивы Y на строку —
    // см. tests/hunter-habar-skills-energy-round.test.js Test 7 для полной проверки.
    assert(!/const ROW0_OVERRIDE/.test(fightSrc), 'особый случай ROW0_OVERRIDE убран');
    // 26.09.2026: +1 к X/Y каждой строки (позиция+масштаб уточнены редактором позиций ещё раз,
    // avSpr переведён с фиксированного 42×42 на scale.set(0.542) — см. Test 7 в
    // hunter-habar-skills-energy-round.test.js для полной проверки этого блока.
    // 29.09.2026: ещё одно точечное уточнение редактором — x:37,y:541,scale:0.472 для строки 0
    // (было x:33,y:536,scale:0.500), та же дельта (+4/+5) перенесена на строки 1/2.
    assert(/const FRAME_X = 27, FRAME_Y = \[528, 589, 652\];/.test(fightSrc) && /const AV_X = 32, AV_Y = \[532, 593, 656\];/.test(fightSrc), 'рамки и фото рейтинга — актуальные координаты');
    // 03.10.2026 (редактор позиций, по прямому указанию): VAL_X 281→282, VAL_Y [560,620,680]→[558,618,678].
    assert(/const VAL_X = 282, VAL_Y\s*= \[558, 618, 678\];/.test(fightSrc), 'значение "× N" — единый X=282, Y по строкам');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
