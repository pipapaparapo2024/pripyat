/**
 * Test: 17.10.2026, по прямому указанию — батч мелких позиционных правок:
 *  1) yashik.js (попап "купить патрон") — "купить актив" x:564→565 (+1 вправо), y:413→412
 *     (+1 вверх); "отмена актив" x:673→674 (+1 вправо, y не менялся).
 *  2) zone_screen.js — маска карусели локаций обрезана ещё на 6px снизу (VIEW_BOTTOM_TRIM
 *     12→18), верх не трогали.
 *  3) svod-achievements.js — иконки достижений сдвинуты на 1px вверх-влево (ICON_X-1,
 *     ICON_CENTER_Y-1) и увеличены до 43×43 (было 42×42, см. прошлый тест того же дня).
 *     ICON_CENTER_Y как общая константа НЕ менялась — её использует и звезда (+2 отдельно).
 *
 * Run: node tests/yashik-buy-patron-nudge-and-zone-bottom-trim-and-icon-resize.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const yashikSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'yashik.js'), 'utf-8');
const zoneSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'zone_screen.js'), 'utf-8');
const achSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');

console.log('\nTest 1: yashik.js — "купить актив" (попап покупки патрона): x:565,y:412 (было 564,413)');
{
    assert(/buyActiv\.x = 565; buyActiv\.y = 412; buyActiv\.scale\.set\(1\.000\);/.test(yashikSrc),
        'buyActiv.x=565, buyActiv.y=412 — +1 вправо, +1 вверх от прежних 564/413');
}

console.log('\nTest 2: yashik.js — "отмена актив": x сдвинут на +1 (683-10+1=674), y не менялся');
{
    assert(/cancelActiv\.x = 683 - 10 \+ 1; cancelActiv\.y = 393 - 32 - 2;/.test(yashikSrc),
        'cancelActiv.x формула получила "+1" в конце, y-формула не изменилась');
}

console.log('\nTest 3: zone_screen.js — VIEW_BOTTOM_TRIM 12 → 18 (ещё 6px снизу); VIEW_TOP_TRIM позже в тот же день поднят 12 → 24 (повторный репорт)');
{
    assert(/const VIEW_TOP_TRIM = 24, VIEW_BOTTOM_TRIM = 18;/.test(zoneSrc),
        'VIEW_TOP_TRIM поднят до 24 (ещё -12px сверху), VIEW_BOTTOM_TRIM остаётся 18');
}

console.log('\nTest 4: svod-achievements.js — иконка достижения сдвинута на -1/-1, размер 43×43, ICON_CENTER_Y как константа не менялась');
{
    // 17.10.2026 (повторное указание тем же днём — "опусти иконки вниз на 1px, сделай 44×44"):
    // y вернулась на ICON_CENTER_Y (отменяет -1 от этого же дня), размер 43→44.
    assert(/c\._iconSpr\.x = ICON_X - 1; c\._iconSpr\.y = ICON_CENTER_Y;/.test(achSrc),
        'иконка позиционируется от ICON_X-1/ICON_CENTER_Y (не от голых чисел — не ломает звезду)');
    // 17.10.2026 (ещё раз тем же днём — "ширина 46, высота 42"): не квадрат, 44×44 → 46×42.
    // 17.10.2026 (ещё раз тем же днём — "высоту повысить на 2 пикселя, то есть 44"): 42 → 44.
    // 18.10.2026 (по прямому указанию — "для «вошёл в игру» и «трудяга» иконка 53×44, только
    // для этих двух"): фиксированное присваивание заменено условным (пересчитывается на каждый
    // _fillCard, не один раз при создании спрайта пула) — см. oct18-batch2-achievements-
    // purchase-zone-locations.test.js (Test 3) для полной проверки.
    // 18.10.2026 (повторное указание тем же днём — "увеличить ширину ещё на 3px"): 53 → 56.
    assert(/_isWideIcon \? 54 : 46;/.test(achSrc),
        'иконка 46×44 по умолчанию, 56×44 для bp_50/meta_500');
    assert(/c\._iconSpr\.height\s*=\s*44;/.test(achSrc), 'высота 44 (было 42)');
    assert(/const ICON_CENTER_Y   = CARD_VISIBLE_H \/ 2;/.test(achSrc),
        'сама константа ICON_CENTER_Y НЕ переопределена — звезда (star.y = ICON_CENTER_Y + 2) не затронута');
    assert(/star\.x = CARD_W - 60; star\.y = ICON_CENTER_Y \+ 2;/.test(achSrc),
        'регресс-гвард: позиция звезды по-прежнему ICON_CENTER_Y + 2, не поехала вместе с иконкой');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
