/**
 * Test: 20.10.2026, по прямому указанию ("почему тогда в фотошопе этот шрифт ровный?") —
 * репорт "буквы/цифры разного размера" в попапе покупки валюты (interface-currency-purchase.js)
 * повторился ДАЖЕ после двух системных фиксов (PIXI.settings.RESOLUTION синхронизация 17-19.10,
 * document.fonts.ready гонка 20.10). Пользователь сверил тот же шрифт в Photoshop — там буквы
 * ровные, что опровергает прежний вывод "это особенность дизайна шрифта" (ответ того же дня
 * был ошибочным) и подтверждает рендер-артефакт: PIXI.Text печёт canvas-текстуру по общему
 * PIXI.settings.RESOLUTION, а GPU растягивает её под фактический renderer.resolution — при
 * малейшем несовпадении антиалиасинг разных по форме глифов (круглые О/С vs угловатые Г/Л)
 * округляется к пикселям неодинаково, и после растяжения это выглядит как "буквы разного
 * размера".
 *
 * Фикс — не полагаться на общий PIXI.settings.RESOLUTION, а задать ФИКСИРОВАННУЮ высокую
 * плотность растеризации (.resolution = 4) прямо на объектах countTxt/priceTxt/titleTxt —
 * стандартный приём PixiJS для мелкого текста, независимый от текущего масштаба экрана.
 *
 * Run: node tests/currency-purchase-text-fixed-resolution-fix.test.js
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

console.log('\nTest 1: countTxt/priceTxt/titleTxt получают фиксированную высокую плотность растеризации');
{
    const countIdx = src.indexOf('const countTxt = new PIXI.Text(');
    const countBlock = src.slice(countIdx, src.indexOf('gridCont.addChild(countTxt);', countIdx));
    assert(/countTxt\.resolution = 4;/.test(countBlock), 'countTxt.resolution = 4 задан сразу после создания');

    const priceIdx = src.indexOf('const priceTxt = new PIXI.Text(');
    const priceBlock = src.slice(priceIdx, src.indexOf('gridCont.addChild(priceTxt);', priceIdx));
    assert(/priceTxt\.resolution = 4;/.test(priceBlock), 'priceTxt.resolution = 4 задан сразу после создания');

    const titleIdx = src.indexOf("const titleTxt = new PIXI.Text('', TXT_STYLE_TITLE);");
    const titleBlock = src.slice(titleIdx, src.indexOf('win.addChild(titleTxt);', titleIdx));
    assert(/titleTxt\.resolution = 4;/.test(titleBlock), 'titleTxt.resolution = 4 задан сразу после создания');
}

console.log('\nTest 2: ни один из трёх текстов по-прежнему не использует .scale.set()/width/height (анти-паттерн пикселизации)');
{
    // Регресс-гвард: явная плотность НЕ должна комбинироваться со scale-манипуляцией —
    // это два разных, несовместимых способа "укрупнить" текст (см. established правило проекта
    // 08.10.2026, tests/no-text-fontsize-scale-pixelation.test.js).
    const block = src.slice(src.indexOf('const countTxt = new PIXI.Text('), src.indexOf('win.addChild(titleTxt);') + 30);
    assert(!/countTxt\.scale\.set|priceTxt\.scale\.set|titleTxt\.scale\.set/.test(block),
        'countTxt/priceTxt/titleTxt не используют .scale.set() (не конфликтует с no-text-fontsize-scale-pixelation.test.js)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
