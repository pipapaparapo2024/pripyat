/**
 * Test: прелоадер прошёл два этапа по одному и тому же репорту ("почему нет заднего фона у
 * анимации"):
 *  1) 08.10.2026, первый Spine-экспорт — фона не было вовсе (экспорт содержал только
 *     персонажа), временный фикс — статичная картинка (_composite.png.webp) под персонажем.
 *  2) 08.10.2026, тот же день, ВТОРОЙ экспорт (Preloader (2).zip, по прямому указанию "ставь в
 *     тест") — артист встроил фон ПРЯМО В СКЕЛЕТ (слоты 'back'/'back_front', bone=root).
 *     Временная статичная подложка убрана — она бы теперь дублировала/перекрывала правильный
 *     фон, который рисует сам renderer.draw(skeleton).
 *
 * RENDER_X/Y/SCALE для второго экспорта посчитаны НЕ на глаз, а из точной геометрии attachment
 * 'back' в preloader.json (см. комментарий в самом файле) — так, чтобы слот 'back' (region
 * 1280×720, ровно размер канваса) лёг 1:1 на весь экран.
 *
 * Run: node tests/preloader-visual-background-image.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(
    path.join(root, '_client', 'src', 'modules', 'preloader-visual.js'), 'utf-8'
);

console.log('\nTest 1: временная статичная подложка фона полностью убрана (второй экспорт несёт фон сам)');
{
    assert(!/BG_PATH/.test(src), 'константа BG_PATH убрана');
    assert(!/_bgImg/.test(src), '_bgImg (временный фон) убран из render loop');
    assert(!/preloader__2/.test(src), 'ссылка на временный _composite.png.webp убрана');
}

console.log('\nTest 2: новый Preloader.json на диске действительно содержит слоты фона (back/back_front)');
{
    const jsonPath = path.join(root, '_client', 'development', 'spine', 'preloader.json');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const slotNames = (data.slots || []).map(s => s.name);
    assert(slotNames.includes('back'), "слот 'back' присутствует в preloader.json (второй экспорт)");
    assert(slotNames.includes('back_front'), "слот 'back_front' присутствует в preloader.json (второй экспорт)");

    const backAttach = data.skins && data.skins.find(s => s.name === 'default') &&
        data.skins.find(s => s.name === 'default').attachments.back &&
        data.skins.find(s => s.name === 'default').attachments.back.back;
    assert(backAttach && backAttach.width === 1280 && backAttach.height === 720,
        "attachment 'back' имеет нативный размер 1280×720 (совпадает с канвасом)");
}

console.log('\nTest 3: RENDER_X/Y/SCALE пересчитаны под geometry attachment \'back\' второго экспорта (не старые значения первого)');
{
    assert(/const RENDER_X = 606, RENDER_Y = 558, RENDER_SCALE = 0\.7935/.test(src),
        'RENDER_X=606, RENDER_Y=558, RENDER_SCALE=0.7935 — посчитаны из geometry attachment back');
}

console.log('\nTest 4: render loop просто очищает канвас перед кадром — фон рисует сам skeleton, не отдельный drawImage');
{
    assert(/ctx\.clearRect\(0, 0, 1280, 720\);\s*\n\s*ctx\.save\(\);/.test(src),
        'clearRect() идёт прямо перед ctx.save()/renderer.draw() без промежуточного фонового drawImage');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
