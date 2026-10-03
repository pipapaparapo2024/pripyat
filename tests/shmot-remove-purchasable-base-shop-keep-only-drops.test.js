/**
 * Test: базовый магазин шмоток (ids 0-40, покупка за coins/stew/cig) убран ЦЕЛИКОМ (23.09.2026,
 * по прямому указанию — "убери все шмотки, которые покупаются за монеты или за тушёнку, короче
 * — все, которые не выбиваются с боссов"). Причина репорта: несколько базовых предметов визуально
 * дублировали дроп-вещи под другим названием/ценой ("Панамка белая"≈"Панама (Баркут)", "Кепка-
 * оригами"≈"Газета (Крыс)", "Панама СССР"≈"Панама (Охотник)", "Кепка тактическая"≈"Кепка
 * (Меченный)") — а не только байт-в-байт совпадающие файлы, которые уже чинились точечно чуть
 * раньше тем же днём. Единственное оставшееся правило: только предметы с price:null (честный
 * дроп с боссов/казино/тайника) — простое и не требует разбора каждой пары дублей по отдельности.
 *
 * _buy()/shmot.php.buy()/shmot_items.json НЕ удалены — мёртвый код/данные на случай возврата
 * покупных предметов с новым артом.
 *
 * Run: node tests/shmot-remove-purchasable-base-shop-keep-only-drops.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shmot.js'), 'utf-8'
);

console.log('\nTest 1: единственные покупные предметы каталога — id94/95/97 (сет "новопришедший"), всё остальное price:null');
{
    const start = src.indexOf('this.items = [');
    const end   = src.indexOf('\n\t\t];', start);
    const body  = src.slice(start, end);
    // 26.09.2026 (по прямому указанию — реверс автовыдачи стартового сета "новопришедший"):
    // 3 предмета (id94 обувь/id95 футболка/id97 шорты) снова стали обычными покупными
    // товарами за сигареты — единственное отступление от правила "только честный дроп".
    const itemLines = body.split('\n').filter(l => /^\s*\{id:\d+,/.test(l));
    const priceIds = itemLines
        .filter(l => /price:\{/.test(l))
        .map(l => parseInt(l.match(/\{id:(\d+),/)[1]))
        .sort((a, b) => a - b);
    assert(JSON.stringify(priceIds) === JSON.stringify([94, 95, 97]),
        'ровно 3 записи с price:{type,...} — id94/95/97 (сет "новопришедший"), нашли: ' + JSON.stringify(priceIds));

    const ids = [...body.matchAll(/\{id:(\d+),/g)].map(m => parseInt(m[1]));
    assert(ids.length > 0, 'каталог не пуст');
    assert(ids.every(id => id >= 41), 'все оставшиеся id ≥ 41 (диапазон базового магазина 0-40 убран целиком)');
    assert(!ids.includes(0) && !ids.includes(24) && !ids.includes(25), 'конкретно названные пользователем дубли (id0 Бандана-контекст, id24 Панама СССР, id25 Кепка тактическая) отсутствуют');
}

console.log('\nTest 2: конкретно названные пользователем дублирующиеся предметы убраны по имени');
{
    const start = src.indexOf('this.items = [');
    const end   = src.indexOf('\n\t\t];', start);
    const body  = src.slice(start, end);
    assert(!/name:'Панамка белая'/.test(body), '"Панамка белая" убрана (дублировала "Панама (Баркут)")');
    assert(!/name:'Кепка-оригами'/.test(body), '"Кепка-оригами" убрана (дублировала "Газета (Крыс)")');
    assert(!/name:'Панама СССР'/.test(body), '"Панама СССР" убрана (дублировала "Панама (Охотник)")');
    assert(!/name:'Кепка тактическая'/.test(body), '"Кепка тактическая" убрана (дублировала "Кепка (Меченный)")');
    // Дубли, которые они дублировали, — остаются на месте (это честные дроп-вещи).
    assert(/name:'Панама \(Баркут\)'/.test(body), 'sanity: "Панама (Баркут)" (дроп) осталась');
    assert(/name:'Газета \(Крыс\)'/.test(body), 'sanity: "Газета (Крыс)" (дроп) осталась');
    assert(/name:'Панама \(Охотник\)'/.test(body), 'sanity: "Панама (Охотник)" (дроп) осталась');
    assert(/name:'Кепка \(Меченный\)'/.test(body), 'sanity: "Кепка (Меченный)" (дроп) осталась');
}

console.log('\nTest 3: все оставшиеся предметы каталога — price:null (честный дроп), кроме id94/95/97');
{
    const start = src.indexOf('this.items = [');
    const end   = src.indexOf('\n\t\t];', start);
    const body  = src.slice(start, end);
    const entries = [...body.matchAll(/\{id:(\d+),[\s\S]*?owned:false, equipped:false\}/g)];
    assert(entries.length > 0, 'найдены записи каталога для проверки');
    const notNull = entries.filter(m => !/price:null/.test(m[0]));
    const notNullIds = notNull.map(m => parseInt(m[1])).sort((a, b) => a - b);
    assert(JSON.stringify(notNullIds) === JSON.stringify([94, 95, 97]),
        'без price:null — ровно id94/95/97 (реверс автовыдачи "новопришедший"), нашли: ' + JSON.stringify(notNullIds));
}

console.log('\nTest 4: _buy()/shmot.php.buy() не удалены целиком — мёртвый код на будущее, не сломан');
{
    assert(/_buy\(item\)\{/.test(src), '_buy() всё ещё существует как метод (не удалён физически)');
    assert(/if\(!item\.price\)\{/.test(src), '_onWear() по-прежнему разветвляется по item.price (сейчас всегда falsy, но код не переписан жёстко под "всегда дроп")');
}

console.log('\nTest 5: server/json/shmot_items.json сохраняет старые id для совместимости (валидация покупки — мёртвая, но не удалена)');
{
    const shmotItemsPath = path.join(__dirname, '..', 'server', 'json', 'shmot_items.json');
    const catalog = JSON.parse(fs.readFileSync(shmotItemsPath, 'utf-8'));
    assert(Array.isArray(catalog) && catalog.filter(item => item.id <= 40).length === 41, 'shmot_items.json (серверная валидация покупки) по-прежнему содержит все 41 запись ids 0-40; новые дропы проверяются отдельно');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
