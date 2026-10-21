/**
 * Test: 20.10.2026, по прямому указанию (видео-референс "Хулиганы", проанализировано покадрово
 * через OpenCV — у наведённой кнопки светлеет фон, без роста размера и без прозрачности):
 *
 * 1) ui_kit.js — новый общий hover-хелпер _addHoverBright() (ColorMatrixFilter.brightness(),
 *    тот же pixi-filters, что уже используется в проекте для обесцвечивания шмоток
 *    bosses_prefight.js/shmot_shop.js). interface-top-currency.js — все 8 мест, которые раньше
 *    вызывали _addHoverScale (кнопка магазин/настройки/вниз/плюс×2 + плашки/иконки свапа),
 *    переведены на _addHoverBright.
 *
 * 2) boss_result.js — попап результата боя с боссом показывал иконку пачки сигарет (вшита прямо
 *    в файл фона "боевка попап фон.png", подменить пиксели кодом нельзя) — поверх нее теперь
 *    накладывается спрайт актуальной иконки сухарей ("боевка награда сухари.png", тот же файл,
 *    что уже используется в bosses_prefight.js/dvor.js), добавляется БЕЗУСЛОВНО (не внутри
 *    if(isWin)) — фон с иконками декоративный и виден и на победе, и на поражении.
 *
 * Run: node tests/oct20-batch2-hud-hover-bright-sukhari-boss-result-icon.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const kitSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'ui_kit.js'), 'utf-8');
const topCurSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface', 'interface-top-currency.js'), 'utf-8');
const bossResultSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');

console.log('\nTest 1: ui_kit.js — _addHoverBright определён через ColorMatrixFilter, без scale/alpha');
{
    assert(/proto\._addHoverBright = function/.test(kitSrc), '_addHoverBright определён');
    assert(/new PIXI\.filters\.ColorMatrixFilter\(\)/.test(kitSrc), 'использует ColorMatrixFilter (тот же, что уже в проекте — без новой зависимости)');
    assert(/filter\.brightness\(amount, false\)/.test(kitSrc), 'brightness() вызывается с multiply=false (прямое осветление, не накопление)');
    assert(/btn\.on\('pointerover', \(\)=>\{ btn\.filters = \[filter\]; \}\);/.test(kitSrc), 'pointerover — фильтр включается');
    assert(/btn\.on\('pointerout',  \(\)=>\{ btn\.filters = null; \}\);/.test(kitSrc), 'pointerout — фильтр снимается, без остаточного состояния');
}

console.log('\nTest 2: interface-top-currency.js — 20.10.2026 (ПОЗЖЕ тем же днём, повторный репорт — "хавер-эффект всё ещё виден, пусть небольшой, убери, его не должно быть") — весь hover-эффект widget\'а снят целиком');
{
    // Отменяет Test 2/2b/2c версии от более раннего момента того же дня (brightness hover по
    // видео-референсу "Хулиганы") — пользователь явно попросил убрать эффект полностью, не
    // просто уменьшить его. _addHoverBright/_addHoverBrightGroup как ФУНКЦИИ остаются в
    // ui_kit.js (используются в других местах проекта) — здесь проверяем только то, что
    // interface-top-currency.js больше НИ ОДИН раз их не вызывает.
    assert(!/this\._addHoverBright\(/.test(topCurSrc), 'в файле не осталось вызовов this._addHoverBright(...)');
    assert(!/this\._addHoverBrightGroup\(/.test(topCurSrc), 'в файле не осталось вызовов this._addHoverBrightGroup(...)');
    assert(!/_addHoverScale/.test(topCurSrc), 'в файле нет и старого _addHoverScale (эффекта не должно быть вообще, не только "не растущего")');

    // Кликабельность не должна была пострадать — каждая кнопка/плашка по-прежнему явно
    // интерактивна и обрабатывает pointerdown.
    const targets = ['btnRubPlus', 'platePrimary', 'iconPrimary', 'btnToggle', 'plateSecondary', 'iconSecondary', 'btnSecondaryPlus', 'shopBtn', 'settingsBtn'];
    for (const t of targets) {
        assert(new RegExp(`${t}\\.interactive = true; ${t}\\.buttonMode = true;`).test(topCurSrc), `${t} остаётся interactive/buttonMode`);
    }
}

console.log('\nTest 3: boss_result.js — иконка сухарей поверх вшитой в фон пачки сигарет, показывается БЕЗУСЛОВНО');
{
    assert(/const cigIcon = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'боевка награда сухари\.png'\)\);/.test(bossResultSrc),
        'cigIcon грузит актуальный файл иконки сухарей');
    assert(/win\.addChild\(cigIcon\);/.test(bossResultSrc), 'cigIcon добавлен в win');

    // Структурная проверка: cigIcon должен быть объявлен МЕЖДУ addChild(bg) и объявлением
    // переменной isWin-ветки (let shmotHoverEls), т.е. вне блока if(isWin){...} — используем
    // индексы вхождений строк, а не regex по всему телу if, т.к. блок большой и вложенный.
    const bgIdx      = bossResultSrc.indexOf('win.addChild(bg);');
    const cigIdx     = bossResultSrc.indexOf('const cigIcon = new PIXI.Sprite');
    const cigAddIdx  = bossResultSrc.indexOf('win.addChild(cigIcon);');
    const isWinIdx   = bossResultSrc.indexOf('if(isWin){');
    assert(bgIdx > -1 && bgIdx < cigIdx, 'cigIcon объявлен после фона');
    assert(cigAddIdx > -1 && cigAddIdx < isWinIdx, 'cigIcon добавлен ДО блока if(isWin) — видна и на победе, и на поражении');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
