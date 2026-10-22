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
        105: {cat: 6, expected: 'cellDx:-4, cellDy:-32, cellScale:0.140, manDx:-108, manDy:3, manScale:0.228,'},
        110: {cat: 6, expected: 'cellDx:-4, cellDy:-32, cellScale:0.270, manDx:-36, manDy:5, manScale:0.224,'},
        115: {cat: 6, expected: 'cellDx:-4, cellDy:-32, cellScale:0.211, manDx:-33, manDy:-2, manScale:0.215,'},
        // 22.10.2026 (вторая волна калибровки, та же сессия): головные уборы (cat:0) и куртки
        // (cat:1) трёх новых сетов — тоже подтверждены редактором позиций, больше не копия
        // эталона. Куртки (102/107/112) намеренно используют ОДНО И ТО ЖЕ manDx/manDy/manScale
        // (пользователь применил одну калибровку сразу ко всем трём).
        101: {cat: 0, expected: 'cellDx:-12, cellDy:-30, cellScale:0.260, manDx:-5, manDy:7, manScale:0.236,'},
        106: {cat: 0, expected: 'cellDx:-12, cellDy:-30, cellScale:0.260, manDx:1, manDy:11, manScale:0.221,'},
        102: {cat: 1, expected: 'cellDx:-2, cellDy:-30, cellScale:0.126, manDx:-70, manDy:-27, manScale:0.223,'},
        107: {cat: 1, expected: 'cellDx:-2, cellDy:-30, cellScale:0.126, manDx:-70, manDy:-27, manScale:0.223,'},
        // 22.10.2026 (вторая правка, та же сессия): куртка Следопыт откалибрована ОТДЕЛЬНО от
        // Бродяги/Ветерана (новое "новое расположение" от пользователя), больше не разделяет
        // их общее manDx/manDy/manScale.
        112: {cat: 1, expected: 'cellDx:-2, cellDy:-30, cellScale:0.126, manDx:-75, manDy:-23, manScale:0.225,'},
        // 22.10.2026 (вторая волна калибровки): штаны трёх сетов — одна и та же калибровка
        // (cellDx/cellDy почти не изменились относительно эталона id52, но cellScale сильно
        // меньше — у этих PNG заметно выше нативное разрешение, чем у "Трико Крыс").
        103: {cat: 2, expected: 'cellDx:-4, cellDy:-36, cellScale:0.097, manDx:-27, manDy:-17, manScale:0.120,'},
        108: {cat: 2, expected: 'cellDx:-4, cellDy:-36, cellScale:0.097, manDx:-27, manDy:-17, manScale:0.229,'},
        113: {cat: 2, expected: 'cellDx:-4, cellDy:-36, cellScale:0.097, manDx:-27, manDy:-17, manScale:0.120,'},
    };
    for(const [id, {cat, expected}] of Object.entries(CONFIRMED)){
        const m = shmotSrc.match(new RegExp(`\\{id:${id}, cat:${cat}, [^\\n]*`));
        assert(!!m, `id${id}: запись найдена`);
        if(m) assert(m[0].includes(expected), `id${id}: cellDx/cellDy/cellScale/manDx/manDy/manScale подтверждены редактором`);
    }

    // id111 (Панама Следопыт) — единственный с manWidth/manHeight вместо manScale (эксперимент).
    const m111 = shmotSrc.match(/\{id:111, cat:0, [^\n]*/);
    assert(!!m111, 'id111: запись найдена');
    if(m111) assert(m111[0].includes("cellDx:-12, cellDy:-30, cellScale:0.260, manDx:-5, manDy:15, manWidth:80, manHeight:66,"),
        'id111: cellDx/cellDy/cellScale/manDx/manDy/manWidth/manHeight подтверждены редактором (manScale заменён на явный размер)');
}

console.log('\nTest 3b: manScale НЕ скопирован (зависит от разрешения конкретного файла) — у каждого предмета пересчитан так, чтобы итоговая высота на персонаже совпадала с эталоном (±2px) и не превышала общий лимит "огромный файл (≥1000px) → manScale ≤0.23"');
{
    const IMG_DIR = path.join(root, '_client', 'development', 'images', 'shmot');
    function pngSize(file){
        const buf = fs.readFileSync(path.join(IMG_DIR, file));
        return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    // Эталонные целевые высоты на персонаже = native_height эталона × его manScale (торс —
    // строго 140px по правилу shmot-torso-height-140-...test.js, не фактическая высота id48).
    // 22.10.2026: cat:0/1/6 убраны из этой проверки — id101/102/106/107/111/112/105/110/115
    // больше не целятся в единую высоту общего эталона, каждый откалиброван индивидуально
    // (см. Test 3c выше). id111 вдобавок вообще не несёт manScale (manWidth/manHeight вместо
    // него, эксперимент по прямому указанию) — пропускается до попытки матча по manScale.
    const TARGET_H = { legs: 204 * 1.000, shoes: 418 * 0.228 };
    const byCat = {2:'legs', 3:'shoes'};
    for(let id = 101; id <= 115; id++){
        if(id === 111) continue; // manWidth/manHeight, не manScale — см. Test 3c
        const m = shmotSrc.match(new RegExp(`\\{id:${id}, cat:(\\d), [\\s\\S]{0,80}?imgFile:'([^']+)'[\\s\\S]{0,200}?manScale:([\\d.]+)`));
        assert(!!m, `id${id}: imgFile/manScale найдены`);
        if(!m) continue;
        const cat = parseInt(m[1]);
        if(cat === 6 || cat === 0 || cat === 1) continue; // индивидуальная калибровка — см. Test 3c
        const imgFile = m[2];
        const manScale = parseFloat(m[3]);
        const { w: nativeW, h: nativeH } = pngSize(imgFile);
        const renderedH = nativeH * manScale;
        const target = TARGET_H[byCat[cat]];
        // Допуск 2.5px — у id108/id114 целевая высота легонько урезана лимитом "≥1000px →
        // manScale ≤0.23" (приоритет отдан лимиту, а не точному совпадению с эталоном).
        assert(Math.abs(renderedH - target) <= 2.5,
            `id${id} (${imgFile}, native h=${nativeH}): рендерится ${renderedH.toFixed(1)}px, цель ~${target.toFixed(1)}px (эталон "${byCat[cat]}")`);
        if(nativeW >= 1000 || nativeH >= 1000){
            assert(manScale <= 0.23, `id${id}: файл ${nativeW}x${nativeH} (≥1000 по одной из сторон) — manScale ${manScale} ≤ 0.23`);
        }
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
        assert(!/'\.\/images\/фаланги правой руки\.png'/.test(src), `${name}: "фаланги правой руки.png" больше не используется`);
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
