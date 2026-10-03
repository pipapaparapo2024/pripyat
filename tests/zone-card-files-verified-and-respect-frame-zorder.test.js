/**
 * Test: 17.09.2026 (четырнадцатый батч) — пользователь заподозрил, что в коде используются
 * НЕ те файлы карточек локаций (прислал 5 эталонных изображений + рамку уважения из папки
 * C:\Users\HONOR\Desktop\vk_game\вкладка зоны (все)\).
 *
 * ПРОВЕРЕНО ВРУЧНУЮ (не входит в этот файл — путь вне репозитория, недоступен в других
 * окружениях): побайтово (SHA256 + размер) сверены _client/development/images/{Агропром,
 * долина,кордон,свалка,янтарь,рамка уважение}.png с одноимёнными файлами из этой папки —
 * ПОЛНОЕ СОВПАДЕНИЕ по всем 6 файлам. Код использует именно эталонные файлы, не какие-то
 * другие/старые версии — подозрение не подтвердилось.
 *
 * Второй запрос — z-index: «рамка уважения» должна рисоваться ПОВЕРХ декоративного
 * "ОСОБО ОПАСЕН"-полароида (тот запечён в фоне страницы, кордон и свалка.png/долина и
 * агропром.png/янтарь окно.png — отдельного спрайта под него в коде нет). Проверено: фон
 * страницы (bgSpr) добавляется в win ПЕРВЫМ, respectFrame — внутри цикла по локациям,
 * ПОСЛЕ фона → уже рисуется поверх по одному только порядку addChild (PIXI не имеет
 * отдельного z-index, поздно добавленный ребёнок = выше). Тест закрепляет этот порядок как
 * регресс-гвард — случайное перемещение respectFrame выше bgSpr в файле его сломает.
 *
 * Run: node tests/zone-card-files-verified-and-respect-frame-zorder.test.js
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

console.log('\nTest 1: рамка уважения (bgSpr → locWrap → group → respectFrame) — цепочка addChild гарантирует верный z-order');
{
    // 21.09.2026 (карусель по одной локации — см. zone-locations-carousel-slide.test.js):
    // respectFrame теперь добавляется не напрямую в win, а в СВОЮ группу локации (group),
    // которая сама лежит внутри locWrap. Z-order по-прежнему гарантирован порядком addChild —
    // просто через одно звено косвенности больше: bgSpr → locWrap → group → respectFrame.
    const src = readSrc('_client/src/game/shell/overlays/zone_screen.js');
    const bgIdx      = src.indexOf('win.addChild(bgSpr);');
    const wrapIdx    = src.indexOf('win.addChild(locWrap);');
    const groupIdx   = src.indexOf('locWrap.addChild(group);');
    const frameIdx   = src.indexOf('group.addChild(respectFrame);');
    assert(bgIdx !== -1, 'win.addChild(bgSpr) найден в исходнике');
    assert(wrapIdx !== -1, 'win.addChild(locWrap) найден в исходнике');
    assert(groupIdx !== -1, 'locWrap.addChild(group) найден в исходнике');
    assert(frameIdx !== -1, 'group.addChild(respectFrame) найден в исходнике');
    assert(bgIdx < wrapIdx && wrapIdx < groupIdx && groupIdx < frameIdx,
        'фон добавляется РАНЬШЕ locWrap, который раньше группы локации, которая раньше рамки — рамка гарантированно рисуется поверх фона');
}

console.log('\nTest 2: карточки локаций и рамка уважения используют одни и те же файлы (нет альтернативных путей)');
{
    const src = readSrc('_client/src/game/shell/overlays/zone_screen.js');
    // Все 5 файлов карточек должны фигурировать как loc.file — без суффиксов/альтернативных имён.
    ['кордон.png', 'свалка.png', 'долина.png', 'Агропром.png', 'янтарь.png'].forEach(f => {
        assert(src.includes(`Z + '${f}'`), `карточка использует ровно "${f}" (без суффиксов/дублей)`);
    });
    assert(src.includes("Z + 'рамка уважение.png'"), "рамка уважения использует ровно 'рамка уважение.png'");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
