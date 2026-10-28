/**
 * Test: 25.10.2026, по прямому указанию (редактор позиций на манекене магазина, живые x/y/scale
 * присланы пользователем) — калибровка сета "Исполнитель" + фикс z-порядка торса:
 *
 *  1) "шмотки на торс по Z-индексу меньше, чем файлы левое/правое предплечье — сделай так, чтобы
 *     одежда была поверх": MAN_SLOTS (включая cat:1 торс) addChild'ятся в shmot_shop.js/home.js
 *     РАНЬШЕ предплечий — PIXI-порядок рисования "позже добавлен = выше", поэтому обычный торс
 *     всегда ПОД предплечьями. Для курток id102/107/112 уже был точечный фикс (переподнятие
 *     торса в конце _updateManSprites()/updateClothes()) — тот же класс одежды (длинный рукав),
 *     худи сета "Исполнитель" (id118/119) добавлены в тот же список id, а не заведена отдельная
 *     ветка — переиспользует уже проверенную логику (включая переподъём головы/оружия следом).
 *  2) Бита (id117) откалибрована по присланным x/y/scale (manDx/manDy/manScale пересчитаны
 *     вычитанием базы слота cat:6 — {x:856,y:418} в MAN_SLOTS) + handBuiltIn:true — на арте
 *     кисть уже нарисована внутри файла, отдельная кисть/фаланги поверх не нужны (та же причина,
 *     что у Сайги/Пистолета/Кружки сетов Бродяга/Ветеран/Следопыт).
 *  3) Худи коричневая (id119) откалибрована полностью (и ячейка гардероба, и манекен) —
 *     manDx/manDy вычитанием базы cat:1 ({x:804,y:258}), cellDx/cellDy вычитанием формулы
 *     cx+77/cy+98 (GRID: cellW:145,gap:12,cols:3 → col=1,row=5 для 17-го cat:1 предмета в
 *     каталоге → cx:157,cy:860).
 *  4) 26.10.2026 — Худи белая (id118): сначала (до прихода живых координат) скопирован 1-в-1 с
 *     id119, затем в тот же день переписан реальными координатами манекена (x:737,y:242,
 *     scale:0.223) — manDx/manDy вычитанием той же базы cat:1 ({x:804,y:258}); cellDx/cellDy
 *     гардероба отдельно не присылали, оставлены скопированными с id119 (тот же силуэт).
 *  5) 26.10.2026 (по прямому указанию, скрин — "бита исполнителя должна быть поверх шмоток на
 *     торс") — id117 (Бита) хоть и handBuiltIn:true (своя кисть нарисована в файле), но держится
 *     ПОДНЯТОЙ в кулаке (не у бедра, как Сайга/Пистолет/Кружка) — заведено явное исключение из
 *     исключения в условии переподъёма оружия над курткой (`!_handEq.handBuiltIn || _handEq.id
 *     === 117`), в обоих файлах (shmot_shop.js и home.js).
 *
 * Run: node tests/oct25-executive-set-z-order-and-calibration.test.js
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

const shmotSrc     = read('_client/src/game/shmot.js');
const shopSrc      = read('_client/src/game/shell/overlays/shmot_shop.js');
const homeSrc      = read('_client/src/game/home.js');

console.log('\nTest 1: shmot_shop.js и home.js — худи "Исполнитель" (id118/119) в списке переподъёма торса выше предплечий');
{
    assert(/\[102, 107, 112, 118, 119\]\.includes\(_torsoEq\.id\) && this\._manSlots\[1\]/.test(shopSrc),
        'shmot_shop.js: список переподъёма торса включает 118 и 119 (манекен магазина)');
    assert(/\[102, 107, 112, 118, 119\]\.includes\(_torsoEq\.id\) && this\._clothSlots\[1\]/.test(homeSrc),
        'home.js: список переподъёма торса включает 118 и 119 (главный экран персонажа)');
}

console.log('\nTest 2: Бита (id117) — handBuiltIn:true (кисть уже нарисована в самом арте, отдельная кисть не нужна)');
{
    const m = shmotSrc.match(/\{id:117,[^}]*\}/);
    assert(!!m, 'запись id117 найдена в каталоге');
    assert(!!m && /handBuiltIn:true/.test(m[0]), 'id117 помечен handBuiltIn:true');
}

console.log('\nTest 3: Бита (id117) и Худи коричневая (id119) — калибровка по живым координатам редактора позиций');
{
    // Бита: 26.10.2026 пришёл новый файл-арт (772×634 вместо 509×513) — после временного
    // width-preserving пересчёта (0.140) в тот же день пришли живые координаты нового файла на
    // манекене: x:745,y:358,scale:0.210 — база cat:6 {x:856,y:418} из MAN_SLOTS.
    const baseIdx6 = shopSrc.indexOf('{ cat: 6, x: 856, y: 418');
    assert(baseIdx6 !== -1, 'база MAN_SLOTS cat:6 всё ещё {x:856,y:418} (иначе пересчёт ниже неверен)');
    const bitaManDx = 745 - 856, bitaManDy = 358 - 418;
    assert(bitaManDx === -111 && bitaManDy === -60, 'арифметика пересчёта manDx/manDy биты даёт -111/-60');
    // 27.10.2026: manScale:1.000 переведён на manWidth/manHeight (round(native×1.000) — тот же
    // видимый размер, см. AGENTS.md про перевод всего каталога).
    assert(/\{id:117,[^}]*manDx:-111, manDy:-60, manWidth:162, manHeight:133,/.test(shmotSrc),
        'id117: manDx:-111, manDy:-60, manWidth:162, manHeight:133 записаны в каталог');

    // Худи коричневая: присланы x:713,y:245,scale:0.223 на манекене — база cat:1 {x:804,y:258}.
    const baseIdx1 = shopSrc.indexOf('{ cat: 1, x: 804, y: 258');
    assert(baseIdx1 !== -1, 'база MAN_SLOTS cat:1 всё ещё {x:804,y:258} (иначе пересчёт ниже неверен)');
    const hoodieManDx = 713 - 804, hoodieManDy = 245 - 258;
    assert(hoodieManDx === -91 && hoodieManDy === -13, 'арифметика пересчёта manDx/manDy худи коричневой даёт -91/-13');
    assert(/\{id:119,[^}]*manDx:-91, manDy:-13, manWidth:254, manHeight:235,/.test(shmotSrc),
        'id119: manDx:-91, manDy:-13, manWidth:254, manHeight:235 записаны в каталог');

    // Ячейка гардероба худи коричневой: присланы x:228,y:938 — GRID cellW:145,gap:12,cols:3,
    // 17-й cat:1-предмет в каталоге (idx=16, 0-based) → col=1,row=5 → cx:157,cy:860.
    const gridIdx = shopSrc.indexOf('cellW: 145, cellH: 160, gap: 12, cols: 3');
    assert(gridIdx !== -1, 'GRID всё ещё cellW:145/gap:12/cols:3 (иначе пересчёт ниже неверен)');
    const cellDx = 228 - (157 + 77), cellDy = 938 - (860 + 98);
    assert(cellDx === -6 && cellDy === -20, 'арифметика пересчёта cellDx/cellDy худи коричневой даёт -6/-20');
    assert(/\{id:119,[^}]*cellDx:-6, cellDy:-20, cellScale:0\.114,/.test(shmotSrc),
        'id119: cellDx:-6, cellDy:-20, cellScale:0.114 записаны в каталог');
}

console.log('\nTest 4: позиция id119 в каталоге cat:1 (17-й предмет, idx=16) не сместилась — иначе расчёт cellDx/cellDy выше для другой ячейки');
{
    const cat1Ids = [...shmotSrc.matchAll(/\{id:(\d+), cat:1,/g)].map(m => parseInt(m[1]));
    assert(cat1Ids.length === 17, `ровно 17 предметов cat:1 в каталоге (нашлось ${cat1Ids.length})`);
    assert(cat1Ids[16] === 119, `id119 — 17-й по счёту cat:1 предмет (idx=16), нашлось id${cat1Ids[16]}`);
}

console.log('\nTest 5: Худи белая (id118) — манекен + ячейка гардероба откалиброваны живыми координатами');
{
    // Манекен: присланы x:737,y:242,scale:0.223 — база cat:1 {x:804,y:258} (та же, что у id119).
    const hoodieManDx = 737 - 804, hoodieManDy = 242 - 258;
    assert(hoodieManDx === -67 && hoodieManDy === -16, 'арифметика пересчёта manDx/manDy худи белой даёт -67/-16');
    // 27.10.2026 (по прямому указанию, повторные живые координаты манекена): manScale
    // 1.000→1.004 (x/y манекена не изменились — см. арифметику выше, они уже совпадали).
    // Тем же днём отдельно manScale у ВСЕГО каталога переведён на manWidth/manHeight —
    // 1.004 × native(225×192... round) даёт 225×193.
    assert(/\{id:118,[^}]*manDx:-67, manDy:-16, manWidth:225, manHeight:193,/.test(shmotSrc),
        'id118: manDx:-67, manDy:-16, manWidth:225, manHeight:193 записаны в каталог');

    const m118 = shmotSrc.match(/\{id:118,[^}]*\}/);
    const m119 = shmotSrc.match(/\{id:119,[^}]*\}/);
    assert(!!m118 && !!m119, 'записи id118 и id119 найдены в каталоге');
    if(m118 && m119){
        // 27.10.2026 (по прямому указанию, живая координата ячейки гардероба для id118
        // отдельно от id119 — x:71,y:928,scale:0.114): cellScale СОВПАЛ с id119 (0.114, без
        // изменений), cellDx тоже (x:71 → та же колонка, та же формула cx+77), cellDy
        // пересчитан индивидуально (-20→-30) — это ПЕРВАЯ реальная калибровка id118 отдельно
        // от id119, больше не "скопировано вслепую" (см. докблок в shmot.js у id118).
        const vCellScale118 = m118[0].match(/cellScale:(-?[\d.]+)/)[1];
        const vCellScale119 = m119[0].match(/cellScale:(-?[\d.]+)/)[1];
        assert(vCellScale118 === vCellScale119, `id118.cellScale (${vCellScale118}) == id119.cellScale (${vCellScale119}) — нативная пропорция файла не менялась`);
        const vCellDx118 = m118[0].match(/cellDx:(-?[\d.]+)/)[1];
        const vCellDx119 = m119[0].match(/cellDx:(-?[\d.]+)/)[1];
        assert(vCellDx118 === vCellDx119, `id118.cellDx (${vCellDx118}) == id119.cellDx (${vCellDx119}) — совпало по факту живой калибровки, не копией`);
        const vCellDy118 = m118[0].match(/cellDy:(-?[\d.]+)/)[1];
        assert(vCellDy118 === '-30', `id118.cellDy теперь индивидуально откалиброван (-30), получено ${vCellDy118}`);
    }
}

console.log('\nTest 6: Бита (id117) — явное исключение из handBuiltIn-блокировки переподъёма над курткой (оба файла)');
{
    assert(/_handWeaponHeld2 = _handEq && _handEq\.id !== 62 && _handEq\.id !== 92 && \(!_handEq\.handBuiltIn \|\| _handEq\.id === 117\);/.test(shopSrc),
        'shmot_shop.js: условие переподъёма включает исключение id117');
    assert(/_handWeaponHeld2 = _handEq && _handEq\.id !== 62 && _handEq\.id !== 92 && \(!_handEq\.handBuiltIn \|\| _handEq\.id === 117\);/.test(homeSrc),
        'home.js: условие переподъёма включает исключение id117');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
