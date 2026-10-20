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

console.log('\nTest 2: 4 новых слоя добавлены с координатами пользователя (anchor по умолчанию — 0,0)');
{
    assert(/tablichkaSpr\.x = 84; tablichkaSpr\.y = 103;/.test(yashikSrc), 'табличка: x=84,y=103');
    assert(/caseSpr\.x = 404; caseSpr\.y = 145;/.test(yashikSrc), 'кейс: x=404,y=145');
    assert(/rublitSpr\.x = 494; rublitSpr\.y = 360;/.test(yashikSrc), 'рублит: x=494,y=360');
    assert(/nychkiSpr\.x = 779; nychkiSpr\.y = 374;/.test(yashikSrc), 'нычки: x=779,y=374');
    // 20.10.2026: слой "сиги" убран из отображения (см. докблок выше) — спрайт больше не создаётся.
    assert(!/const sigiSpr = /.test(yashikSrc), 'sigiSpr больше не создаётся (временно убран по прямому указанию)');
    assert(!/tablichkaSpr\.anchor/.test(yashikSrc) && !/caseSpr\.anchor/.test(yashikSrc),
        'anchor не переопределён ни у одного нового спрайта — используется дефолт (0,0), как у bg');
}

console.log('\nTest 3: порядок addChild — все 4 новых слоя добавлены ПОСЛЕ фона и ДО текстовых оверлеев (не перекрывают текст)');
{
    const bgIdx       = yashikSrc.indexOf("BASE + 'ящик открытый фон.png'");
    const tablichkaIdx= yashikSrc.indexOf('tablichkaSpr.x = 84');
    const caseIdx     = yashikSrc.indexOf('caseSpr.x = 404');
    const rublitIdx   = yashikSrc.indexOf('rublitSpr.x = 494');
    const nychkiIdx   = yashikSrc.indexOf('nychkiSpr.x = 779');
    const leftPanelIdx= yashikSrc.indexOf('Левая панель: шмотка');
    assert(bgIdx > -1 && bgIdx < tablichkaIdx && tablichkaIdx < caseIdx && caseIdx < rublitIdx && rublitIdx < nychkiIdx,
        'порядок в файле: фон → табличка → кейс → рублит → нычки');
    assert(nychkiIdx < leftPanelIdx, 'все 4 оставшихся слоя объявлены раньше текстовых оверлеев (левая панель) — не перекроют текст по z-order');
}

console.log('\nTest 4: все 5 файлов физически существуют в _client/development/images (с .webp-твином), yashik_otkryt.png оставлен на диске неиспользуемым');
{
    const files = [
        'ящик открытый фон.png', 'ящик открытый кейс.png', 'ящик открытый рублит.png',
        'ящик открытый нычки.png', 'ящик открытый табличка.png', 'ящик открытый сиги.png',
    ];
    for(const f of files){
        const p = path.join(imagesDir, f);
        assert(fs.existsSync(p) && fs.statSync(p).size > 0, f + ' существует и не пустой');
        assert(fs.existsSync(p + '.webp') && fs.statSync(p + '.webp').size > 0, f + '.webp существует (lossless-твин)');
    }
    assert(fs.existsSync(path.join(imagesDir, 'yashik_otkryt.png')),
        'старый yashik_otkryt.png не удалён с диска (просто больше не используется)');
}

console.log('\nTest 5: game-boot.js — preload-список обновлён (5 новых файлов добавлены, yashik_otkryt.png убран из списка)');
{
    assert(/'ящик открытый фон\.png','ящик открытый кейс\.png','ящик открытый рублит\.png',/.test(bootSrc),
        'preload содержит новые имена');
    assert(/'ящик открытый нычки\.png','ящик открытый табличка\.png','ящик открытый сиги\.png',/.test(bootSrc),
        'preload содержит табличку/нычки/сиги');
    assert(!/'yashik_otkryt\.png'/.test(bootSrc),
        'yashik_otkryt.png убран из preload-списка (больше не нужен игроку сразу)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
