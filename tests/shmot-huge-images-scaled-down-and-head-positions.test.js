/**
 * Test: батч 22.09.2026 (по прямому указанию, скриншоты редактора позиций + жалоба "огромная
 * футболка перекрывает весь экран") —
 *
 *  1) Часть картинок дроп-предметов (id41+) — исходники художника в нативном разрешении до
 *     1300+ px по одной из сторон (шорты/кроссовки/футболки). У этих предметов manScale не был
 *     задан вообще (по умолчанию 1 — реальный пиксельный размер), поэтому на манекене/экране
 *     персонажа они рендерились в полный исходный размер — перекрывали половину экрана. По
 *     прямому указанию ("уменьши размер всех огромных шмоток — 1000×1000 и больше — в 10 раз")
 *     добавлен manScale:0.1 КАЖДОМУ предмету, чей файл на диске имеет ширину ИЛИ высоту ≥1000px
 *     — проверка идёт по РЕАЛЬНЫМ файлам на диске (fs + PNG IHDR), а не по хардкод-списку id,
 *     чтобы тест ловил регресс, если кто-то добавит новый огромный файл без manScale.
 *
 *  2) Три головных предмета (Повязка/Респиратор Спортик2.0/Респиратор с медальоном Блэкджек)
 *     спозиционированы точно по данным универсального редактора позиций (скриншоты пользователя,
 *     магазин одежды, слот "Голова" — база x=871,y=195, см. MAN_SLOTS в shmot_shop.js) —
 *     manDx/manDy = editor.x/y минус база слота, manScale = значение из редактора as-is.
 *
 * Run: node tests/shmot-huge-images-scaled-down-and-head-positions.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const shmotSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shmot.js'), 'utf-8');
const SHMOT_DIR = path.join(root, '_client', 'development', 'images', 'shmot');

// PNG IHDR: сигнатура 8 байт, затем чанк IHDR — ширина/высота big-endian uint32 на смещениях
// 16 и 20 (без внешних библиотек, тот же приём, что уже используют другие тесты каталога).
function pngSize(filePath){
    const buf = fs.readFileSync(filePath);
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// Парсим this.items построчно (тот же терпимый к отсутствующим полям парсер, что и в
// shmot-organized-catalog-and-sources.test.js).
const itemsBlockMatch = shmotSrc.match(/this\.items = \[([\s\S]*?)\n\t\t\];/);
assert(!!itemsBlockMatch, 'this.items = [ ... ] найден в shmot.js');
const itemsBlock = itemsBlockMatch ? itemsBlockMatch[1] : '';

const items = [];
for(const line of itemsBlock.split('\n')){
    const idM = line.match(/\{id:(\d+),\s*cat:(\d+),\s*name:'([^']*)'/);
    if(!idM) continue;
    const imgM      = line.match(/imgFile:'([^']*)'/);
    const scaleM    = line.match(/manScale:([\d.]+)/);
    const dxM       = line.match(/manDx:(-?[\d.]+)/);
    const dyM       = line.match(/manDy:(-?[\d.]+)/);
    items.push({
        id: +idM[1], cat: +idM[2], name: idM[3],
        imgFile: imgM ? imgM[1] : null,
        manScale: scaleM ? parseFloat(scaleM[1]) : null,
        manDx: dxM ? parseFloat(dxM[1]) : null,
        manDy: dyM ? parseFloat(dyM[1]) : null,
    });
}

// 24.09.2026 (по прямому указанию, редактор позиций — точные калибровки для обуви/шорт/двух
// топов): порог поднят с 0.15 до 0.23 — старый плоский manScale:0.1 был грубой прикидкой
// "уменьши в 10 раз", новые значения (0.216-0.228) сняты пользователем напрямую на манекене и
// заведомо превышают 0.15, оставаясь при этом кратно меньше нативного 1 — регресс-порог просто
// поднят до реального потолка новых калиброванных значений, не отменяя саму проверку "огромный
// файл обязан иметь manScale, а не рендериться в 100% нативного размера".
console.log('\nTest 1: КАЖДЫЙ дроп-предмет (id41+), чей файл на диске ≥1000px по ширине или высоте, имеет manScale ≤ 0.23 (уменьшен минимум в ~4.3 раза от нативного 1)');
{
    const dropItems = items.filter(it => it.id >= 41 && it.imgFile);
    assert(dropItems.length > 0, 'найдены дроп-предметы с реальным imgFile для проверки');

    let checkedHuge = 0;
    for(const it of dropItems){
        const filePath = path.join(SHMOT_DIR, it.imgFile);
        if(!fs.existsSync(filePath)) continue; // отдельная забота других тестов — существование файла
        const { w, h } = pngSize(filePath);
        const isHuge = w >= 1000 || h >= 1000;
        if(!isHuge) continue;
        checkedHuge++;
        assert(it.manScale !== null && it.manScale <= 0.23,
            `id${it.id} (${it.name}, файл ${w}x${h}) — manScale задан и ≤0.23, получили ${it.manScale}`);
    }
    // 23.09.2026: было 16, стало 15 — сверка каталога сетов против _organized убрала часть
    // записей (id75/76/78/79 и др.), в т.ч. некоторые "огромные" файлы, которые тут считались.
    assert(checkedHuge >= 15, `проверено минимум 15 "огромных" файлов (найдено ровно 15 после чистки 23.09), получили ${checkedHuge}`);
}

console.log('\nTest 2: контрольный список "нетронутых" предметов — историческая проверка, актуальных кандидатов больше нет');
{
    // 23.09.2026: id75/76 ("Футболка"/"Шорты" (Борода)) убраны из каталога чисткой сетов —
    // заменены контрольными id74/84, оба заведомо меньше 1000px по обеим сторонам.
    // 24.09.2026: id82 ("Жилетка (Тайник)") убран из контрольного списка — он торс (cat:1) и
    // получил позиционную правку отдельной батч-правкой торсов, это больше не "нетронутый".
    // 24.09.2026 (тем же днём, повторно): id74 ("Шорты (Баркут)") ТОЖЕ убран — получил свою
    // позицию отдельной точечной правкой шорт, тоже больше не "нетронутый".
    // 25.09.2026: id84 ("Труба (Тайник)", cat:6) убран — все предметы "в руку" (cat:6) теперь
    // СОЗНАТЕЛЬНО получили manScale:0.33 (уменьшение в ~3 раза, по прямому указанию), см.
    // shmot-batch-25-09-torso-shorts-forearm-hand-items.test.js. Контрольный список опустел —
    // все прежние кандидаты теперь легитимно имеют manScale по той или иной причине.
    const CONTROL = [];
    for(const id of CONTROL){
        const it = items.find(i => i.id === id);
        assert(!!it, `id${id} найден в каталоге`);
        if(it) assert(it.manScale === null, `id${id} (${it.name}) НЕ получил manScale — файл не огромный, трогать не требовалось`);
    }
    assert(CONTROL.length === 0, 'контрольный список пуст — это ожидаемо и задокументировано выше, не баг');
}

console.log('\nTest 3: три головных предмета спозиционированы по данным редактора позиций (магазин одежды, слот "Голова" база x=871,y=195)');
{
    const EXPECTED = [
        { id: 81, name: 'Повязка (Тайник)', manDx: 3, manDy: 22, manScale: 0.217 },
        { id: 89, name: 'Респиратор с медальоном (Блэкджек)', manDx: -2, manDy: 36, manScale: 0.221 },
        { id: 90, name: 'Респиратор (Спортик 2.0)', manDx: -3, manDy: 36, manScale: 0.224 },
    ];
    const HEAD_BASE_X = 871, HEAD_BASE_Y = 195;
    for(const exp of EXPECTED){
        const it = items.find(i => i.id === exp.id);
        assert(!!it, `id${exp.id} (${exp.name}) найден в каталоге`);
        if(!it) continue;
        assert(it.manDx === exp.manDx, `id${exp.id} manDx === ${exp.manDx}, получили ${it.manDx}`);
        assert(it.manDy === exp.manDy, `id${exp.id} manDy === ${exp.manDy}, получили ${it.manDy}`);
        assert(it.manScale === exp.manScale, `id${exp.id} manScale === ${exp.manScale}, получили ${it.manScale}`);
        // Обратный пересчёт — итоговая позиция на манекене (база + manDx/manDy) должна точно
        // совпадать с тем, что показал редактор позиций на скриншотах пользователя.
        const finalX = HEAD_BASE_X + it.manDx, finalY = HEAD_BASE_Y + it.manDy;
        assert(finalX >= 0 && finalY >= 0, `id${exp.id}: итоговая позиция на манекене (${finalX},${finalY}) валидна`);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
