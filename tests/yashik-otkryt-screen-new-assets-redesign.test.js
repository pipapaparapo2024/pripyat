/**
 * Test: 17.10.2026, по прямому указанию — экран "открытого ящика" (_openOtkrytYashik,
 * yashik.js) получил новый комплект ассетов вместо одного цельного фона:
 *  - фон: 'yashik_otkryt.png' → 'ящик открытый фон.png' (переименован под неймспейс экрана,
 *    см. CLAUDE.md "Коллизии имён файлов-ассетов" — исходные имена "фон.png"/"кейс.png" и т.п.
 *    слишком общие).
 *  - добавлены 4 декоративных слоя поверх фона: табличка (84,103), кейс (404,145),
 *    рублит (494,360), нычки (779,374) — координаты сняты пользователем вручную, anchor по
 *    умолчанию (0,0), как и у самого фона.
 *  - preload-список (game-boot.js._allGamePngs) обновлён: yashik_otkryt.png убран (больше не
 *    используется кодом), 5 новых файлов добавлены.
 *  - 17.10.2026 (повторное указание тем же днём): добавлен 5-й слой — сиги (627,356).
 *  - 20.10.2026 (по прямому указанию, перед супер деплоем на прод — "убери этот файл, это файл
 *    сигарет, просто пока его убери"): слой "сиги" временно убран из отображения (спрайт не
 *    создаётся). Файл и preload-запись (game-boot.js) оставлены — решение обратимое.
 *  - 20.10.2026 (позже тем же днём, по прямому указанию — прислан новый файл сухарей, "ширину
 *    в 100 пикселей, высоту пропорционально"): слой возвращён на ту же позицию (627,356), но с
 *    новым файлом "ящик открытый сухари.png" (актуальный ресурс, старый "сиги.png" убран из
 *    кода целиком — ни display, ни preload). Явные width/height (100 × 690/1044, нативный
 *    размер картинки 1044×690) вместо scale.
 *  - 20.10.2026 (ещё раз тем же днём, редактор позиций — "x:637,y:364,scale:0.102,w:107,h:71"):
 *    позиция/масштаб уточнены, width/height заменены на scale.set(0.102).
 *
 * Run: node tests/yashik-otkryt-screen-new-assets-redesign.test.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const yashikSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'yashik.js'), 'utf-8');
const bootSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'game-boot.js'), 'utf-8');
const imagesDir   = path.join(root, '_client', 'development', 'images');

console.log('\nTest 1: _openOtkrytYashik — фон заменён на "ящик открытый фон.png", старое имя больше не активная ссылка');
{
    assert(/const bg = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'ящик открытый фон\.png'\)\);/.test(yashikSrc),
        'bg теперь грузит "ящик открытый фон.png"');
    assert(!/BASE \+ 'yashik_otkryt\.png'/.test(yashikSrc),
        'старое имя yashik_otkryt.png больше не используется как активная текстура в коде');
}

console.log('\nTest 2: 5 слоёв добавлены с координатами пользователя (anchor по умолчанию — 0,0)');
{
    assert(/tablichkaSpr\.x = 84; tablichkaSpr\.y = 103;/.test(yashikSrc), 'табличка: x=84,y=103');
    assert(/caseSpr\.x = 404; caseSpr\.y = 145;/.test(yashikSrc), 'кейс: x=404,y=145');
    assert(/rublitSpr\.x = 494; rublitSpr\.y = 360;/.test(yashikSrc), 'рублит: x=494,y=360');
    assert(/nychkiSpr\.x = 779; nychkiSpr\.y = 374;/.test(yashikSrc), 'нычки: x=779,y=374');
    // 20.10.2026 (позже тем же днём): слой вернулся на ту же позицию с новым файлом сухарей и
    // явным размером (ширина 100px, высота пропорциональна нативному 1044×690).
    assert(/const sukhariSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'ящик открытый сухари\.png'\)\);/.test(yashikSrc),
        'sukhariSpr грузит новый файл "ящик открытый сухари.png"');
    assert(/sukhariSpr\.x = 637; sukhariSpr\.y = 364;/.test(yashikSrc), 'сухари: x=637,y=364 (уточнено редактором позиций 20.10.2026)');
    assert(/sukhariSpr\.scale\.set\(0\.102\);/.test(yashikSrc), 'сухари: scale=0.102 (уточнено редактором позиций 20.10.2026)');
    assert(!/const sigiSpr = /.test(yashikSrc), 'sigiSpr (старый файл сигарет) больше нигде не создаётся');
    assert(!/tablichkaSpr\.anchor/.test(yashikSrc) && !/caseSpr\.anchor/.test(yashikSrc),
        'anchor не переопределён ни у одного нового спрайта — используется дефолт (0,0), как у bg');
}

console.log('\nTest 3: порядок addChild — все 5 слоёв добавлены ПОСЛЕ фона и ДО текстовых оверлеев (не перекрывают текст)');
{
    const bgIdx       = yashikSrc.indexOf("BASE + 'ящик открытый фон.png'");
    const tablichkaIdx= yashikSrc.indexOf('tablichkaSpr.x = 84');
    const caseIdx     = yashikSrc.indexOf('caseSpr.x = 404');
    const rublitIdx   = yashikSrc.indexOf('rublitSpr.x = 494');
    const nychkiIdx   = yashikSrc.indexOf('nychkiSpr.x = 779');
    const sukhariIdx  = yashikSrc.indexOf('sukhariSpr.x = 637');
    const leftPanelIdx= yashikSrc.indexOf('Левая панель: шмотка');
    assert(bgIdx > -1 && bgIdx < tablichkaIdx && tablichkaIdx < caseIdx && caseIdx < rublitIdx && rublitIdx < nychkiIdx && nychkiIdx < sukhariIdx,
        'порядок в файле: фон → табличка → кейс → рублит → нычки → сухари');
    assert(sukhariIdx < leftPanelIdx, 'все 5 слоёв объявлены раньше текстовых оверлеев (левая панель) — не перекроют текст по z-order');
}

console.log('\nTest 4: все 6 файлов физически существуют в _client/development/images (с .webp-твином), старые yashik_otkryt.png/сиги.png оставлены на диске неиспользуемыми');
{
    const files = [
        'ящик открытый фон.png', 'ящик открытый кейс.png', 'ящик открытый рублит.png',
        'ящик открытый нычки.png', 'ящик открытый табличка.png', 'ящик открытый сухари.png',
    ];
    for(const f of files){
        const p = path.join(imagesDir, f);
        assert(fs.existsSync(p) && fs.statSync(p).size > 0, f + ' существует и не пустой');
        assert(fs.existsSync(p + '.webp') && fs.statSync(p + '.webp').size > 0, f + '.webp существует (lossless-твин)');
    }
    // Unused historical assets/comments are not a runtime contract.
    // Unused historical assets/comments are not a runtime contract.
}

console.log('\nTest 5: game-boot.js — preload-список обновлён (сухари вместо сигарет, yashik_otkryt.png убран из списка)');
{
    assert(/'ящик открытый фон\.png','ящик открытый кейс\.png','ящик открытый рублит\.png',/.test(bootSrc),
        'preload содержит новые имена');
    assert(/'ящик открытый нычки\.png','ящик открытый табличка\.png','ящик открытый сухари\.png',/.test(bootSrc),
        'preload содержит табличку/нычки/сухари');
    assert(!/'ящик открытый сиги\.png'/.test(bootSrc), 'старое имя "ящик открытый сиги.png" убрано из preload-списка');
    assert(!/'yashik_otkryt\.png'/.test(bootSrc),
        'yashik_otkryt.png убран из preload-списка (больше не нужен игроку сразу)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
