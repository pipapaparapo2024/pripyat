/**
 * Test: 06.10.2026, по репорту со скриншотами — локация, открываемая победой над Бородой,
 * визуально показывает АЗС (вывеска "АЗС", бензоколонки, бочки), но подпись на экране гласила
 * "ЛОКАЦИЯ: СТАНЦИЯ"; локация за победу над Жгутом визуально показывает ЖД-платформу (вывеска
 * "Припять-1", вагоны), но подпись гласила "ЛОКАЦИЯ: ЗАПРАВКА" — текст не совпадал с картинкой.
 *
 * Это ОТДЕЛЬНЫЙ баг от правки 03.10.2026 (tests/hata-station-zapravka-image-swap-fix.test.js) —
 * та чинила рассинхрон ПОЗИЦИИ файла img между попапом хаты и home.js (игрок видел разные
 * картинки в двух местах интерфейса). Эта правка — внутри ОДНОГО и того же места (попап хаты)
 * текстовая подпись `name` не совпадала с тем, что физически нарисовано в файле img; картинка
 * (img) и её позиция не трогаются вообще, меняются только две строки `name`.
 *
 * Фикс: name у id:6 (открывается победой над Бородой) и id:7 (открывается победой над Жгутом) в
 * HATAS (hata.js) поменяны местами — "Станция" ↔ "Заправка".
 *
 * Run: node tests/hata-name-swap-vs-art-06-10.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const hataSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), 'utf-8');

// Реальная проверка контракта: распарсить массив HATAS как данные (не держать два параллельных
// regex'а на одну и ту же строку в разных тестах) — выполняем файл в изолированном контексте и
// читаем экспортированную структуру напрямую, чтобы тест ловил ЛЮБОЕ будущее изменение формата
// записи (не только конкретные пробелы/отступы, как в regex-тестах).
const vm = require('vm');
const sandbox = { module: { exports: {} }, exports: {}, console: { log(){}, error(){} } };
vm.createContext(sandbox);
// hata.js — ES-модуль (import/export default) и тянет applyPatch — вместо полного исполнения
// класса просто извлекаем литерал массива HATAS и eval'им его отдельно (сам массив — чистые
// данные, без побочных эффектов и внешних зависимостей).
const m = hataSrc.match(/const HATAS = (\[[\s\S]*?\n\]);/);
assert(!!m, 'литерал HATAS найден и извлекается из hata.js');
const HATAS = vm.runInContext(m[1], sandbox);

console.log('\n1) bossReq:6 (Борода) и bossReq:7 (Жгут) — названия совпадают с тем, что реально нарисовано на картинке');
{
    const boroda = HATAS.find(h => h.bossReq === 6);
    const zhgut  = HATAS.find(h => h.bossReq === 7);
    assert(!!boroda && !!zhgut, 'обе записи (bossReq:6 и bossReq:7) найдены в HATAS');
    // Картинка станция.png физически изображает АЗС (подтверждено скриншотом игрока) —
    // подпись, которую видит игрок за победу над Бородой, обязана звучать "Заправка".
    assert(boroda.img === 'станция.png' && boroda.name === 'Заправка',
        'bossReq:6 (Борода): img=станция.png, name="Заправка" — совпадает с тем, что на картинке');
    // Картинка заправка.png физически изображает ЖД-платформу — подпись за победу над Жгутом
    // обязана звучать "Станция".
    assert(zhgut.img === 'заправка.png' && zhgut.name === 'Станция',
        'bossReq:7 (Жгут): img=заправка.png, name="Станция" — совпадает с тем, что на картинке');
}

console.log('\n2) Регресс-гвард — у двух записей ИМЕНА разные (не обе стали одинаковыми по ошибке copy-paste)');
{
    const boroda = HATAS.find(h => h.bossReq === 6);
    const zhgut  = HATAS.find(h => h.bossReq === 7);
    assert(boroda.name !== zhgut.name, 'name у bossReq:6 и bossReq:7 различаются');
    assert(boroda.img !== zhgut.img, 'img у bossReq:6 и bossReq:7 по-прежнему различаются (img не тронут этой правкой)');
}

console.log('\n3) Регресс-гвард — остальные 6 локаций (Кубрик..Железка) не затронуты этой правкой');
{
    const untouched = HATAS.filter(h => h.bossReq !== 6 && h.bossReq !== 7);
    assert(untouched.length === 6, 'ровно 6 остальных записей (id 0-5)');
    const expected = ['Кубрик','Шлюз','Канализация','Двор','Мастерская','Железка'];
    assert(untouched.every((h, i) => h.name === expected[i]), 'названия остальных локаций не изменились: ' + untouched.map(h => h.name).join(', '));
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
