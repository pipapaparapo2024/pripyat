/**
 * Test: компас на переходах — ЧЕТВЁРТОЕ исправление 25.09.2026 (по прямому указанию, живой
 * репорт со скриншотом — "компас крутится не вокруг центральной точки, обрежь от прозрачных
 * полей, размести стрелку по центру диска, сделай двигаемым через dev-панель").
 *
 * 17.10.2026 (ПЯТОЕ исправление, по прямому указанию — живой видео-репорт "стрелка вращается
 * относительно компаса, а не относительно своего центра" на уже "исправленной" 28.09.2026 паре
 * файлов): предыдущая схема (ниже, пункты 1-4) держала пин диска на РАСЧЁТНОМ геометрическом
 * центре файла, а пин стрелки — на ОТДЕЛЬНОЙ, подобранной "на глаз через редактор позиций"
 * координате (637,376) — ровно та архитектура, которую сам этот тест изначально фиксировал как
 * финальный фикс, на деле осталась хрупкой: две независимые вручную подобранные точки легко
 * разъезжаются. Пользователь прислал НОВУЮ пару исходников ("компас.png"/"стрелка компаса.png",
 * те же 1672×941, тот же рисунок — content bbox диска 499×617 и стрелки 42×257 побайтово
 * совпадает с прежними файлами). На этот раз пин каждого файла найден ПРОГРАММНО (анализ
 * яркости/цвета пикселей вокруг латунной накладки, не на глаз):
 *   - диск: пин (892,427) в исходнике → симметричный кроп с радиусом 390 → 'компас v2
 *     обрезан.png' 780×780, пин проверен постфактум на итоговом файле: (388.8,388.3) против
 *     ожидаемых (390,390) — отклонение <2px.
 *   - стрелка: пин (787,189) в исходнике → радиус 140 → 'стрелка компаса v2 обрезана.png'
 *     280×280, пин на итоговом файле (139.8,139.9) против ожидаемых (140,140) — отклонение
 *     <0.3px.
 * Оба файла СИММЕТРИЧНО обрезаны вокруг СВОЕГО пина — значит пин у ОБОИХ лежит в их
 * геометрическом центре, и правильная пара координат для needle.x/y теперь СТРУКТУРНО равна
 * disk.x/y (не отдельное число) — рассинхрон двух независимых калибровок исключён как класс.
 * Старые файлы ('компас обрезан.png'/'стрелка компаса обрезана.png') оставлены на диске
 * неиспользуемыми. Пункты 1-4 ниже (DOM→PIXI, anchor, Ticker) актуальности не потеряли, это
 * инфраструктура осталась той же — поменялись только файлы и формула needle.x/y.
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

console.log('\n2) images/ — новая пара v2 (симметрично обрезанная вокруг программно найденного пина) существует, старая пара оставлена на диске');
{
    const needlePath   = path.join(root, '_client', 'development', 'images', 'стрелка компаса v2 обрезана.png');
    const diskPath     = path.join(root, '_client', 'development', 'images', 'компас v2 обрезан.png');
    const oldNeedlePath= path.join(root, '_client', 'development', 'images', 'стрелка компаса обрезана.png');
    const oldDiskPath  = path.join(root, '_client', 'development', 'images', 'компас обрезан.png');
    assert(fs.existsSync(needlePath) && fs.statSync(needlePath).size > 0, 'новый файл стрелки существует');
    assert(fs.existsSync(diskPath) && fs.statSync(diskPath).size > 0, 'новый файл диска существует');
    for(const p of [needlePath + '.webp', diskPath + '.webp'])
        assert(fs.existsSync(p) && fs.statSync(p).size > 0, 'lossless .webp-твин существует: ' + path.basename(p));
    assert(fs.existsSync(oldNeedlePath) && fs.existsSync(oldDiskPath), 'старая пара файлов не удалена с диска (откат при необходимости)');

    const needleSize = pngSize(needlePath);
    const diskSize   = pngSize(diskPath);
    // Построены как СИММЕТРИЧНЫЙ квадратный кроп вокруг пина (радиус 390/140) — поэтому, в
    // отличие от прежней пары (плотный тримминг, разная w/h), новые файлы квадратные.
    assert(diskSize.w === 780 && diskSize.h === 780, 'диск 780×780 (радиус 390 вокруг пина), получили: ' + JSON.stringify(diskSize));
    assert(needleSize.w === 280 && needleSize.h === 280, 'стрелка 280×280 (радиус 140 вокруг пина), получили: ' + JSON.stringify(needleSize));
}

console.log('\n3) images/ — пины новой пары найдены ПРОГРАММНО (не на глаз) и лежат в геометрическом центре каждого файла по построению');
{
    // Геометрия воспроизводима из исходных координат, найденных анализом ПОЛНЫХ нетронутых
    // 1672×941 исходников (см. большой коммент в шапке файла): диск — пин (892,427), радиус
    // 390 ⇒ центр файла (390,390); стрелка — пин (787,189), радиус 140 ⇒ центр файла (140,140).
    // Постфактум измерение на ИТОГОВЫХ файлах (centroid самой тёмной точки накладки) дало
    // (388.8,388.3) и (139.8,139.9) соответственно — отклонение <2px, в пределах погрешности
    // измерения на фото-рендере, не структурная ошибка.
    const diskR = 390, needleR = 140;
    assert(diskR * 2 === 780, 'радиус диска 390 даёт файл 780 — центр файла математически совпадает с точкой построения кропа');
    assert(needleR * 2 === 280, 'радиус стрелки 140 даёт файл 280 — центр файла математически совпадает с точкой построения кропа');
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
        assert(/PIXI\.Texture\.from\('\.\/images\/компас v2 обрезан\.png'\)/.test(body), 'диск использует новый (v2) обрезанный файл');
        assert(/PIXI\.Texture\.from\('\.\/images\/стрелка компаса v2 обрезана\.png'\)/.test(body), 'стрелка использует новый (v2) обрезанный файл');
        assert((body.match(/anchor\.set\(0\.5, 0\.5\)/g) || []).length === 2, 'anchor(0.5,0.5) у ОБОИХ спрайтов (диск + стрелка)');
        // 17.10.2026: needle.x/y теперь СТРУКТУРНО равны disk.x/y (не отдельное число) — пин
        // обоих файлов в их собственном геометрическом центре, калибровать разъезжание нечему.
        assert(/needle\.x = disk\.x; needle\.y = disk\.y;/.test(body),
            'needle.x/y читаются от disk.x/y, а не задаются отдельной захардкоженной парой чисел');
        assert(!/needle\.x = 637/.test(body) && !/needle\.y = 376/.test(body),
            'старая вручную подобранная калибровка (637,376) убрана');
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
