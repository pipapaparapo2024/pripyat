/**
 * Test: компас на переходах — ЧЕТВЁРТОЕ исправление 25.09.2026 (по прямому указанию, живой
 * репорт со скриншотом — "компас крутится не вокруг центральной точки, обрежь от прозрачных
 * полей, размести стрелку по центру диска, сделай двигаемым через dev-панель").
 *
 * История трёх предыдущих попыток того же дня (26.98%/23.17% → весь диск крутится →
 * 47.48%/60.88%) — все они пытались подобрать %-based CSS transform-origin для DOM <img>,
 * что оказалось хрупким (сам факт, что пришлось трижды живьём пересчитывать процент, — сигнал
 * архитектурной проблемы, не арифметической ошибки). Итоговый фикс полностью меняет подход:
 *
 * 1) Оба файла обрезаны ЗАНОВО из исходных нетронутых 1672×941 кадров через PIL getbbox()
 *    (тримминг прозрачных полей по альфа-каналу) + 3px запас, вместо прежнего прямоугольника
 *    516×634, подогнанного под общий канвас для CSS-слоёв:
 *    - "компас обрезан.png": 505×623 (не вращается, pivot не нужен).
 *    - "стрелка компаса обрезана.png": 48×272 — СИММЕТРИЧНЫЙ кроп вокруг латунного пина
 *      (789,177 в исходнике) — пин теперь ТОЧНО в центре файла (24,136).
 * 2) Диск и стрелка — обычные PIXI.Sprite (game/shell/ui_kit.js, root.layer2_mc), не DOM/CSS.
 *    anchor.set(0.5,0.5) у обоих: у стрелки это автоматически вращает её вокруг пина (он же
 *    центр файла благодаря симметричному кропу) — никакой процентной арифметики не нужно.
 * 3) Т.к. это обычные PIXI.Sprite, universal_pos_editor.js подхватывает их АВТОМАТИЧЕСКИ (ищет
 *    PIXI.Sprite/PIXI.Text под курсором) — открыть можно через dev-панель "ЗАГРУЗКА КОМПАС" →
 *    ПОКАЗАТЬ (proto._testCompass, dev_panel.js), затем обычный редактор позиций.
 * 4) Вращение — PIXI.Ticker (360°/1.6с, та же скорость, что у старой CSS-анимации), а не
 *    CSS @keyframes — их больше нет, разметка #_screenLoader убрана из index.html целиком.
 *
 * Run: node tests/compass-needle-pivot-realignment.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

function pngSize(p){
    const buf = fs.readFileSync(p);
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

console.log('\n1) index.html — старая DOM/CSS-разметка компаса (#_screenLoader, transform-origin, @keyframes) убрана целиком');
{
    const html = read('_client/development/index.html');
    assert(!/<div id="_screenLoader"/.test(html), '#_screenLoader больше не объявлен');
    assert(!/@keyframes _screenLoaderSpin/.test(html), 'CSS-анимация вращения убрана');
    assert(!/transform-origin:47\.48% 60\.88%/.test(html), 'старый % pivot не остался');
    assert(!/transform-origin:26\.98% 23\.17%/.test(html), 'ещё более старый % pivot не остался');
    // #_clo (первоначальная загрузка) — отдельный элемент, этим фиксом не трогается.
    assert(/<div id="_clo" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;display:none;background:#000;overflow:hidden;pointer-events:all"><\/div>/.test(html),
        '#_clo остался дословно без изменений');
}

console.log('\n2) images/ — оба файла реально обрезаны от прозрачных полей (уменьшены относительно прежних 516×634)');
{
    const needlePath = path.join(root, '_client', 'development', 'images', 'стрелка компаса обрезана.png');
    const diskPath   = path.join(root, '_client', 'development', 'images', 'компас обрезан.png');
    assert(fs.existsSync(needlePath), 'файл стрелки существует');
    assert(fs.existsSync(diskPath), 'файл диска существует');

    const needleSize = pngSize(needlePath);
    const diskSize   = pngSize(diskPath);
    assert(diskSize.w < 516 && diskSize.h < 634, 'диск меньше старого канваса 516×634 (реально обрезан от полей), получили: ' + JSON.stringify(diskSize));
    assert(needleSize.w < 516 && needleSize.h < 634, 'стрелка меньше старого канваса 516×634, получили: ' + JSON.stringify(needleSize));
    // Стрелка — узкая полоска (латунный пин + игла), не квадратный диск — ширина заметно
    // меньше высоты, sanity-проверка, что кроп не остался на весь диск по ошибке.
    assert(needleSize.w < needleSize.h, 'стрелка уже, чем выше (узкая игла, не полноразмерный диск), получили: ' + JSON.stringify(needleSize));
}

console.log('\n3) images/ — пин стрелки ТОЧНО в центре файла (симметричный кроп ⇒ anchor 0.5,0.5 = вращение вокруг пина)');
{
    const needlePath = path.join(root, '_client', 'development', 'images', 'стрелка компаса обрезана.png');
    const needleSize = pngSize(needlePath);
    // Геометрия пересчёта (воспроизводима из исходных пиксельных координат, найденных прямым
    // анализом ПОЛНЫХ нетронутых 1672×941 исходников): латунный пин (789,177), bbox стрелки
    // (768,53)-(810,310), кроп — симметричный вокруг пина с 3px запасом на каждую сторону.
    const pin = { x: 789, y: 177 };
    const bbox = { x0: 768, y0: 53, x1: 810, y1: 310 };
    const margin = 3;
    const halfW = Math.max(pin.x - bbox.x0, bbox.x1 - pin.x) + margin;
    const halfH = Math.max(pin.y - bbox.y0, bbox.y1 - pin.y) + margin;
    const expectedW = halfW * 2, expectedH = halfH * 2;
    assert(needleSize.w === expectedW && needleSize.h === expectedH,
        'размер файла стрелки совпадает с расчётом симметричного кропа (' + expectedW + '×' + expectedH + '), получили: ' + JSON.stringify(needleSize));
    // По построению пин находится РОВНО в центре — halfW/halfH это и есть расстояние от пина
    // до каждого края, значит центр файла (w/2, h/2) совпадает с пином.
    assert(needleSize.w / 2 === halfW && needleSize.h / 2 === halfH,
        'центр файла (w/2,h/2) математически совпадает с пином — значит anchor(0.5,0.5) вращает именно вокруг него');
}

console.log('\n4) ui_kit.js — компас теперь PIXI.Sprite (не DOM), anchor(0.5,0.5) у обоих, стрелка вращается PIXI.Ticker-ом');
{
    const src = read('_client/src/game/shell/ui_kit.js');
    assert(!/getElementById\('_screenLoader'\)/.test(src), 'больше не читает DOM #_screenLoader');
    assert(/proto\._compassBuild = function\(\)\{/.test(src), '_compassBuild найден — лениво строит PIXI-компас');

    const buildM = src.match(/proto\._compassBuild = function\(\)\{([\s\S]*?)\n\t\};/);
    assert(!!buildM, 'тело _compassBuild найдено');
    if(buildM){
        const body = buildM[1];
        assert(/PIXI\.Texture\.from\('\.\/images\/компас обрезан\.png'\)/.test(body), 'диск использует новый обрезанный файл');
        assert(/PIXI\.Texture\.from\('\.\/images\/стрелка компаса обрезана\.png'\)/.test(body), 'стрелка использует новый обрезанный файл');
        assert((body.match(/anchor\.set\(0\.5, 0\.5\)/g) || []).length === 2, 'anchor(0.5,0.5) у ОБОИХ спрайтов (диск + стрелка)');
    }

    const showM = src.match(/proto\._compassShow = function\(\)\{([\s\S]*?)\n\t\};/);
    assert(!!showM, '_compassShow найден');
    if(showM){
        const body = showM[1];
        assert(/PIXI\.Ticker\.shared\.add\(this\._compassTickerFn\)/.test(body), 'вращение подключено через общий PIXI.Ticker, не CSS-анимацию');
        assert(/this\._compassNeedle\.rotation \+=/.test(body), 'крутится именно needle.rotation (стрелка), не сам _compassWin/disk');
        assert(!/this\._compassDisk\.rotation/.test(body), 'диск НЕ вращается (только стрелка)');
    }

    const hideM = src.match(/proto\._compassHide = function\(\)\{([\s\S]*?)\n\t\};/);
    assert(!!hideM, '_compassHide найден');
    if(hideM) assert(/PIXI\.Ticker\.shared\.remove\(this\._compassTickerFn\)/.test(hideM[1]), '_compassHide останавливает тикер (не крутит вхолостую, когда невидим)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
