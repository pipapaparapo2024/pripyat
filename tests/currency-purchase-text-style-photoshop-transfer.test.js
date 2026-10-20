/**
 * Test: 20.10.2026, по прямому указанию — пользователь прислал скрины панелей "Стиль слоя" из
 * Photoshop для текста "5 голоса" (Тиснение, Выполнить обводку, Внутреннее свечение, Наложение
 * градиента, Тень) и попросил перенести этот стиль на ВЕСЬ текст попапа покупки валюты
 * (interface-currency-purchase.js — countTxt/priceTxt/titleTxt).
 *
 * Тиснение и внутреннее свечение НЕ переносятся — в PIXI.Text нет встроенной поддержки ни
 * для того, ни для другого, а добавлять отдельную библиотеку фильтров (pixi-filters) под 3
 * текстовых поля пользователь явно отклонил ("без него можно обойтись").
 *
 * Перенесены три эффекта, которые PIXI.TextStyle поддерживает нативно:
 *   Обводка (скрин 1): размер 2px, снаружи, цвет чёрный, непрозрачность 38%. PIXI.Text не умеет
 *     отдельную альфу на обводку (одна общая альфа объекта) — приближено тёмно-серым цветом
 *     (#3a3a3a) вместо чёрного на полной непрозрачности, визуально близкий результат.
 *   Градиент (скрин 2): линейный, "выровнять по слою", угол 90° (сверху вниз), белый → серый —
 *     PIXI.TextStyle.fill как массив цветов = вертикальный градиент по умолчанию (TEXT_GRADIENT.
 *     LINEAR_VERTICAL).
 *   Тень (скрин 3): чёрная, непрозрачность 72%, смещение 2px, размер(блюр) 3px, угол 112°.
 *     Угол Photoshop (математический, против часовой от +X) переведён в угол PIXI (экранный, по
 *     часовой от +X, Y вниз) формулой 180° - 112° = 68° ≈ 1.187 рад.
 *
 * Run: node tests/currency-purchase-text-style-photoshop-transfer.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'interface', 'interface-currency-purchase.js'), 'utf-8'
);

console.log('\nTest 1: TXT_STYLE_BASE содержит перенесённые значения из Photoshop (градиент/обводка/тень)');
{
    const start = src.indexOf('const TXT_STYLE_BASE = {');
    const end   = src.indexOf('\n    };', start);
    const body  = src.slice(start, end);
    assert(!!body, 'TXT_STYLE_BASE найден');

    assert(/fill: \['#ffffff', '#c8c8c8'\],/.test(body), 'градиент — белый → серый (#ffffff → #c8c8c8), вертикальный по умолчанию');
    assert(/stroke: '#3a3a3a', strokeThickness: 2,/.test(body), 'обводка — 2px, тёмно-серый (приближение 38%-непрозрачного чёрного)');
    assert(/dropShadow: true, dropShadowColor: '#000000', dropShadowAlpha: 0\.72,/.test(body), 'тень — чёрная, альфа 0.72 (72% из Photoshop)');
    assert(/dropShadowDistance: 2, dropShadowBlur: 2, dropShadowAngle: 1\.187,/.test(body), 'тень — смещение 2px, блюр 2px, угол 1.187 рад (68°, пересчитан из 112° Photoshop)');
    assert(/padding: 8,/.test(body), 'padding увеличен до 8 (было 6) — под новую обводку+тень, не клипать bounding-box');
}

console.log('\nTest 2: все три текста (count/price/title) используют общий TXT_STYLE_BASE');
{
    assert(/const TXT_STYLE_COUNT = Object\.assign\(\{\}, TXT_STYLE_BASE, \{ align: 'center', wordWrap: true, wordWrapWidth: 130 \}\);/.test(src),
        'TXT_STYLE_COUNT = TXT_STYLE_BASE + выравнивание/перенос строк');
    assert(/const TXT_STYLE_PRICE = Object\.assign\(\{\}, TXT_STYLE_BASE\);/.test(src), 'TXT_STYLE_PRICE = TXT_STYLE_BASE как есть');
    assert(/const TXT_STYLE_TITLE = Object\.assign\(\{\}, TXT_STYLE_BASE\);/.test(src), 'TXT_STYLE_TITLE = TXT_STYLE_BASE как есть');
}

console.log('\nTest 3: resolution=4 (фикс рендера от 20.10.2026) не тронут переносом стиля — остаётся на объектах');
{
    const countIdx = src.indexOf('const countTxt = new PIXI.Text(');
    const countBlock = src.slice(countIdx, src.indexOf('gridCont.addChild(countTxt);', countIdx));
    assert(/countTxt\.resolution = 4;/.test(countBlock), 'countTxt.resolution = 4 сохранён');

    const priceIdx = src.indexOf('const priceTxt = new PIXI.Text(');
    const priceBlock = src.slice(priceIdx, src.indexOf('gridCont.addChild(priceTxt);', priceIdx));
    assert(/priceTxt\.resolution = 4;/.test(priceBlock), 'priceTxt.resolution = 4 сохранён');

    const titleIdx = src.indexOf("const titleTxt = new PIXI.Text('', TXT_STYLE_TITLE);");
    const titleBlock = src.slice(titleIdx, src.indexOf('win.addChild(titleTxt);', titleIdx));
    assert(/titleTxt\.resolution = 4;/.test(titleBlock), 'titleTxt.resolution = 4 сохранён');
}

console.log('\nTest 4: ни тиснение, ни внутреннее свечение не добавлены (библиотека фильтров не подключалась)');
{
    // Регекс ловит РЕАЛЬНОЕ использование (import/new) — не матчит по голой подстроке, иначе
    // ловит собственный же объясняющий комментарий файла ("добавлять pixi-filters... решили не
    // делать"), который содержит эти слова как раз потому, что их НЕТ в коде.
    assert(!/import .*pixi-filters/i.test(src), 'pixi-filters не импортирован в этом файле');
    assert(!/new PIXI\.filters\.(Bevel|Glow)/i.test(src), 'BevelFilter/GlowFilter не создаются в этом файле');
    const pkg = fs.readFileSync(path.join(__dirname, '..', '_client', 'package.json'), 'utf-8');
    assert(!/"pixi-filters"/i.test(pkg), 'pixi-filters не добавлен в зависимости проекта (package.json)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
