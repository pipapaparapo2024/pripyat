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

console.log('\nTest 3c: id105/110/115 (cat:6) — cellDx/cellDy/cellScale/manDx/manDy/manScale подтверждены живым редактором позиций на манекене магазина (22.10.2026), НЕ копия эталона');
{
    // cellDx/cellDy (-4,-32) случайно совпали с эталоном id91 — manScale/cellScale/manDx/manDy
    // индивидуальны для каждого предмета (разная геометрия файла/хвата оружия).
    const CONFIRMED = {
        105: {cat: 6, expected: 'cellDx:-4, cellDy:-32, cellScale:0.140, manDx:-108, manDy:3, manScale:1.000,'},
        // 23.10.2026 (по прямому указанию, вторая калибровка — "шмот пистолет ветеран...
        // x:819,y:422" на манекене магазина шмоток, cat:6 там x:856 → manDx=819-856=-37;
        // y:418 → manDy=422-418=4).
        110: {cat: 6, expected: 'cellDx:-4, cellDy:-32, cellScale:0.270, manDx:-37, manDy:4, manScale:1.000,'},
        // 23.10.2026 (по прямому указанию, вторая калибровка — "шмот кружка следопыт...
        // x:820,y:418" на манекене магазина шмоток, cat:6 там x:856 → manDx=820-856=-36;
        // y:418 → manDy=418-418=0).
        115: {cat: 6, expected: 'cellDx:-4, cellDy:-32, cellScale:0.211, manDx:-36, manDy:0, manScale:1.000,'},
        // 23.10.2026 (по прямому указанию, скрин — "обувь бродяга и обувь ветеран опустил вниз
        // на 7 пикселей"): manDy:7→14, cellDx/cellDy/cellScale/manDx/manScale не менялись.
        104: {cat: 3, expected: 'cellDx:-4, cellDy:-20, cellScale:0.110, manDx:4, manDy:14, manScale:1.000,'},
        109: {cat: 3, expected: 'cellDx:-4, cellDy:-20, cellScale:0.110, manDx:4, manDy:14, manScale:1.000,'},
        // 22.10.2026 (вторая волна калибровки, та же сессия): головные уборы (cat:0) и куртки
        // (cat:1) трёх новых сетов — тоже подтверждены редактором позиций, больше не копия
        // эталона. Куртки (102/107/112) намеренно используют ОДНО И ТО ЖЕ manDx/manDy/manScale
        // (пользователь применил одну калибровку сразу ко всем трём).
        101: {cat: 0, expected: 'cellDx:-12, cellDy:-30, cellScale:0.260, manDx:-5, manDy:7, manScale:1.000,'},
        106: {cat: 0, expected: 'cellDx:-12, cellDy:-30, cellScale:0.260, manDx:1, manDy:11, manScale:1.000,'},
        // 23.10.2026 (по прямому указанию — "шмотки на торс, три куртки, подними вверх на 3
        // пикселя и уменьши скейл до 0.114, это в гардеробе"): cellDy -30→-33 (вверх на 3px),
        // cellScale 0.126→0.114 — только окно гардероба, manDx/manDy/manScale на персонаже
        // не трогались в этот раз.
        102: {cat: 1, expected: 'cellDx:-2, cellDy:-33, cellScale:0.114, manDx:-70, manDy:-27, manScale:1.000,'},
        107: {cat: 1, expected: 'cellDx:-2, cellDy:-33, cellScale:0.114, manDx:-70, manDy:-27, manScale:1.000,'},
        // 22.10.2026 (вторая правка, та же сессия): куртка Следопыт откалибрована ОТДЕЛЬНО от
        // Бродяги/Ветерана (новое "новое расположение" от пользователя), больше не разделяет
        // их общее manDx/manDy/manScale.
        // 27.10.2026 (по прямому указанию — редактор позиций на манекене, x:730,y:235,
        // scale:1.004, cat:1 база {x:804,y:258}): manDx -75→-74, manScale 1.000→1.004.
        112: {cat: 1, expected: 'cellDx:-2, cellDy:-33, cellScale:0.114, manDx:-74, manDy:-23, manScale:1.004,'},
        // 22.10.2026 (вторая волна калибровки): штаны трёх сетов — одна и та же калибровка
        // (cellDx/cellDy почти не изменились относительно эталона id52, но cellScale сильно
        // меньше — у этих PNG заметно выше нативное разрешение, чем у "Трико Крыс").
        // 23.10.2026 (по прямому указанию, скрин — "у штанов бродяга/следопыт большой прозрачный
        // отступ сверху, убери, подгони под штаны ветеран и в окне гардероба, и на персонаже"):
        // ПЕРВАЯ попытка (в этом же дне) пересчитала только cellDx/cellDy/cellScale/manDx/manDy/
        // manScale БЕЗ изменения самих PNG — вышла математическая ошибка (абсолютная позиция
        // вместо относительной внутри своей ячейки грида, т.к. id103/108/113 в РАЗНЫХ колонках)
        // плюс пользователь явно уточнил повторно "убери отступ и по сторонам тоже" — одной
        // калибровкой позиции отступ по БОКАМ не убрать, если он физически в файле. ВТОРАЯ
        // попытка (эта): PNG-файлы "шмот штаны бродяга.png"/"шмот штаны следопыт.png" физически
        // ОБРЕЗАНЫ по alpha-bbox (PIL, порог alpha>20) — бродяга 1471×1707→1364×620 (бокс
        // 100,832,1464,1452), следопыт 1471×1707→1364×610 (бокс 100,832,1464,1442); оригиналы
        // сохранены в _archive_unused_images_29_09_2026/*_original_pre_crop_23_10.png. После
        // обрезки видимый контент = весь канвас, поэтому cellDx/cellDy/manDx/manDy естественным
        // образом сходятся к почти тем же числам, что у id108 (отличие только в cellScale/
        // manScale — из-за разного итогового разрешения кропа). id108 (эталон) не менялся.
        // 23.10.2026 (ТРЕТЬЯ правка, тот же день — продиктованы точные координаты из
        // универсального редактора позиций): "x:73,y:755,scale:0.094,w:128,h:73" (гардероб,
        // бродяга) и "x:387,y:757,scale:0.095,w:129,h:73" (гардероб, следопыт) — w/h НЕ сходятся
        // с uniform-scale от native (1364×620/610) → угловая ручка редактора тащилась НЕ
        // пропорционально (scale.x≠scale.y), отсюда cellWidth/cellHeight вместо cellScale (та
        // же идея, что manWidth/manHeight у id111). cellDx/cellDy пересчитаны из x/y через
        // формулу img.x=cx+77+cellDx (своя колонка каждого). "x:863,y:379,scale:0.224,w:305,
        // h:139" (на игроке, бродяга) — ЗДЕСЬ scale uniform (305=1364×0.224, 139≈620×0.224) →
        // обычный manScale; пользователь попросил "такие же характеристики" для следопыта —
        // те же manDx/manDy/manScale, что у бродяги.
        // 27.10.2026 (по прямому указанию — редактор позиций, повторный репорт "прозрачный
        // отступ по бокам"): cellHeight 73 оказался слишком мал для развёрнутых штанин (не
        // связано с PNG — альфа-канал уже чистый от 23.10.2026, см. комментарий выше), из-за
        // чего растянутая в короткий бокс иконка визуально смотрелась с пустотой по бокам.
        // Новые cellDx/cellDy пересчитаны из абсолютных x/y редактора той же формулой
        // x=cx+77+cellDx относительно уже известной базы ячейки (выведена из старых
        // cellDx/cellDy и старого x/y asset_v=673: cx+77=77,cy+98=786 для id103;
        // cx+77=391,cy+98=786 для id113).
        // 27.10.2026 (по прямому указанию — редактор позиций на манекене, cat:2 база
        // {x:893,y:358}): бродяга x:865,y:379 → manDx -30→-28; следопыт x:864,y:379 →
        // manDx -30→-29 (manDy/manScale без изменений у обоих).
        103: {cat: 2, expected: 'cellDx:-8, cellDy:-67, cellWidth:128, cellHeight:196, manDx:-28, manDy:21, manScale:1.000,'},
        108: {cat: 2, expected: 'cellDx:-4, cellDy:-36, cellScale:0.097, manDx:-27, manDy:-17, manScale:1.000,'},
        113: {cat: 2, expected: 'cellDx:-9, cellDy:-63, cellWidth:129, cellHeight:207, manDx:-29, manDy:21, manScale:1.000,'},
    };
    for(const [id, {cat, expected}] of Object.entries(CONFIRMED)){
        const m = shmotSrc.match(new RegExp(`\\{id:${id}, cat:${cat}, [^\\n]*`));
        assert(!!m, `id${id}: запись найдена`);
        if(m) assert(m[0].includes(expected), `id${id}: cellDx/cellDy/cellScale/manDx/manDy/manScale подтверждены редактором`);
    }

    // 26.10.2026: id111 (Панама Следопыт) был единственным экспериментом с manWidth/manHeight
    // (22.10.2026) — тот эксперимент и привёл к выводу "scale vs width/height не меняет
    // резкость" (см. докблок shmot-man-prescaled-images.test.js). Теперь id111 мигрирован на
    // тот же manImgFile-паттерн, что и все остальные 77 предметов — manWidth/manHeight убраны.
    const m111 = shmotSrc.match(/\{id:111, cat:0, [^\n]*/);
    assert(!!m111, 'id111: запись найдена');
    if(m111){
        assert(m111[0].includes("cellDx:-12, cellDy:-30, cellScale:0.260, manDx:-5, manDy:15, manScale:1.000,"),
            'id111: cellDx/cellDy/cellScale/manDx/manDy подтверждены редактором, manScale теперь 1.000');
        assert(!m111[0].includes('manWidth') && !m111[0].includes('manHeight'),
            'id111: manWidth/manHeight убраны (мигрирован на manImgFile, как все остальные)');
    }
}

console.log('\nTest 3b: manScale — больше НЕ вычисляется из разрешения файла (см. shmot-man-prescaled-images.test.js)');
{
    // 26.10.2026 (по прямому указанию — замена scale на заранее уменьшенные PNG для резкости
    // персонажа): вся эвристика "renderedH = nativeH(imgFile) * manScale ≈ эталон" ниже устарела
    // — рендер-размер на персонаже теперь определяется НАТУРАЛЬНЫМ размером manImgFile (уже
    // уменьшенного заранее под точную цель), а manScale у ВСЕХ предметов каталога (включая
    // 101-115) теперь ровно 1.000. Проверка "manImgFile существует и его размер соответствует
    // старой цели ±1px" перенесена в общий тест для всех 78 предметов разом — не дублируем её
    // здесь поштучно для одного батча.
    // 27.10.2026 (по прямому указанию, живые координаты манекена — scale:1.004): id112 (Куртка
    // Следопыт) вышел за рамки "ровно 1.000" — это реальное измерение редактора позиций, не
    // регрессия. Полный список подобных исключений по всему каталогу — см. EXCEPTIONS в
    // shmot-man-prescaled-images.test.js.
    for(let id = 101; id <= 115; id++){
        if(id === 111) continue; // id111 — особый случай, см. Test 3c выше (manImgFile вместо manWidth/manHeight)
        const m = shmotSrc.match(new RegExp(`\\{id:${id}, cat:(\\d)[\\s\\S]{0,250}?manScale:([\\d.]+)`));
        assert(!!m, `id${id}: запись найдена`);
        if(!m) continue;
        const expected = id === 112 ? 1.004 : 1.000;
        assert(parseFloat(m[2]) === expected, `id${id}: manScale теперь ${expected} (было вычислено из разрешения файла)`);
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
