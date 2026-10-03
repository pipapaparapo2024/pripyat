/**
 * Test: переименование файлов шмоток по схеме "категория_номер" + подсказка с названием
 * при наведении в магазине (shmot_shop.js) + проверка, что реально показываются ВСЕ шмотки.
 *
 * Контекст: раньше картинки шмоток именовались вперемешку — shmot_N.png (по id),
 * shmot_eN.png («extra», добавленные позже) и просто русские слова (мачете.png,
 * броник.png). Переименовали в стиле "категория_номер" (голова_1..6, тело_1..4,
 * штаны_1..9, обувь_1..8, аксессуар_1..4, рука_1..6) — имя файла теперь сразу
 * говорит, что это за вещь и к какой категории относится.
 *
 * Заодно нашли: в магазине (shmot_shop.js) нет тултипа с названием при наведении —
 * добавили. И: категории 4 (Аксессуар) и 5 (Татуировки) физически есть в данных
 * (this.items), но в магазине нет кнопок для перехода на эти вкладки — эти 8 вещей
 * недостижимы через UI (задокументировано отдельным тестом ниже, ждём решения по UI).
 *
 * Run: node tests/shmot-rename-and-tooltip.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const shmotSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shmot.js'), 'utf-8'
);
const shopSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), 'utf-8'
);
const shmotDir = path.join(__dirname, '..', '_client', 'development', 'images', 'shmot');

// ── Извлекаем items из shmot.js регэкспом (полноценный import невозможен — файл ──
// рассчитан на глобальные window/PIXI) ────────────────────────────────────────
function parseItems(src) {
    const m = src.match(/this\.items\s*=\s*\[([\s\S]*?)\n\t{2}\];/);
    if (!m) return [];
    // Каждый предмет — одна строка; price:{...} внутри объекта ломает наивный
    // "match до первой }", поэтому парсим построчно, а не одним регэкспом на блок.
    const items = [];
    for (const line of m[1].split('\n')) {
        const idM = line.match(/\{id:(\d+),\s*cat:(\d+),\s*name:'([^']+)'/);
        if (!idM) continue;
        const imgM = line.match(/imgFile:'([^']+)'/);
        items.push({ id: +idM[1], cat: +idM[2], name: idM[3], imgFile: imgM ? imgM[1] : null });
    }
    return items;
}
const items = parseItems(shmotSrc);

// ── Test 1: все предметы распознаны из исходника ─────────────────────────────
// 19.09.2026: добавлены 32 дроп-предмета (id41-72, "Шмот.docx") — итого 73, см.
// shmot-organized-catalog-and-sources.test.js.
console.log('\nTest 1: парсер находит все шмотки в shmot.js');
{
    // 19.09.2026: +16 предметов вторым батчем дропов (id73-88).
    // 21.09.2026: +2 предмета сета "новопришедший" (id94/95, пересборка из _organized).
    // 22.09.2026: -1 (id93 удалён, не входил в канон) +4 финальной сверки (id96-99).
    // 23.09.2026 (сверка каталога сетов против _organized байт-в-байт, по прямому указанию —
    // "шмотки повторяются, на сервере остались старые"): было 90 (после чистки id63/75/76/78/
    // 79/93/96-99 в этом же дне) — дополнительно убраны ещё 5 (id52/55/58/64/80), картинки
    // которых байт-в-байт совпадали со СТАРЫМИ иконками базового магазина (голова_1.png,
    // тело_1.png, рука_1.png/рука_6.png, штаны_1.png) — честного уникального арта для них в
    // _organized не было, отсюда и видимые дубли в магазине. Итог: 85.
    // 23.09.2026 (этот же день, батч "убери все шмотки, которые не выбиваются с боссов"):
    // 85 → 44 — весь базовый магазин (id0-40) удалён целиком.
    // 28.09.2026: +1 псевдо-предмет id:100 "Связка ключей" (постоянный пассивный бонус за приз
    // рулетки, не обычная вещь на слот — см. tests/shmot-keyring-shown-as-item.test.js). 58 → 59.
    assert(items.length === 59, `найдено 59 предметов (58 дропов id≥41 + псевдо-предмет id:100), получили ${items.length}`);
}

// ── Test 2 (историческое): схема категория_номер у старого базового магазина ──
// 19.09.2026: новые 32 дроп-предмета (id41-72) сознательно НЕ следовали этой схеме — у них
// описательные имена "шмот <предмет> <источник>.png" (namespacing-правило CLAUDE.md, "Коллизии
// имён файлов-ассетов"), см. shmot-organized-catalog-and-sources.test.js.
// 23.09.2026 (батч "убери все шмотки, которые не выбиваются с боссов"): сам базовый магазин
// (id0-40, единственный носитель схемы категория_номер) удалён из shmot.js целиком — проверять
// её больше не на чем. Тест теперь регресс-гвард на то, что схема категория_номер (голова_N/
// тело_N/штаны_N/обувь_N/аксессуар_N/рука_N) не встречается ни у одного оставшегося предмета.
console.log('\nTest 2: схема имён категория_номер (старый базовый магазин) не осталась ни у одного предмета');
{
    const pattern = /^(голова|тело|штаны|обувь|аксессуар|рука)_\d+\.png$/;
    const stillMatching = items.filter(it => it.imgFile && pattern.test(it.imgFile));
    assert(stillMatching.length === 0,
        `ни один из 58 дроп-предметов не использует схему категория_номер (нашли ${stillMatching.length})`);
}

// ── Test 3: нет дублей имён файлов (каждая шмотка — уникальная картинка) ───────
console.log('\nTest 3: нет коллизий имён файлов между разными шмотками');
{
    const seen = new Map();
    let collisions = 0;
    for (const it of items) {
        if (!it.imgFile) continue;
        if (seen.has(it.imgFile)) collisions++;
        seen.set(it.imgFile, it.id);
    }
    assert(collisions === 0, `коллизий имён файлов нет, найдено ${collisions}`);
}

// ── Test 4: старых имён (shmot_N.png / shmot_eN.png / голые русские слова) в коде нет ──
console.log('\nTest 4: старые имена файлов полностью выведены из кода');
{
    assert(!/imgFile:'shmot_\d/.test(shmotSrc), 'не осталось imgFile:\'shmot_N...\'');
    assert(!/imgFile:'shmot_e\d/.test(shmotSrc), 'не осталось imgFile:\'shmot_eN...\'');
    assert(!shopSrc.includes("'shmot_8.png'"), 'shmot_shop.js больше не ссылается на shmot_8.png (спец-случай для брюк обновлён)');
    assert(shopSrc.includes("'штаны_1.png'"), 'shmot_shop.js использует новое имя штаны_1.png для спец-случая брюк');
}

// ── Test 5: подсказка с названием при наведении подключена в магазине ─────────
console.log('\nTest 5: shmot_shop.js показывает название шмотки при наведении на карточку');
{
    // 25.09.2026 (регресс найден повторным прогоном тестов): тултип переделан со списка строк
    // в PIXI.Text на светлую карточку-референс (_shopTipCard, отдельные Text для заголовка/
    // "Бонус:"/"Сет:"/"Требования:") — старый _shopTipTxt/lines=[item.name,item.bonus] больше
    // не существует, но название по-прежнему первая строка карточки (просто теперь title).
    assert(/_shopTipCard/.test(shopSrc), 'тултип-карточка _shopTipCard создана');
    assert(/proto\._showShopTip = function\(frame, item\)\{/.test(shopSrc), '_showShopTip определён');
    assert(/const title = new PIXI\.Text\(item\.name, titleStyle\);/.test(shopSrc), '_showShopTip включает item.name первой строкой (заголовок карточки)');
    assert(/frame\.on\('pointerover',\s*\(\)=>\s*this\._showShopTip\(frame, item\)\)/.test(shopSrc),
        'карточка в сетке вызывает _showShopTip по pointerover');
    assert(/frame\.on\('pointerout',\s*\(\)=>\s*this\._hideShopTip\(\)\)/.test(shopSrc),
        'карточка в сетке скрывает тултип по pointerout');
}

// ── Test 6: НАЙДЕННЫЙ БАГ — категории 4 (Аксессуар) и 5 (Татуировки) недостижимы в магазине ──
console.log('\nTest 6: документируем недостижимость категорий 4 и 5 в текущем UI магазина (ждёт решения)');
{
    const catsMatch = shopSrc.match(/const CATS = \[([\s\S]*?)\];/);
    assert(!!catsMatch, 'массив CATS (кнопки категорий) найден');
    if (catsMatch) {
        const body = catsMatch[1];
        assert(!/cat:\s*4/.test(body), 'подтверждено: нет кнопки для cat:4 (Аксессуар) — 4 шмотки недостижимы');
        assert(!/cat:\s*5/.test(body), 'подтверждено: нет кнопки для cat:5 (Татуировки) — 4 шмотки недостижимы');
    }
    // 23.09.2026 (батч "убери все шмотки, которые не выбиваются с боссов"): все 4+4=8 вещей
    // категорий Аксессуар/Татуировки жили ИСКЛЮЧИТЕЛЬНО в удалённом базовом магазине (id0-40) —
    // ни один дроп-предмет (id41+) в эти категории не попадал. Итог: обе категории теперь
    // пусты — вопрос "недостижимости" снят вместе с самими вещами, а не решён отдельно.
    const itemsInCat4 = items.filter(it => it.cat === 4).length;
    const itemsInCat5 = items.filter(it => it.cat === 5).length;
    assert(itemsInCat4 === 0 && itemsInCat5 === 0,
        `категории Аксессуар/Татуировки теперь пусты (Аксессуар=${itemsInCat4}, Татуировки=${itemsInCat5}) — были только в удалённом базовом магазине`);
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
