/**
 * Test: батч 19.09.2026 — по прямому указанию пользователя (снимок через редактор позиций,
 * скриншот с открытым покером):
 *
 *  1) Фон покера (poker_screen.png, 1016×532 — заменён предыдущим батчем, но без явной позиции
 *     остался у левого верхнего угла, что не совпадало с макетом) — новая точная позиция
 *     x:157 y:72 (снята редактором), по-прежнему без width/height (натуральный размер, как и
 *     требовалось раньше — "не меняй разрешение файлов").
 *  2) Фон меньше канваса (1016×532 против 1280×720) — по краям, где фона нет, просвечивал
 *     предыдущий экран. Добавлено полноэкранное затемнение (0x000000/0.6 — тот же стиль, что
 *     у остальных попапов проекта: notifications.js/skills.js/level_up.js/reward.js/yashik.js),
 *     нарисованное ДО фона (позади него).
 *  3) ВСЕ остальные элементы экрана покера (кнопки/тексты/карты/подсветка комбинаций) подняты
 *     на 12px — единая правка, применённая сразу по всему экрану (фон в этот сдвиг НЕ входит —
 *     его позиция уже была задана отдельно и точно через редактор).
 *
 * Run: node tests/poker-screen-darken-overlay-and-12px-reposition.test.js
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

console.log('\nTest 1: фон покера — точная позиция из редактора (157,72), по-прежнему без width/height');
{
    assert(/bg\.x = 157; bg\.y = 72;/.test(src), 'bg.x = 157, bg.y = 72');
    const bgBlock = src.slice(src.indexOf("Texture.from('./images/poker_screen.png')"), src.indexOf("Texture.from('./images/poker_screen.png')") + 200);
    assert(!/bg\.width|bg\.height/.test(bgBlock), 'фон по-прежнему БЕЗ принудительных width/height (родной размер файла)');
}

console.log('\nTest 2: полноэкранное затемнение добавлено ПОЗАДИ фона, тот же стиль (0x000000/0.6), что у остальных попапов проекта');
{
    const darkIdx = src.indexOf('darkBg.beginFill(0x000000, 0.6);');
    const bgIdx   = src.indexOf("const bg = new PIXI.Sprite(PIXI.Texture.from('./images/poker_screen.png'));");
    assert(darkIdx !== -1, 'darkBg.beginFill(0x000000, 0.6) найден (тот же стиль, что notifications.js/skills.js/reward.js/yashik.js)');
    assert(bgIdx !== -1 && darkIdx < bgIdx, 'затемнение добавляется В КОД РАНЬШЕ фона — значит рисуется позади него');
    assert(/darkBg\.drawRect\(0, 0, 1280, 720\);/.test(src), 'затемнение покрывает весь канвас 1280×720, не только область фона');
}

console.log('\nTest 3: все прочие элементы экрана покера подняты на 12px (Y уменьшен на 12 от прежних значений)');
{
    const cases = [
        // exitBtn: 21.09.2026 — крестик выхода перенесён на единую позицию (1240,90) для ВСЕХ
        // игр Двора (см. batch-21-09-*.test.js), эта конкретная 12px-правка от 83 к 71 больше
        // не актуальна — проверяется отдельно в новом батч-тесте.
        // 04.10.2026 (повторная правка тем же днём — "полоску опыта стоит опустить вниз на
        // пару пикселей"): y=116→118.
        ['barBg.drawRoundedRect(510, 118, 162, 10, 2);', 'barBg (было y=128, затем y=116)'],
        ['expLbl.x = 595; expLbl.y = 105;', 'expLbl (было y=117)'],
        ['swapsTxt.x = 811; swapsTxt.y = 96;', 'swapsTxt (было y=108)'],
        ["chipsTxt.x = SX + 158; chipsTxt.y = 374;", 'chipsTxt (было y=386)'],
        ["spichkiTxt.x = SX + 158; spichkiTxt.y = 418;", 'spichkiTxt (было y=430)'],
        ["triesTxt.x = SX + 86; triesTxt.y = 480;", 'triesTxt (было y=492)'],
        // 25.09.2026, ПОВТОРНО тем же днём: CARD_YS снят заново через редактор позиций.
        ['const CARD_YS = [286, 286, 286, 286, 286];', 'CARD_YS (было 302→290→288→286 для всех 5 карт)'],
        ['swapBtn.x = SWAP_XS[i]; swapBtn.y = 427;', 'swapBtn (было y=439)'],
        ['play1.x = 496; play1.y = 492;', 'play1 (было y=504)'],
        ['play5.x = 692; play5.y = 492;', 'play5 (было y=504)'],
        // 25.09.2026: confirmGfx стал sprite'ом (кнопка "ВСКРЫТЬСЯ", см. shmot-torso-height-140-
        // poker-open-button-weapon-modified-damage.test.js) — позиция снята редактором позиций
        // заново (491,478), старая 535,508 больше не актуальна.
        // 25.09.2026 (регресс найден повторным прогоном тестов): позиция снята редактором
        // позиций ЕЩЁ РАЗ тем же днём (было 491,478, стало 584,512).
        ['confirmGfx.x = 584; confirmGfx.y = 512;', 'confirmGfx (кнопка "ВСКРЫТЬСЯ", 25.09.2026, вторая правка позиции)'],
        ['bagBtn.x = 882; bagBtn.y = 509;', 'bagBtn (было y=521)'],
    ];
    for (const [needle, label] of cases) {
        assert(src.includes(needle), `${label}: ${needle}`);
    }
    // 24.09.2026 (по прямому указанию, отдельная правка — см. shmot-torso-shrink-and-home-
    // character-swap.test.js): levelTxt переведён с лево-выровненного x=467/y=100 на
    // центрирование через общий window._centerTextIn() — старое литеральное присваивание
    // больше не ищем этим тестом, проверяем актуальный вызов.
    // 25.09.2026: бокс снят заново через редактор позиций (было x:434 y:97 w:51 h:29).
    assert(/window\._centerTextIn\(levelTxt, \{x:439, y:98, w:58, h:27\}\);/.test(src),
        'levelTxt (было лево-выровненным x=467/y=100) теперь центрирован через _centerTextIn');
}

console.log('\nTest 4: заливка XP-бара покера (_updatePokerUI, рисуется отдельно от статичного фона полоски) синхронизирована с новым Y полоски');
{
    // 04.10.2026 (по прямому указанию, новый ассет "заливка желтыя уровень покера.png"): плоская
    // Graphics-заливка (0xbd7101) заменена маской текстурного спрайта — маска рисуется ПРЯМО по
    // позиции самой заливки, не по позиции barBg. Тем же днём, повторной правкой ("опустить
    // вниз на пару пикселей") — y:113→115.
    assert(/this\._pokerExpBarFill\.drawRect\(511, 115, fw, 9\);/.test(src),
        'маска заливки рисуется от x:511 y:115 — позиции нового текстурного спрайта barFillImg');
}

console.log('\nTest 5: подсветка строк "ТАБЛИЦЫ КОМБИНАЦИЙ" (формула заменена точным замером по каждой строке, 26.09.2026)');
{
    // См. tests/poker-combo-highlight-exact-positions-and-error-codes.test.js для полной
    // проверки новой явной карты позиций.
    assert(/const COMBO_ROW_POS = \{/.test(src), 'формула заменена явной картой позиций COMBO_ROW_POS');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
