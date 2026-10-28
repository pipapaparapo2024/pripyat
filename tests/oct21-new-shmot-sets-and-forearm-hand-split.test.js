/**
 * Test: 21.10.2026, по прямому указанию — два независимых батча.
 *
 * 1) Три новых сета шмоток (id101-115, 5 предметов каждый — голова/торс/штаны/обувь/рука):
 *    "Бродяга" (рюкзак Сидоровича), "Ветеран" (сумка за спички покер), "Следопыт" (сумка с
 *    рулетки). Координаты/масштаб каждого — КОПИЯ эталонного предмета, названного пользователем
 *    (голова→id86 "Панама Тинейджер", торс→id48 "Футболка Меченный", штаны→id52 "Трико Крыс",
 *    обувь→id69 "Ботинки Тайник", рука→id91 "Шокер Спортик 2.0"). fragments:40 — та же "данные
 *    на будущее" семантика, что у id41-44 (механика сборки по кусочкам не реализована).
 *
 * 2) Система правой руки разделена на ДВА независимых слоя (раньше был один файл "правая
 *    рука.png", переключавшийся целиком): предплечье (статично, "предплечье правое.png",
 *    никогда не меняется) + кисть ("кисть расслабленная.png" — пусто/часы Poker/цепь Teenager,
 *    "кисть хват.png" — что-то зажато, либо СКРЫТА целиком — handBuiltIn:true у Сайги/
 *    Пистолета/Кружки новых сетов, у них кисть уже нарисована внутри файла предмета).
 *    Применено на всех 4 экранах персонажа: home.js, shmot_shop.js, player_profile.js, hata.js.
 *
 * Полная карта переименований файлов — ПЕРЕИМЕНОВАНИЕ_АССЕТОВ_21_10_2026.md.
 *
 * Run: node tests/oct21-new-shmot-sets-and-forearm-hand-split.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const shmotSrc = readSrc('_client/src/game/shmot.js');

console.log('\nTest 1: 15 новых предметов (id101-115) присутствуют в каталоге с верными cat/bonus/source/set/fragments');
{
    const NEW_ITEMS = [
        {id:101, cat:0, name:'Ушанка (Бродяга)',   bonus:'+60 к автомату',   source:'Рюкзак Сидоровича'},
        {id:102, cat:1, name:'Куртка (Бродяга)',   bonus:'+60 к автомату',   source:'Рюкзак Сидоровича'},
        {id:103, cat:2, name:'Штаны (Бродяга)',    bonus:'+12 к мачете',     source:'Рюкзак Сидоровича'},
        {id:104, cat:3, name:'Обувь (Бродяга)',    bonus:'+16 к мачете',     source:'Рюкзак Сидоровича'},
        {id:105, cat:6, name:'Сайга (Бродяга)',    bonus:'+20 к пистолету',  source:'Рюкзак Сидоровича'},
        {id:106, cat:0, name:'Шапка (Ветеран)',    bonus:'+60 к автомату',   source:'Сумка (спички покер)'},
        {id:107, cat:1, name:'Куртка (Ветеран)',   bonus:'+16 к мачете',     source:'Сумка (спички покер)'},
        {id:108, cat:2, name:'Штаны (Ветеран)',    bonus:'+80 к автомату',   source:'Сумка (спички покер)'},
        {id:109, cat:3, name:'Обувь (Ветеран)',    bonus:'+30 к энергии',    source:'Сумка (спички покер)'},
        {id:110, cat:6, name:'Пистолет (Ветеран)', bonus:'+20 к пистолету',  source:'Сумка (спички покер)'},
        {id:111, cat:0, name:'Панама (Следопыт)',  bonus:'+20 к автомату',   source:'Сумка (рулетка)'},
        {id:112, cat:1, name:'Куртка (Следопыт)',  bonus:'+20 к автомату',   source:'Сумка (рулетка)'},
        {id:113, cat:2, name:'Штаны (Следопыт)',   bonus:'+30 к энергии',    source:'Сумка (рулетка)'},
        {id:114, cat:3, name:'Обувь (Следопыт)',   bonus:'+10 к пистолету',  source:'Сумка (рулетка)'},
        {id:115, cat:6, name:'Кружка (Следопыт)',  bonus:'+20 к автомату',   source:'Сумка (рулетка)'},
    ];
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for(const it of NEW_ITEMS){
        const re = new RegExp(
            `\\{id:${it.id}, cat:${it.cat}, name:'${esc(it.name)}'[\\s\\S]{0,400}?bonus:'${esc(it.bonus)}'[\\s\\S]{0,300}?source:'${esc(it.source)}'`
        );
        assert(re.test(shmotSrc), `id${it.id} "${it.name}": cat/bonus/source верны`);
    }
    for(const set of ['бродяга', 'ветеран', 'следопыт']){
        const count = (shmotSrc.match(new RegExp(`set:'${set}'`, 'g')) || []).length;
        assert(count === 5, `сет "${set}" — ровно 5 предметов, нашли ${count}`);
    }
    const fragCount = [101,102,103,104,105,106,107,108,109,110,111,112,113,114,115]
        .filter(id => new RegExp(`\\{id:${id}, [\\s\\S]{0,400}?fragments:40`).test(shmotSrc)).length;
    assert(fragCount === 15, `все 15 новых предметов имеют fragments:40, нашли ${fragCount}`);
}

console.log('\nTest 2: Сайга/Пистолет/Кружка помечены handBuiltIn:true (кисть уже нарисована в файле предмета)');
{
    for(const [id, name] of [[105,'Сайга'],[110,'Пистолет'],[115,'Кружка']]){
        const re = new RegExp(`\\{id:${id}, [\\s\\S]{0,500}?handBuiltIn:true\\}`);
        assert(re.test(shmotSrc), `id${id} (${name}): handBuiltIn:true`);
    }
    // Остальные 12 (не-weapon) предметов НЕ должны иметь handBuiltIn — их не зажимают в руке.
    for(const id of [101,102,103,104,106,107,108,109,111,112,113,114]){
        const m = shmotSrc.match(new RegExp(`\\{id:${id}, [^\\n]*`));
        assert(m && !/handBuiltIn/.test(m[0]), `id${id}: нет лишнего handBuiltIn (не оружие)`);
    }
}

console.log('\nTest 3a: cellDx/cellDy/cellScale/manDx/manDy новых предметов СКОПИРОВАНЫ с эталонных дословно (обувь=id69) — кроме cat:0/1/2/6, см. Test 3c ниже');
{
    // 22.10.2026 (по прямому указанию, редактор позиций на манекене магазина): id105/110/115
    // (cat:6), id101/106/111 (cat:0, головные уборы) и id102/107/112 (cat:1, куртки) больше
    // НЕ копируют эталон дословно — каждый индивидуально откалиброван живым редактором
    // позиций (см. Test 3c). shoes (id104/109/114) по-прежнему первая прикидка — копия
    // эталона, ждут той же сверки.
    // 22.10.2026 (вторая волна калибровки, та же сессия): legs (id103/108/113, cat:2) ТОЖЕ
    // перешли в Test 3c — у "штаны ветеран" в окне гардероба реальный on-screen размер не
    // совпадал с id52 ("Трико Крыс") несмотря на одинаковый cellScale:0.396 (разное исходное
    // разрешение PNG — совпадение числа cellScale не гарантирует совпадение рендера), редактор
    // позиций дал новый cellScale:0.097 при почти неизменных cellDx/cellDy.
    // 23.10.2026 (по прямому указанию, скрин "обувь бродяга/ветеран опущена на 7px"): id104/109
    // тоже вышли из общего эталона обуви (manDy:7→14) — id114 (обувь следопыт) эталон не менял,
    // остаётся здесь. См. Test 3c ниже для 104/109.
    const refs = {
        shoes:  'cellDx:-4, cellDy:-20, cellScale:0.110, manDx:4, manDy:7,',
    };
    const byCat = {3:'shoes'};
    for(let id = 101; id <= 115; id++){
        const m = shmotSrc.match(new RegExp(`\\{id:${id}, cat:(\\d), [^\\n]*`));
        assert(!!m, `id${id}: запись найдена`);
        if(m){
            const cat = parseInt(m[1]);
            if(cat === 6 || cat === 0 || cat === 1 || cat === 2) continue; // Test 3c — individually calibrated
            if(id === 104 || id === 109) continue; // Test 3c — manDy:14 опущена на 7px отдельно от id114
            const refStr = refs[byCat[cat]];
            assert(m[0].includes(refStr), `id${id} (cat ${cat}): cellDx/cellDy/cellScale/manDx/manDy совпадают с эталоном "${byCat[cat]}"`);
        }
    }
}

console.log('\nTest 3c: id105/110/115 (cat:6) — cellDx/cellDy/cellScale/manDx/manDy/manWidth/manHeight подтверждены живым редактором позиций на манекене магазина (22.10.2026), НЕ копия эталона');
{
    // 27.10.2026 (по прямому указанию — перевод ВСЕХ предметов каталога на персонаже с manScale
    // на явные manWidth/manHeight, см. shmot_shop.js._updateManSprites). Значения ниже —
    // round(native_manImgFile_W/H × старый manScale), визуальный размер не меняется (см.
    // AGENTS.md про отсутствие эффекта на резкость — это чисто формат данных).
    // cellDx/cellDy (-4,-32) случайно совпали с эталоном id91 — manWidth/manHeight/cellScale/
    // manDx/manDy индивидуальны для каждого предмета (разная геометрия файла/хвата оружия).
    const CONFIRMED = {
        105: {cat: 6, expected: 'cellDx:-4, cellDy:-32, cellScale:0.140, manDx:-108, manDy:3, manWidth:162, manHeight:178,'},
        // 23.10.2026 (по прямому указанию, вторая калибровка — "шмот пистолет ветеран...
        // x:819,y:422" на манекене магазина шмоток, cat:6 там x:856 → manDx=819-856=-37;
        // y:418 → manDy=422-418=4).
        110: {cat: 6, expected: 'cellDx:-4, cellDy:-32, cellScale:0.270, manDx:-37, manDy:4, manWidth:87, manHeight:65,'},
        // 23.10.2026 (по прямому указанию, вторая калибровка — "шмот кружка следопыт...
        // x:820,y:418" на манекене магазина шмоток, cat:6 там x:856 → manDx=820-856=-36;
        // y:418 → manDy=418-418=0).
        115: {cat: 6, expected: 'cellDx:-4, cellDy:-32, cellScale:0.211, manDx:-36, manDy:0, manWidth:82, manHeight:88,'},
        // 23.10.2026 (по прямому указанию, скрин — "обувь бродяга и обувь ветеран опустил вниз
        // на 7 пикселей"): manDy:7→14, cellDx/cellDy/cellScale/manDx/manWidth/manHeight не менялись.
        104: {cat: 3, expected: 'cellDx:-4, cellDy:-20, cellScale:0.110, manDx:4, manDy:14, manWidth:246, manHeight:95,'},
        109: {cat: 3, expected: 'cellDx:-4, cellDy:-20, cellScale:0.110, manDx:4, manDy:14, manWidth:246, manHeight:95,'},
        // 22.10.2026 (вторая волна калибровки, та же сессия): головные уборы (cat:0) и куртки
        // (cat:1) трёх новых сетов — тоже подтверждены редактором позиций, больше не копия
        // эталона. Куртки (102/107/112) намеренно используют ОДНО И ТО ЖЕ manDx/manDy (но РАЗНЫЙ
        // manWidth/manHeight — нативные файлы отличаются разрешением).
        101: {cat: 0, expected: 'cellDx:-12, cellDy:-30, cellScale:0.260, manDx:-5, manDy:7, manWidth:134, manHeight:108,'},
        106: {cat: 0, expected: 'cellDx:-12, cellDy:-30, cellScale:0.260, manDx:1, manDy:11, manWidth:69, manHeight:42,'},
        // 23.10.2026 (по прямому указанию — "шмотки на торс, три куртки, подними вверх на 3
        // пикселя и уменьши скейл до 0.114, это в гардеробе"): cellDy -30→-33 (вверх на 3px),
        // cellScale 0.126→0.114 — только окно гардероба, manDx/manDy/manWidth/manHeight на
        // персонаже не трогались в этот раз.
        102: {cat: 1, expected: 'cellDx:-2, cellDy:-33, cellScale:0.114, manDx:-70, manDy:-27, manWidth:232, manHeight:212,'},
        107: {cat: 1, expected: 'cellDx:-2, cellDy:-33, cellScale:0.114, manDx:-70, manDy:-27, manWidth:232, manHeight:212,'},
        // 22.10.2026 (вторая правка, та же сессия): куртка Следопыт откалибрована ОТДЕЛЬНО от
        // Бродяги/Ветерана (новое "новое расположение" от пользователя).
        // 27.10.2026 (по прямому указанию — редактор позиций на манекене, x:730,y:235,
        // scale:1.004, cat:1 база {x:804,y:258}): manDx -75→-74, итоговый manWidth/manHeight
        // чуть крупнее соседей (233×209 вместо 232×212 — тот же порядок величины).
        112: {cat: 1, expected: 'cellDx:-2, cellDy:-33, cellScale:0.114, manDx:-74, manDy:-23, manWidth:233, manHeight:209,'},
        // 22.10.2026 (вторая волна калибровки): штаны трёх сетов — одна и та же калибровка
        // (cellDx/cellDy почти не изменились относительно эталона id52, но cellScale сильно
        // меньше — у этих PNG заметно выше нативное разрешение, чем у "Трико Крыс").
        // 23.10.2026 (по прямому указанию, скрин — "у штанов бродяга/следопыт большой прозрачный
        // отступ сверху, убери, подгони под штаны ветеран и в окне гардероба, и на персонаже"):
        // PNG-файлы "шмот штаны бродяга.png"/"шмот штаны следопыт.png" физически ОБРЕЗАНЫ по
        // alpha-bbox (PIL, порог alpha>20) — бродяга 1471×1707→1364×620, следопыт
        // 1471×1707→1364×610; оригиналы сохранены в
        // _archive_unused_images_29_09_2026/*_original_pre_crop_23_10.png.
        // 27.10.2026 (по прямому указанию — редактор позиций на манекене, cat:2 база
        // {x:893,y:358}): бродяга x:865,y:379 → manDx -30→-28; следопыт x:864,y:379 →
        // manDx -30→-29 (manDy без изменений у обоих).
        //
        // 28.10.2026 (по прямому указанию, повторный снимок универсального редактора позиций —
        // "x:71,y:753,w:128,h:86" (бродяга) / "x:385,y:755,w:129,h:86" (следопыт) в окне
        // гардероба): cellWidth/cellHeight читаются из w/h напрямую (абсолютный пиксельный
        // размер спрайта, не зависит от ячейки). cellDx/cellDy пересчитаны вручную из абсолютных
        // координат редактора — формула img.x = cx + 77 + cellDx / img.y = cy + 98 + cellDy
        // (shmot_shop.js._shopRefresh), где cx/cy — позиция ячейки в сетке (cellW:145, cellH:160,
        // gap:12, cols:3), а индекс ячейки взят по порядку cat:2 в каталоге (вкладка "Все", не
        // "Мои" — 13-я и 15-я по счёту позиции среди предметов категории "Штаны"): бродяга idx12
        // → col0/row4 → cx:0,cy:688 → cellDx:71-77-0=-6, cellDy:753-98-688=-33; следопыт idx14 →
        // col2/row4 → cx:314,cy:688 → cellDx:385-77-314=-6, cellDy:755-98-688=-31. Самосогласованность
        // двух независимых предметов (оба дали практически одинаковый cellDx≈-6, а cellDy упал
        // примерно вдвое вместе с cellHeight, упавшей тоже примерно вдвое) — хороший знак, что
        // расчёт верный, но формула НЕ проверялась живым открытием игры (правило №6) — если после
        // деплоя штаны в ячейке гардероба всё же не на месте, скорее всего редактор снимался на
        // вкладке "Мои" (другой порядок/меньше предметов) — тогда нужно переснять cellDx/cellDy.
        // 28.10.2026 (повторное указание тем же днём — "убери прозрачный отступ сверху в
        // гардеробе"): PNG-файлы проверены через PIL — alpha-bbox впритык с обеих сторон (0px
        // margin), отступ был НЕ в файле, а в коде — базовая точка центрирования ячейки
        // (shmot_shop.js: `cy + 98`) смещена на 18px НИЖЕ геометрического центра рамки
        // (cellH:160/2=80), что было незаметно при почти-заполняющей рамку старой cellHeight
        // (196/207), но стало заметным верхним зазором после сегодняшнего уменьшения до 86.
        // cellDy пересчитан так, чтобы верх иконки почти упирался в верх рамки (≈5px запас,
        // не впритык): cellDy = cellHeight/2 - 98 + 5 = 43 - 98 + 5 = -50 (одинаково для обоих,
        // т.к. cellHeight теперь одинаковый — формула не зависит от row/col ячейки в сетке).
        // 28.10.2026 (третье указание тем же днём, на тесте — "уменьши высоту ещё на 12px,
        // сверху 6px и снизу 6px, ширину не трогай"): симметричное сжатие вокруг текущего
        // центра — anchor(0.5,0.5), поэтому cellDy НЕ меняется, меняется только cellHeight
        // (86 → 74). cellWidth нетронут по прямому указанию.
        // 28.10.2026 (четвёртое указание, новый снимок редактора — "x:69,y:721,w:128,h:185"
        // (бродяга) / "x:385,y:727,w:129,h:185" (следопыт), явно "на прод", применить и на
        // тест, и на прод): та же формула (cx/cy ячейки не меняются — тот же idx в каталоге,
        // row4: бродяга cx:0,cy:688; следопыт cx:314,cy:688). Бродяга: cellDx=69-77-0=-8,
        // cellDy=721-98-688=-65. Следопыт: cellDx=385-77-314=-6, cellDy=727-98-688=-59.
        // cellHeight вырос почти втрое (74→185) — иконка штанов теперь заметно крупнее в
        // ячейке гардероба, по прямому указанию пользователя.
        103: {cat: 2, expected: 'cellDx:-8, cellDy:-65, cellWidth:128, cellHeight:185, manDx:-28, manDy:21, manWidth:306, manHeight:139,'},
        108: {cat: 2, expected: 'cellDx:-4, cellDy:-36, cellScale:0.097, manDx:-27, manDy:-17, manWidth:300, manHeight:202,'},
        113: {cat: 2, expected: 'cellDx:-6, cellDy:-59, cellWidth:129, cellHeight:185, manDx:-29, manDy:21, manWidth:306, manHeight:137,'},
    };
    for(const [id, {cat, expected}] of Object.entries(CONFIRMED)){
        const m = shmotSrc.match(new RegExp(`\\{id:${id}, cat:${cat}, [^\\n]*`));
        assert(!!m, `id${id}: запись найдена`);
        if(m) assert(m[0].includes(expected), `id${id}: cellDx/cellDy/cellScale/manDx/manDy/manWidth/manHeight подтверждены редактором`);
    }

    // 27.10.2026: id111 (Панама Следопыт) — единственный предмет, который уже один раз прошёл
    // через эксперимент manWidth/manHeight (22.10.2026) и был откатан на manImgFile+manScale
    // (26.10.2026). Теперь, с полным переводом каталога на manWidth/manHeight, id111 снова его
    // использует — наравне со всеми остальными 77 предметами, никакого особого случая больше нет.
    const m111 = shmotSrc.match(/\{id:111, cat:0, [^\n]*/);
    assert(!!m111, 'id111: запись найдена');
    if(m111){
        assert(m111[0].includes("cellDx:-12, cellDy:-30, cellScale:0.260, manDx:-5, manDy:15, manWidth:80, manHeight:66,"),
            'id111: cellDx/cellDy/cellScale/manDx/manDy/manWidth/manHeight подтверждены');
        assert(!m111[0].includes('manScale'), 'id111: manScale убран (мигрирован на manWidth/manHeight, как все остальные)');
    }
}

