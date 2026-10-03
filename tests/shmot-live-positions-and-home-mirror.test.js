/**
 * Test: правки по результатам живой работы с редактором позиций (скриншоты пользователя).
 *
 * 1) manDx/manDy обновлены на точные значения, снятые пользователем через drag-редактор
 *    (перекрывают более ранние приблизительные оценки).
 * 2) z-index: Штаны рендерятся ПОСЛЕ (=выше) Обуви, Торс — ПОСЛЕ (=выше) Штанов —
 *    и в магазине, и в главном меню (штанина перекрывает голенище, подол — пояс штанов).
 * 3) Персонаж в главном меню (home.js) теперь одевается теми же шмотками/пропорциями,
 *    что манекен в магазине — новый метод Home.updateClothes(), вызывается при смене
 *    экипировки в shmot_shop.js._onShmotClick.
 * 4) Найденный попутный баг — Shmot конструктор никогда не вызывал _loadFromUdata()
 *    (в отличие от всех остальных модулей) — экипировка не переживала перезагрузку.
 *
 * Run: node tests/shmot-live-positions-and-home-mirror.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const shmotSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shmot.js'), 'utf-8');
const shopSrc  = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), 'utf-8');
const homeSrc  = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'home.js'), 'utf-8');

function getItemLine(imgFile) {
    const re = new RegExp(`\\{id:\\d+[^\\n]*imgFile:'${imgFile}'[^\\n]*\\}`);
    const m = shmotSrc.match(re);
    return m ? m[0] : null;
}

// ── Test 1/2 (историческое): manDx/manDy/manScale базового магазина ───────────
// 23.09.2026 (батч "убери все шмотки, которые не выбиваются с боссов"): ВСЕ предметы из этих
// двух тестов (голова_N/обувь_N/тело_N/штаны_N — generic-asset схема, использовалась ТОЛЬКО
// базовым магазином id0-40) удалены из shmot.js целиком — дроп-предметы (id41+) используют
// другую схему имён файлов ("шмот ....png", см. shmot.js), их эти позиции не касались вообще.
// Позиционный разбор неактуален вместе с самими предметами — тест теперь регресс-гвард на то,
// что generic-asset схема действительно не осталась в каталоге.
console.log('\nTest 1/2: base-shop generic-asset предметы (голова_N/обувь_N/тело_N/штаны_N) удалены батчем 23.09.2026');
{
    const genericAssetFiles = [
        'голова_1.png','голова_4.png','голова_5.png','голова_6.png',
        'обувь_1.png','обувь_3.png','обувь_4.png','обувь_5.png','обувь_6.png','обувь_7.png','обувь_8.png',
        'тело_1.png','тело_2.png','тело_3.png','тело_4.png',
        'штаны_1.png','штаны_2.png','штаны_3.png','штаны_4.png','штаны_5.png','штаны_6.png','штаны_7.png','штаны_8.png','штаны_9.png',
    ];
    for (const file of genericAssetFiles) {
        assert(!getItemLine(file), `${file} отсутствует в каталоге (был только у удалённого базового магазина)`);
    }
}

// ── Test 3: z-index — Обувь ниже Штанов, Штаны ниже Торса в MAN_SLOTS ─────────
console.log('\nTest 3: z-index — Обувь (cat3) ниже Штанов (cat2), Штаны ниже Торса (cat1) в массиве MAN_SLOTS');
{
    const m = shopSrc.match(/const MAN_SLOTS = \[([\s\S]*?)\];/);
    assert(!!m, 'MAN_SLOTS найден в shmot_shop.js');
    if (m) {
        const catOrder = [...m[1].matchAll(/cat:\s*(\d+)/g)].map(x => +x[1]);
        const idxLegs  = catOrder.indexOf(2); // Штаны
        const idxTorso = catOrder.indexOf(1); // Торс
        const idxShoes = catOrder.indexOf(3); // Обувь
        assert(idxLegs >= 0 && idxTorso >= 0 && idxShoes >= 0, 'категории 1,2,3 присутствуют в MAN_SLOTS');
        assert(idxLegs < idxTorso, 'Штаны (cat2) добавлены РАНЬШЕ Торса (cat1) → Торс рендерится выше');
        assert(idxShoes < idxLegs, 'Обувь (cat3) добавлена РАНЬШЕ Штанов (cat2) → Штаны рендерятся выше (перекрывают голенище)');
    }
}

// ── Test 4: home.js — тот же порядок z-index в CLOTH_SLOTS ────────────────────
console.log('\nTest 4: home.js CLOTH_SLOTS повторяет тот же порядок z-index, что и магазин');
{
    const m = homeSrc.match(/const CLOTH_SLOTS = \[([\s\S]*?)\];/);
    assert(!!m, 'CLOTH_SLOTS найден в home.js');
    if (m) {
        const catOrder = [...m[1].matchAll(/cat:\s*(\d+)/g)].map(x => +x[1]);
        const idxLegs  = catOrder.indexOf(2);
        const idxTorso = catOrder.indexOf(1);
        const idxShoes = catOrder.indexOf(3);
        assert(idxLegs < idxTorso, 'home.js: Штаны раньше Торса');
        assert(idxShoes < idxLegs, 'home.js: Обувь раньше Штанов');
    }
    assert(/const HOME_DX = -224, HOME_DY = -4;/.test(homeSrc),
        'использован тот же сдвиг (-224,-4), что и для кистей рук на этом экране');
    // Раньше addChild шёл через Object.values(this._clothSlots) — для числовых ключей (cat)
    // JS ВСЕГДА отдаёт их по возрастанию независимо от порядка вставки, так что порядок
    // в массиве CLOTH_SLOTS реально ни на что не влиял. Теперь addChild — напрямую по массиву.
    assert(!/Object\.values\(this\._clothSlots\)\.forEach\(spr => root\.layer0_mc\.addChild\(spr\)\);/.test(homeSrc),
        'больше НЕТ addChild через Object.values (числовые ключи игнорировали порядок массива)');
    // Позже между Аксессуаром/Рукой вставили фалангу (addChild для cat:6 остаётся ПОСЛЕДНИМ
    // в CLOTH_SLOTS, поэтому порядок массива по-прежнему и есть z-index) — форма вызова
    // изменилась (уже не однострочный forEach), но проверяем то же по сути: массив, не Object.values.
    const addChildBlock = homeSrc.match(/CLOTH_SLOTS\.forEach\(s => \{([\s\S]*?)\n\t\t\}\);/);
    assert(!!addChildBlock, 'addChild идёт через CLOTH_SLOTS.forEach (не Object.values) — порядок массива определяет z-index');
    if (addChildBlock) {
        assert(/root\.layer0_mc\.addChild\(this\._clothSlots\[s\.cat\]\);/.test(addChildBlock[1]),
            'каждый слот добавляется по s.cat в порядке массива CLOTH_SLOTS');
    }
}

// ── Test 5: Home.updateClothes() зеркалит логику _updateManSprites (включая штаны_1 хак) ──
console.log('\nTest 5: Home.updateClothes() корректно читает manDx/manDy/manScale и штаны_1-хак');
{
    const m = homeSrc.match(/updateClothes\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'updateClothes() найден в home.js');
    if (m) {
        const body = m[1];
        assert(/eq\.manDx \|\| 0/.test(body) && /eq\.manDy \|\| 0/.test(body), 'использует eq.manDx/manDy');
        assert(/eq\.manScale \|\| 1/.test(body), 'использует eq.manScale');
        assert(/eq\.imgFile === 'штаны_1\.png' \? -28 : 0/.test(body), 'учитывает спец-хак -28 для штаны_1.png');
        assert(/shmot\.items \|\| \[\]/.test(body), 'читает именно window.shmot.items (общий источник истины)');
    }
}

// ── Test 6: обновление персонажа в главном меню при смене экипировки ──────────
// 19.09.2026: вызов переехал из shmot_shop.js._onShmotClick в shmot.js._onWear — тот самый
// баг-фикс, где выяснилось, что _onShmotClick в shmot_shop.js дублировал buy/equip-логику и
// затирал server-authoritative _buy()/_saveToUdata() класса Shmot (см.
// shmot-shop-prototype-collision-and-skills-json-fix.test.js). _onShmotClick теперь просто
// делегирует в _onWear(item.id), поэтому и home.updateClothes() естественно живёт там же.
console.log('\nTest 6: shmot.js._onWear вызывает home.updateClothes() при экипировке предмета (после переноса из shmot_shop.js)');
{
    assert(/if\(window\.home\) home\.updateClothes\(\);/.test(shmotSrc),
        '_onWear вызывает home.updateClothes() после смены экипировки');
    assert(/this\._onWear\(item\.id\);/.test(shopSrc),
        'shmot_shop.js._onShmotClick делегирует в _onWear (не дублирует логику)');
}

// ── Test 7: попутный баг — Shmot конструктор теперь загружает сохранённое состояние ──
console.log('\nTest 7: Shmot конструктор вызывает _loadFromUdata() (раньше не вызывал вообще)');
{
    const ctorMatch = shmotSrc.match(/constructor\(mc\)\{([\s\S]*?)\n\t\}/);
    assert(!!ctorMatch, 'constructor(mc) найден');
    if (ctorMatch) {
        assert(/this\._loadFromUdata\(\);/.test(ctorMatch[1]),
            'constructor вызывает this._loadFromUdata() — иначе owned/equipped сбрасывались при каждой перезагрузке');
    }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
