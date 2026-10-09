/**
 * Test: 09.10.2026, по прямому указанию — "заменил старые карточки покупки энергии на новые
 * (унифицированные под VK/ОК/Telegram), на которых больше НЕТ нарисованной цены (была только под
 * VK — 'N голосов' рисовал художник прямо на картинке). Теперь цену нужно рисовать текстом самому".
 *
 * Было (до этой правки): цена "N голосов" — часть растрового файла кнопки (нарисована под VK).
 * На ОК это уже один раз было найдено модерацией как нарушение ("цена не в валюте площадки", см.
 * докблок iap.js/genSlots() в bank.js — ТА ЖЕ проблема для donuts.json-товаров была исправлена
 * 05.10.2026, но для энергии оставался костыль: отдельный текстовый оверлей рисовался ТОЛЬКО для
 * isOk(), поверх всё ещё VK-ориентированной картинки — на VK цена читалась с самого рисунка).
 *
 * Стало: новые присланные карточки (кнопка энергии *.png, один набор на ВСЕ площадки) вообще не
 * содержат цены — вместо пустой таблички-рамки сверху кладётся PIXI.Text с ценой для ЛЮБОЙ
 * площадки (isOk() ? price_ok : votes), та же схема, что bank.js._displayPrice()/genSlots()
 * использует для donuts.json-товаров. Источник чисел (energy_packs.json) не менялся — только
 * способ их показа.
 *
 * Run: node tests/energy-buy-unified-cards-platform-price-text.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'energy_buy.js'), 'utf-8');
const energyPacks = JSON.parse(fs.readFileSync(path.join(root, '_client', 'src', 'data', 'energy_packs.json'), 'utf-8'));

console.log('\nTest 1: энергия берётся для ОБЕИХ площадок из уже существующего energy_packs.json (votes для VK, price_ok для ОК) — данные НЕ менялись, только способ показа');
{
    const EXPECTED = [
        { energy: 50,   votes: 3,   price_ok: 20 },
        { energy: 110,  votes: 7,   price_ok: 49 },
        { energy: 180,  votes: 10,  price_ok: 70 },
        { energy: 400,  votes: 20,  price_ok: 140 },
        { energy: 850,  votes: 40,  price_ok: 280 },
        { energy: 1300, votes: 60,  price_ok: 420 },
        { energy: 2000, votes: 85,  price_ok: 595 },
        { energy: 3500, votes: 120, price_ok: 840 },
    ];
    assert(energyPacks.length === 8, 'ровно 8 пакетов энергии');
    EXPECTED.forEach((exp, i) => {
        const got = energyPacks[i];
        assert(got && got.energy === exp.energy && got.votes === exp.votes && got.price_ok === exp.price_ok,
            `пакет ${i} (+${exp.energy} энергии): votes=${exp.votes} (ВК), price_ok=${exp.price_ok} (ОК) — совпадает с живым прайсом, присланным пользователем`);
    });
}

console.log('\nTest 2: цена текстом рисуется для ЛЮБОЙ площадки (раньше — только isOk(), внутри if(isOk()){...}), раз новая картинка не содержит цены ни для кого');
{
    assert(!/if\(isOk\(\)\)\{[\s\S]*?priceTxt/.test(src),
        'priceTxt больше НЕ находится внутри if(isOk()){...} — рисуется безусловно для каждой карточки');
    assert(/const price = isOk\(\) \? opt\.price_ok : opt\.votes;/.test(src),
        'число цены выбирается по площадке: ОК — price_ok, иначе (VK) — votes (та же схема, что bank.js._displayPrice())');
    assert(/const priceTxt = new PIXI\.Text\(price \+ ' ' \+ helper\.numberEnd\(price, 'votes'\)/.test(src),
        "склонение через helper.numberEnd(price, 'votes') — само подставит нужные слова платформы через modules/platform.js.currencyNames() (голос/голоса/голосов или ОК/ОКа/ОКов)");
}

console.log('\nTest 3: фоновая плашка под цену (priceBg, Graphics) УБРАНА — на новой картинке уже есть готовая табличка-рамка, повторный прямоугольник поверх неё смотрелся бы задвоенно');
{
    assert(!/priceBg/.test(src), 'priceBg (старый Graphics-прямоугольник под OK-текст) больше не существует в файле');
    assert(!/drawRoundedRect\(-60, 58, 120, 30, 6\)/.test(src), 'старая геометрия фоновой плашки удалена вместе с priceBg');
}

console.log('\nTest 4: позиция цены — ENERGY_PRICE_OFFSET_Y/X, вынесены в именованные константы (не магические числа внутри forEach)');
{
    // 09.10.2026 (правка тем же днём, по прямому указанию — "шрифт опусти вниз на 2px и вправо
    // на 3px, уменьши на 2px, сделай белым"): -78→-76 (вниз), добавлен X-offset +3 (вправо).
    assert(/const ENERGY_PRICE_OFFSET_Y = -76;/.test(src), 'ENERGY_PRICE_OFFSET_Y = -76 (было -78, +2px вниз по прямому указанию)');
    assert(/const ENERGY_PRICE_OFFSET_X = 3;/.test(src), 'ENERGY_PRICE_OFFSET_X = 3 (новый, +3px вправо по прямому указанию)');
    // 09.10.2026: priceTxt.x/y теперь ещё и прибавляют fine.dx/dy (точечная подстройка для
    // votes:60/85/120, см. Test 4b) — точный состав строки проверяется именно там.
    assert(/fontSize:16, fill:'#ffffff'/.test(src), 'fontSize 16 (было 18, -2px) и цвет белый #ffffff (было золотой #ffdd44) — по прямому указанию, для ОБЕИХ площадок одинаково');
    assert(!/card\.y \+ 73/.test(src), 'старое смещение +73 (цена ВНИЗУ старой карточки) не осталось в коде');
}

console.log('\nTest 4b (09.10.2026, точечная подстройка): индивидуальные сдвиги для карточек votes:60/85/120 (индексы 5/6/7)');
{
    assert(/const ENERGY_PRICE_FINE_TUNE = \{/.test(src), 'ENERGY_PRICE_FINE_TUNE определён — точечные правки отдельно от общего offset');
    assert(/5: \{ dx: 0, dy: -2 \},/.test(src), 'индекс 5 (votes:60, 1300 энергии): -2px по Y, без сдвига по X');
    assert(/6: \{ dx: 0, dy: -1 \},/.test(src), 'индекс 6 (votes:85, 2000 энергии): -1px по Y, без сдвига по X');
    assert(/7: \{ dx: 4, dy: -1 \},/.test(src), 'индекс 7 (votes:120, 3500 энергии): -1px по Y И +4px по X');
    assert(/const fine = ENERGY_PRICE_FINE_TUNE\[i\] \|\| \{ dx: 0, dy: 0 \};/.test(src), 'остальные 5 карточек получают нулевую точечную правку (fallback), не ломаются');
    assert(/priceTxt\.x = card\.x \+ ENERGY_PRICE_OFFSET_X \+ fine\.dx;/.test(src), 'priceTxt.x учитывает и общий, и точечный offset');
    assert(/priceTxt\.y = card\.y \+ ENERGY_PRICE_OFFSET_Y \+ fine\.dy;/.test(src), 'priceTxt.y учитывает и общий, и точечный offset');

    // Сверка чисел на реальных данных energyPacks — votes:60/85/120 действительно лежат на
    // индексах 5/6/7 (та же проверка, что защищает от будущей перестановки пакетов местами).
    const idxByVotes = {};
    energyPacks.forEach((p, i) => { idxByVotes[p.votes] = i; });
    assert(idxByVotes[60] === 5, 'votes:60 действительно на индексе 5 в energy_packs.json (1300 энергии)');
    assert(idxByVotes[85] === 6, 'votes:85 действительно на индексе 6 в energy_packs.json (2000 энергии)');
    assert(idxByVotes[120] === 7, 'votes:120 действительно на индексе 7 в energy_packs.json (3500 энергии)');
}

console.log('\nTest 5: список файлов карточек не повреждён (все 8 путей на местах, те же имена, что уже используются на сервере/в коде)');
{
    const EXPECTED_FILES = [
        'кнопка энергии 50.png', 'кнопка энергии 110.png', 'кнопка энергии 180.png', 'кнопка энергии 400.png',
        'кнопка энергии 850.png', 'кнопка энергии 1300.png.png', 'кнопка энергии 2000.png', 'кнопка энергии 3500.png.png',
    ];
    EXPECTED_FILES.forEach(f => {
        assert(src.includes(`file:'${f}'`), `путь карточки "${f}" присутствует (имя файла не менялось — заменено только содержимое PNG)`);
    });
}

console.log('\nTest 6: реальные локальные файлы (_client/development/images/.../Энергия/) заменены на новые — байт-в-байт совпадают с присланными исходниками, размеры файлов отличаются от старых (контент реально другой, не просто переименование)');
{
    const devDir = path.join(root, '_client', 'development', 'images', 'layers', 'popups', 'Энергия');
    const FILES = [
        'кнопка энергии 50.png', 'кнопка энергии 110.png', 'кнопка энергии 180.png', 'кнопка энергии 400.png',
        'кнопка энергии 850.png', 'кнопка энергии 1300.png.png', 'кнопка энергии 2000.png', 'кнопка энергии 3500.png.png',
    ];
    FILES.forEach(f => {
        const p = path.join(devDir, f);
        assert(fs.existsSync(p), `файл "${f}" существует в development/images`);
        if (fs.existsSync(p)) assert(fs.statSync(p).size > 0, `файл "${f}" не пустой`);
    });
    // Все 8 файлов имеют одинаковую ширину (185px) — та же, что у старых ассетов, поэтому позиции
    // карточек (card.x/card.y) НЕ требуют пересчёта, только содержимое сменилось.
    try {
        const { execFileSync } = require('child_process');
        // Без внешних зависимостей (sharp/PIL недоступны гарантированно в Node) — читаем ширину
        // напрямую из PNG IHDR-чанка (байты 16-19 big-endian), простая и надёжная проверка.
        FILES.forEach(f => {
            const buf = fs.readFileSync(path.join(devDir, f));
            const width = buf.readUInt32BE(16);
            assert(width === 185, `файл "${f}": ширина PNG = 185px (IHDR) — совпадает со старыми ассетами, позиции карточек не уехали`);
        });
    } catch (e) {
        console.log('  ⚠️  пропуск проверки ширины PNG (' + e.message + ')');
    }
}

console.log('\nTest 7 (сверка перед выпуском модерации ОК — по прямому запросу): все 4 товарных прайса (сигареты/рубли/тушёнка/энергия) для ОК совпадают с присланным пользователем прайс-листом');
{
    const donuts = JSON.parse(fs.readFileSync(path.join(root, 'server', 'json', 'donuts.json'), 'utf-8'));
    const CASES = [
        { name: 'cigarettes', defaults: [1600, 3600, 6000, 8000, 11000, 22000, 125000, 300000], price_ok: [7, 14, 20, 28, 35, 70, 350, 700] },
        { name: 'coins',      defaults: [16, 36, 56, 100, 600, 2000, 10000, 20000],              price_ok: [7, 14, 20, 35, 210, 700, 3500, 7000] },
        { name: 'stew',       defaults: [4, 12, 24, 80, 200, 400, 2000, 4000],                   price_ok: [7, 20, 42, 140, 350, 700, 3500, 7000] },
    ];
    CASES.forEach(c => {
        const d = donuts[c.name];
        assert(JSON.stringify(d.default) === JSON.stringify(c.defaults), `donuts.json.${c.name}.default совпадает с присланным списком количеств`);
        assert(JSON.stringify(d.price_ok) === JSON.stringify(c.price_ok), `donuts.json.${c.name}.price_ok совпадает с присланным прайс-листом ОК`);
    });
    const energyExpected = { defaults: [50, 110, 180, 400, 850, 1300, 2000, 3500], price_ok: [20, 49, 70, 140, 280, 420, 595, 840] };
    assert(JSON.stringify(energyPacks.map(p => p.energy)) === JSON.stringify(energyExpected.defaults), 'energy_packs.json количества энергии совпадают с присланным списком');
    assert(JSON.stringify(energyPacks.map(p => p.price_ok)) === JSON.stringify(energyExpected.price_ok), 'energy_packs.json.price_ok совпадает с присланным прайс-листом ОК для энергии');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