console.log('\nTest 3b: manScale убран из каталога целиком (27.10.2026, перевод на manWidth/manHeight)');
{
    // 27.10.2026 (по прямому указанию — перевод ВСЕХ предметов каталога с manScale на явные
    // manWidth/manHeight, чисто формат данных, без визуального эффекта — см. AGENTS.md). Раньше
    // этот тест проверял, что manScale у 101-115 равен 1.000 (манImgFile уже давал нужный размер).
    // Теперь поля manScale у этих предметов не существует вообще — проверяем вместо этого, что
    // manWidth/manHeight присутствуют и что ни у одного предмета 101-115 не осталось manScale.
    for(let id = 101; id <= 115; id++){
        const m = shmotSrc.match(new RegExp(`\\{id:${id}, cat:(\\d)[\\s\\S]{0,250}?manWidth:(\\d+), manHeight:(\\d+)`));
        assert(!!m, `id${id}: запись с manWidth/manHeight найдена`);
        const mScale = shmotSrc.match(new RegExp(`\\{id:${id}, cat:\\d[\\s\\S]{0,250}?manScale:`));
        assert(!mScale, `id${id}: manScale больше не присутствует`);
    }
}

console.log('\nTest 4: новые файлы-ассеты шмоток скопированы в _client/development/images/shmot/');
{
    const IMG_DIR = path.join(root, '_client', 'development', 'images', 'shmot');
    const FILES = [
        'шмот ушанка бродяга.png', 'шмот куртка бродяга.png', 'шмот штаны бродяга.png', 'шмот обувь бродяга.png', 'шмот сайга бродяга.png',
        'шмот шапка ветеран.png', 'шмот куртка ветеран.png', 'шмот штаны ветеран.png', 'шмот обувь ветеран.png', 'шмот пистолет ветеран.png',
        'шмот панама следопыт.png', 'шмот куртка следопыт.png', 'шмот штаны следопыт.png', 'шмот обувь следопыт.png', 'шмот кружка следопыт.png',
    ];
    for(const f of FILES){
        assert(fs.existsSync(path.join(IMG_DIR, f)), `файл существует: shmot/${f}`);
    }
}

