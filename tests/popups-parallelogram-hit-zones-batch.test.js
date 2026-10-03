/**
 * Test: батч 24.09.2026 (по прямому указанию + референс-скриншот "точно хочешь купить" с
 * рамкой редактора позиций поверх ОТМЕНА показывающей прямоугольную, не параллелограммную,
 * хит-зону) — единый стиль хит-зон popup-кнопок с диагональными боковыми срезами (как уже
 * сделано для попапа настройки звука, shell/popups/sound.js) применён ещё к 3 попапам, которые
 * раньше использовали обычный прямоугольник (PIXI.Graphics.drawRect):
 *   - weapons.js — «точно хочешь купить.png» (окно подтверждения покупки оружия)
 *   - yashik.js  — «купить патрон для ящика.png» (окно подтверждения покупки патрона)
 *   - yashik.js  — «попап ошибка.png»/_openSidorovichError (кнопка ПОНЯТНО, единая на 16 мест
 *     использования, включая репорт "ошибочка вышла иди к сидоровичу")
 *
 * Остальные 4 попапа из полного списка пользователя уже были на параллелограммной хит-зоне ДО
 * этого батча — не трогались: sound.js (эталон), confirm.js, nick.js,
 * bosses_fight.js._openNoWeaponPopup (см. no-weapon-popup-parallelogram-hitzones.test.js).
 *
 * Координаты — те же x/y/width/height, что были у прежних прямоугольников (пользователь просил
 * поставить именно уже вписанные координаты, не новые).
 *
 * Run: node tests/popups-parallelogram-hit-zones-batch.test.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

console.log('\nweapons.js — «точно хочешь купить» — hitBuy/hitCancel переведены на makeParallelogramHit');
{
    const src = read('_client/src/game/weapons.js');
    assert(/import \{ makeParallelogramHit \} from '\.\/shell\/popups\/popup-hit-shapes\.js';/.test(src), 'импорт добавлен');
    // 26.09.2026 (по скриншоту — хитбокс КУПИТЬ был заметно больше кнопки, залезал в текст
    // выше): приведён к размеру ОТМЕНА (227×48, Y=386), X свой (430).
    assert(/const hitBuy = makeParallelogramHit\(cw, 430, 386, 227, 48, 18\);/.test(src),
        'hitBuy — размер/Y как у ОТМЕНА (227×48, y:386), X свой (430)');
    assert(/const hitCancel = makeParallelogramHit\(cw, 665, 386, 227, 48, 18\);/.test(src),
        'hitCancel — те же координаты (665,386,227,48), что были у прежнего drawRect (именно эта рамка была смещена на скриншоте)');
    assert(!/hitBuy\.drawRect|hitCancel\.drawRect/.test(src), 'старый прямоугольный Graphics.drawRect для этих хит-зон не остался');
}

console.log('\nyashik.js — «купить патрон для ящика» — hitBuy/hitCancel переведены на makeParallelogramHit');
{
    const src = read('_client/src/game/shell/overlays/yashik.js');
    assert(/import \{ makeParallelogramHit \} from '\.\.\/popups\/popup-hit-shapes\.js';/.test(src), 'импорт добавлен');
    // 25.09.2026: высота была 105 (в 2 раза больше ОТМЕНЫ) — хит-зона накрывала текст над
    // кнопкой, приведена к 48 (та же высота, что и у hitCancel), см.
    // yashik-buy-patron-hitbox-and-hover-fix.test.js для полной проверки этого фикса.
    assert(/const hitBuy = makeParallelogramHit\(win, 448, 359, 236, 48, 18\);/.test(src),
        'hitBuy — координаты (448,359,236,48) — высота приведена к hitCancel (была 105)');
    assert(/const hitCancel = makeParallelogramHit\(win, 683, 393, 227, 48, 18\);/.test(src),
        'hitCancel — те же координаты (683,393,227,48), что были у прежнего локального makeHit()');
    assert(!/const makeHit = \(x, y, w, h\)/.test(src), 'локальный прямоугольный makeHit() helper удалён (не осталось мёртвого кода)');

    console.log('\nyashik.js — _openSidorovichError (попап "попап ошибка.png", кнопка ПОНЯТНО) — тоже параллелограмм');
    assert(/const okHit = makeParallelogramHit\(popup, 226, 395, 276, 95, 18\);/.test(src),
        'okHit — bounding box кнопки ПОНЯТНО (native 501×172 * scale 0.55, центр 364/442 -> top-left 226/395)');
    assert(/okBtn\.interactive/.test(src) === false, 'сам спрайт okBtn больше не interactive напрямую — кликабельность вынесена в отдельную хит-зону');
    assert(/okHit\.on\('pointerdown', \(\)=>\{ if\(win\.parent\) win\.parent\.removeChild\(win\); this\._sidErrorWin = null; \}\);/.test(src),
        'обработчик закрытия попапа перенесён на новую хит-зону');
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);
