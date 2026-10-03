/**
 * Test: 28.09.2026 — свайп-прокрутка списков Сводки пальцем + хелпер helper.onTap.
 *
 * Корень проблемы: по всему проекту клик — это 'pointerdown', то есть действие срабатывает в
 * момент КАСАНИЯ. Мышью незаметно, пальцем — фатально: свайп по списку всегда начинается с
 * какой-то карточки/строки, и она нажималась раньше, чем игрок успевал сдвинуть палец. Поэтому
 * свайп-прокрутку нельзя было добавить, пока элементы внутри списков не переведены на
 * "тап = pointerup без смещения".
 *
 * Батч: helper.onTap (общий хелпер) + перевод на него двух обработчиков ВНУТРИ прокручиваемой
 * области (карточка достижения, строка топа) + сам свайп в общем svod-scroll.js. Кнопки ВНЕ
 * списков (выход, вкладки, стрелки скролла) намеренно остались на pointerdown — там реакция на
 * касание ощущается быстрее, и бага у них нет.
 *
 * Run: node tests/svod-swipe-scroll-and-tap-helper.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf-8');
const helper = R('_client', 'src', 'modules', 'universal_helper.js');
const scroll = R('_client', 'src', 'game', 'svod', 'svod-scroll.js');
const ach    = R('_client', 'src', 'game', 'svod', 'svod-achievements.js');
const lead   = R('_client', 'src', 'game', 'svod', 'svod-leaderboard.js');

console.log('\nTest 1: helper.onTap — тап отличается от протяжки');
{
    assert(/onTap\(obj, fn, threshold = 10\)\{/.test(helper), 'метод объявлен, порог по умолчанию 10px');
    assert(/obj\.on\('pointerup'/.test(helper), 'действие выполняется на ОТПУСКАНИИ, а не на касании');
    const body = helper.slice(helper.indexOf('onTap(obj, fn, threshold'), helper.indexOf('touchPad(obj, minLogical'));
    assert(/Math\.abs\(e\.data\.global\.x - sx\) > threshold \|\| Math\.abs\(e\.data\.global\.y - sy\) > threshold/.test(body),
        'смещение дальше порога помечает жест как протяжку');
    assert(/const wasTap = active && !moved;/.test(body), 'колбэк вызывается только если жест остался тапом');
    assert(/obj\.on\('pointerupoutside'/.test(body), 'палец, ушедший с объекта, тапом не считается');
    assert(/obj\.interactive = true;/.test(body) && /obj\.buttonMode  = true;/.test(body),
        'onTap сам включает интерактивность — вызывающему не нужно дублировать');
}

console.log('\nTest 2: содержимое списков Сводки переведено на onTap');
{
    // Строки-комментарии выкидываем: в обоих файлах осталось пояснение вида "было
    // card.on('pointerdown', ...)" — упоминание в комментарии не должно считаться кодом.
    const code = (s) => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

    assert(/helper\.onTap\(card, \(\) => \{/.test(ach), 'карточка достижения (аккордеон) — через onTap');
    assert(!/card\.on\('pointerdown'/.test(code(ach)), 'старого card.on(pointerdown) в коде не осталось');
    assert(/helper\.onTap\(row, \(\)=>\{ if\(row\._playerId/.test(lead), 'строка топа (профиль игрока) — через onTap');
    assert(!/row\.on\('pointerdown'/.test(code(lead)), 'старого row.on(pointerdown) в коде не осталось');

    // Кнопки ВНЕ списка остаются на pointerdown — это осознанно, не недоделка.
    assert(/subAll\.on\('pointerdown'/.test(ach) && /subAll\.on\('pointerdown'/.test(lead),
        'переключатели вкладок по-прежнему на pointerdown (мгновенная реакция, бага нет)');
    assert(/arrowUp\.on\('pointerdown',   \(\)=> setScroll/.test(scroll),
        'стрелки пошагового скролла по-прежнему на pointerdown');
}

console.log('\nTest 3: svod-scroll.js — свайп по содержимому');
{
    assert(/if\(window\.isMobile\)\{/.test(scroll), 'свайп включается только на тач-устройствах (на десктопе остаётся колесо)');
    assert(/const dragSurface = new PIXI\.Graphics\(\);/.test(scroll), 'есть поверхность для протяжек в пустом месте между карточками');
    assert(/parent\.addChildAt\(dragSurface, 0\);/.test(scroll),
        'поверхность добавлена ПЕРВОЙ (ниже содержимого) — не перехватывает нажатия по карточкам');
    assert(/beginFill\(0x000000, 0\.0001\)/.test(scroll), 'поверхность невидима, но участвует в хит-тесте');

    assert(/if\(!parent\.visible \|\| scrollRange <= 0\) return;/.test(scroll),
        'свайп не запускается на скрытом экране и в списке, который целиком помещается');
    assert(/if\(t === thumb \|\| t === arrowUp \|\| t === arrowDown\) return;/.test(scroll),
        'нажатие на бегунок/стрелки всплывает до parent — протяжка содержимого при этом НЕ запускается (иначе список едет вдвое быстрее)');
    assert(/setScroll\(dragStartScrollY - \(e\.data\.global\.y - dragStartPointerY\)\);/.test(scroll),
        'содержимое едет ЗА пальцем (палец вниз — список вниз)');
    assert(/root\.on\('pointermove',      onDragMove\);/.test(scroll),
        'move слушается на корне сцены — палец во время протяжки уезжает с исходного объекта');

    // Утечка слушателей корня — самый вероятный способ сломать всю игру этой фичей.
    assert(/let dragCleanup = null;/.test(scroll), 'снятие слушателей хранится локально, а не на this (две вкладки строят два скролла)');
    assert(/root\.off\('pointermove',      onDragMove\);/.test(scroll), 'слушатель корня снимается');
    assert(/if\(dragCleanup\) dragCleanup\(\);/.test(scroll), 'снятие вызывается из destroy() скролла');
}

console.log('\nTest 4: магазин шмоток и выбор боссов — тот же свайп по рецепту');
{
    const shop  = R('_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js');
    const boss  = R('_client', 'src', 'game', 'shell', 'overlays', 'bosses_select.js');
    const code  = (s) => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

    // Элементы ВНУТРИ прокручиваемых областей — на onTap.
    assert(/helper\.onTap\(frame, \(\)=> this\._onShmotClick\(item\)\);/.test(shop), 'магазин: ячейка предмета — через onTap');
    assert(!/frame\.on\('pointerdown'/.test(code(shop)), 'магазин: старого frame.on(pointerdown) в коде нет');
    assert(/helper\.onTap\(napP, _onNapastClick\);/.test(boss) && /helper\.onTap\(napA, _onNapastClick\);/.test(boss),
        'боссы: кнопка «Напасть» на карточке — через onTap');
    assert(/helper\.onTap\(spr, \(\)=>\{ if\(window\.iface\) iface\._openPlayerProfile\(k\.id/.test(boss),
        'боссы: фото убившего — через onTap');
    assert(!/napP\.on\('pointerdown'/.test(code(boss)), 'боссы: старого napP.on(pointerdown) в коде нет');

    // Оба экрана: вместо drag-поверхности — проверка геометрии (у них есть полноэкранный
    // интерактивный blocker/win.interactive, событие и так доходит всплытием).
    for (const [name, src, thumb] of [['магазин', shop, 'scrollThumb'], ['боссы', boss, 'scrollThumb']]) {
        assert(new RegExp('if\\(e\\.target === ' + thumb + '\\) return;').test(src),
            name + ': нажатие на бегунок не запускает вторую прокрутку');
        assert(/win\.toLocal\(e\.data\.global\)/.test(src), name + ': проверяется, что палец опустился внутри списка');
        assert(/win\.on\('pointerdown', onSwipeStart\);/.test(src), name + ': старт свайпа ловится всплытием до win');
        assert(/root\.on\('pointermove',      onSwipeMove\);/.test(src), name + ': move слушается на корне сцены');
        assert(/root\.off\('pointermove',      onSwipeMove\);/.test(src), name + ': слушатели корня снимаются');
        assert(/if\(window\.isMobile\)\{/.test(src), name + ': свайп только на тач-устройствах');
    }
    assert(/if\(this\._shopSwipeCleanup\) this\._shopSwipeCleanup\(\);/.test(shop),
        'магазин: снятие вызывается при выходе с экрана');
    assert(/if\(this\._bossSelectSwipeCleanup\) this\._bossSelectSwipeCleanup\(\);/.test(boss),
        'боссы: снятие вызывается при выходе с экрана');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