const SCREENS = {
    home:    '_client/src/game/home.js',
    shop:    '_client/src/game/shell/overlays/shmot_shop.js',
    profile: '_client/src/game/shell/overlays/player_profile.js',
    hata:    '_client/src/game/shell/overlays/hata.js',
};

console.log('\nTest 5: предплечье — статичный файл "предплечье правое.png" на всех 4 экранах, "правая рука.png" нигде не осталось');
{
    for(const [name, rel] of Object.entries(SCREENS)){
        const src = readSrc(rel);
        assert(/'\.\/images\/предплечье правое\.png'/.test(src), `${name}: предплечье грузит "предплечье правое.png"`);
        assert(!/'\.\/images\/правая рука\.png'/.test(src) && !/'\.\/images\/правая рука пустая\.png'/.test(src),
            `${name}: старые файлы "правая рука.png"/"правая рука пустая.png" больше не используются`);
        // 23.10.2026 (по прямому указанию — "почему-то ты не выводишь файл фаланги кистей, когда
        // игрок берёт что-то в руку... он должен быть"): "фаланги правой руки.png" ВЕРНУЛСЯ в код
        // (был неиспользуемым файлом с 21.10.2026, когда роль перешла к кисти, см. докблок
        // файла) — теперь отдельный слой между оружием и предплечьем, см.
        // oct23-weapon-above-jacket-and-phalanx-zorder.test.js для точной проверки z-order.
        assert(/'\.\/images\/фаланги правой руки\.png'/.test(src), `${name}: "фаланги правой руки.png" используется снова (возвращён 23.10.2026)`);
    }
}

console.log('\nTest 6: кисть переключается между "кисть расслабленная.png"/"кисть хват.png" и скрывается при handBuiltIn, на всех 4 экранах');
{
    for(const [name, rel] of Object.entries(SCREENS)){
        const src = readSrc(rel);
        assert(/'\.\/images\/кисть расслабленная\.png'/.test(src), `${name}: ссылается на "кисть расслабленная.png"`);
        assert(/'\.\/images\/кисть хват\.png'/.test(src), `${name}: ссылается на "кисть хват.png"`);
        assert(/handBuiltIn/.test(src), `${name}: проверяет флаг handBuiltIn (скрывает кисть у Сайги/Пистолета/Кружки)`);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
