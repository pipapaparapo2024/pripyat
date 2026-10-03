/**
 * Test: батч 25.09.2026 (по прямому указанию + скриншот) — "у кнопки КУПИТЬ в попапе покупки
 * патрона какой-то очень странный хотбар, на кнопке ОТМЕНА нормальный".
 *
 * Корень: makeParallelogramHit(win, 448, 359, 236, 105, 18) для КУПИТЬ — высота 105px, больше
 * чем в 2 раза выше соседней ОТМЕНА (48px) — хит-зона накрывала текст "ПАТРОН СТОИТ..." НАД
 * самой кнопкой, а не только саму кнопку. Заодно найден и исправлен второй, самостоятельный баг
 * того же попапа: hover-подсветка buyActiv.png стояла на x=16,y=8 — координаты, никак не
 * связанные с реальной позицией кнопки (448,359) — подсветка рисовалась в левом верхнем углу
 * попапа вместо самой кнопки, в отличие от cancelActiv, которая корректно смещена от hitCancel
 * той же компенсацией внутреннего отступа спрайта.
 *
 * Run: node tests/yashik-buy-patron-hitbox-and-hover-fix.test.js
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

console.log('\nTest 1: hitBuy — высота приведена к той же, что у hitCancel (48px), позиция/ширина не тронуты');
{
    assert(/const hitBuy = makeParallelogramHit\(win, 448, 359, 236, 48, 18\);/.test(yashikSrc),
        'hitBuy: height=48 (было 105) — та же высота, что у соседней ОТМЕНА');
    assert(/const hitCancel = makeParallelogramHit\(win, 683, 393, 227, 48, 18\);/.test(yashikSrc),
        'sanity: hitCancel не менялся, height=48 как и был — общий эталон формы');
}

console.log('\nTest 2: buyActiv (hover-подсветка КУПИТЬ) выровнена относительно hitBuy — anchor(0.5,0.5) + центр hitBuy');
{
    // 25.09.2026 (тем же днём, повторный репорт скриншотом — "нет варианта Актив, вернулась
    // старая ошибка"): выяснилось, что сам файл 'купить актив.png' на сервере был битым
    // (полноэкранный холст с кнопкой где-то внутри) — заменён на верно обрезанный (236×105).
    // Компенсация "-10/-32-2" была подобрана под старый (предположительно небольшой, но не
    // измеренный точно) файл — с новым точно измеренным (236×105, контент почти по центру
    // канваса) она больше не нужна: anchor(0.5,0.5) + явный центр hitBuy проще и не зависит от
    // внутренних отступов конкретного файла. Тем же днём уточнено точными координатами из
    // редактора позиций (564,413) вместо формулы-центра. См. tests/kupit-activ-button-art-fix-
    // and-habar-days-position.test.js для полной проверки этого фикса.
    const s = yashikSrc.indexOf("const buyActiv = new PIXI.Sprite");
    const e = yashikSrc.indexOf('win.addChild(buyActiv);');
    const body = yashikSrc.slice(s, e);
    assert(/buyActiv\.x = 564; buyActiv\.y = 413; buyActiv\.scale\.set\(1\.000\);/.test(body),
        'buyActiv выровнена относительно РЕАЛЬНОЙ позиции кнопки КУПИТЬ (564,413), не от произвольных (16,8)');
    assert(!/buyActiv\.x = 16; buyActiv\.y = 8;/.test(yashikSrc), 'старые координаты (16,8) нигде не остались');

    const cs = yashikSrc.indexOf("const cancelActiv = new PIXI.Sprite");
    const ce = yashikSrc.indexOf('win.addChild(cancelActiv);');
    const cancelBody = yashikSrc.slice(cs, ce);
    assert(/cancelActiv\.x = 683 - 10; cancelActiv\.y = 393 - 32 - 2;/.test(cancelBody),
        'sanity: cancelActiv не менялась — эталон компенсации, с которым сверялся фикс buyActiv');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
