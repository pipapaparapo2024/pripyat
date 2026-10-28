/**
 * Test: 28.10.2026, баг найден по прямому указанию — "Собрано коллекций пишется не теми
 * шрифтами" (Заначки), затем расширено на Разнарядку (тот же класс гонки, те же кастомные
 * семейства). Корень — тот же, что уже чинился 20-28.10.2026 в interface-currency-purchase.js и
 * game2048-top-popup.js: PIXI печёт canvas текста СРАЗУ по запросу, не дожидаясь реальной
 * загрузки @font-face (см. ПРАВИЛО №11 в AGENTS.md) — если экран строится раньше, чем шрифт
 * готов, текст НАВСЕГДА остаётся на системном fallback-шрифте.
 *
 * Прежние фиксы откладывали СБОРКУ ВСЕГО экрана до document.fonts.ready — не подходит для
 * svod.js._ensurePanel() (обязана вернуть панель СИНХРОННО, см. docblock в modules/font-ready.js)
 * — новый общий модуль вместо этого строит текст сразу и форсирует редрав (dirty=true) уже
 * построенных объектов после document.fonts.ready, если шрифт на момент сборки был не готов.
 *
 * Run: node tests/font-ready-redraw-race-fix.test.js
 */
const fs = require('fs'), vm = require('vm'), path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const fontReadySrc = readSrc('_client/src/modules/font-ready.js')
    .replace('export function scheduleFontRedraw', 'function scheduleFontRedraw');
const zanachkiSrc = readSrc('_client/src/game/svod/svod-zanachki.js');
const raznaryadkaSrc = readSrc('_client/src/game/shell/overlays/raznaryadka.js');

function loadModule(ctxExtra){
    const ctx = Object.assign({ console: { log(){}, error(){} } }, ctxExtra);
    vm.createContext(ctx);
    vm.runInContext(fontReadySrc + '\nthis.scheduleFontRedraw = scheduleFontRedraw;', ctx);
    return ctx;
}

async function run(){

console.log('\nTest 1: modules/font-ready.js — шрифт уже загружен (document.fonts.check=true) — текст не трогается, document.fonts.ready не запрашивается');
{
    let readyAccessed = false;
    const ctx = loadModule({ document: { fonts: { check: () => true, get ready(){ readyAccessed = true; return Promise.resolve(); } } } });
    const texts = [{ dirty: false, destroyed: false }];
    ctx.scheduleFontRedraw("16px 'X'", texts);
    assert(texts[0].dirty === false, 'текст не помечен dirty — шрифт и так уже готов, редрав не нужен');
    assert(readyAccessed === false, 'document.fonts.ready не запрашивается на уже-готовом пути (no-op экономит, не подписывается впустую)');
}

console.log('\nTest 2: modules/font-ready.js — шрифт ещё НЕ загружен — после document.fonts.ready ВСЕ переданные тексты помечаются dirty=true');
{
    const ctx = loadModule({ document: { fonts: { check: () => false, ready: Promise.resolve() } } });
    const texts = [{ dirty: false, destroyed: false }, { dirty: false, destroyed: false }];
    ctx.scheduleFontRedraw("16px 'X'", texts);
    assert(texts.every(t => t.dirty === false), 'сразу после вызова (до резолва Promise) тексты ещё НЕ тронуты — редрав асинхронный, не блокирует сборку экрана');
    await ctx.document.fonts.ready;
    await new Promise(r => setImmediate(r));
    assert(texts.every(t => t.dirty === true), 'после реального document.fonts.ready все переданные тексты помечены dirty=true (форсирует PIXI перерисовать canvas настоящим шрифтом)');
}

console.log('\nTest 3: modules/font-ready.js — уничтоженные (destroyed) объекты пропускаются, не трогаются после закрытия экрана');
{
    const ctx = loadModule({ document: { fonts: { check: () => false, ready: Promise.resolve() } } });
    const liveTxt = { dirty: false, destroyed: false };
    const deadTxt = { dirty: false, destroyed: true };
    ctx.scheduleFontRedraw("16px 'X'", [liveTxt, deadTxt]);
    await ctx.document.fonts.ready;
    await new Promise(r => setImmediate(r));
    assert(liveTxt.dirty === true, 'живой текстовый объект помечен dirty');
    assert(deadTxt.dirty === false, 'уничтоженный (destroyed=true) объект НЕ трогается — защита от правки PIXI.Text после его уничтожения');
}

console.log('\nTest 4: modules/font-ready.js — окружение без Font Loading API (document.fonts не существует) — безопасный no-op, исключение не бросается');
{
    const ctx = loadModule({ document: {} });
    let threw = false;
    try { ctx.scheduleFontRedraw("16px 'X'", [{ dirty: false, destroyed: false }]); } catch(e){ threw = true; }
    assert(threw === false, 'отсутствие document.fonts (например SSR/старый браузер) не ломает сборку экрана — тихий no-op');
}

console.log('\nTest 5: svod-zanachki.js — все 6 текстовых объектов с fontFamily:FONT собраны в fontTexts и переданы в scheduleFontRedraw');
{
    assert(zanachkiSrc.includes("import { scheduleFontRedraw } from '../../modules/font-ready.js';"), 'модуль импортирован');
    const buildStart = zanachkiSrc.indexOf('proto._buildZanachkiPanel = function(){');
    const buildEnd = zanachkiSrc.indexOf('\n    proto._zanachkiFetchState', buildStart);
    const buildBody = zanachkiSrc.slice(buildStart, buildEnd);
    const pushCount = (buildBody.match(/fontTexts\.push\(/g) || []).length;
    assert(pushCount === 6, `все 6 FONT-текстов (label/count заголовка, countTxt карточки, rewardLabel/sukhariReward/expReward) добавлены в fontTexts (найдено push: ${pushCount})`);
    assert(/scheduleFontRedraw\("16px '" \+ FONT \+ "'", fontTexts\);/.test(buildBody),
        'scheduleFontRedraw вызывается перед return win, с правильной проверочной строкой шрифта');
    // 28.10.2026 (тест найден сломанным при прогоне — indexOf('scheduleFontRedraw(') ловил
    // подстроку из докблока выше ("см. scheduleFontRedraw() в конце функции."), а не реальный
    // вызов на строке 414. Ищем конкретную сигнатуру вызова, не любое вхождение имени функции.
    assert(buildBody.indexOf('scheduleFontRedraw("16px') > buildBody.lastIndexOf('fontTexts.push('),
        'scheduleFontRedraw вызывается ПОСЛЕ того, как все тексты уже добавлены в fontTexts (иначе часть текстов не попала бы в редрав)');
}

console.log('\nTest 6: raznaryadka.js — _build() собирает тексты по ВСЕМ ТРЁМ кастомным семействам (Book/Pro Bold/Pro Middle) раздельно');
{
    assert(raznaryadkaSrc.includes("import { scheduleFontRedraw } from '../../../modules/font-ready.js';"), 'модуль импортирован');
    const buildStart = raznaryadkaSrc.indexOf('_build(){');
    const buildEnd = raznaryadkaSrc.indexOf('\n    _showFetchFailText', buildStart);
    const buildBody = raznaryadkaSrc.slice(buildStart, buildEnd);
    assert(/fontTextsProBold\.push\(doneHeaderTxt\);/.test(buildBody), 'doneHeaderTxt (Bebas Neue Pro Bold) собран');
    assert(/fontTextsBook\.push\(dateTxt\);/.test(buildBody), 'dateTxt (FONT=Bebas Neue Book) собран');
    assert(/fontTextsBook\.push\(taskTxt\);/.test(buildBody), 'taskTxt (FONT) собран');
    assert(/fontTextsProMiddle\.push\(amtTxt\);/.test(buildBody), 'amtTxt ×5 (Bebas Neue Pro Middle, внутри REWARD_ROWS.forEach) собран');
    assert(/fontTextsBook\.push\(rowTxt1, rowTxt2\);/.test(buildBody), 'rowTxt1/rowTxt2 ×5 каждый (FONT, внутри forEach) собраны');
    assert(/scheduleFontRedraw\("20px '" \+ FONT \+ "'", fontTextsBook\);/.test(buildBody), 'редрав вызван для Book-группы');
    assert(/scheduleFontRedraw\("27px 'Bebas Neue Pro Bold'", fontTextsProBold\);/.test(buildBody), 'редрав вызван для Pro Bold-группы');
    assert(/scheduleFontRedraw\("24px 'Bebas Neue Pro Middle'", fontTextsProMiddle\);/.test(buildBody), 'редрав вызван для Pro Middle-группы');
}

console.log('\nTest 7: raznaryadka.js — _showBuyoutPopup() тоже собирает и перерисовывает свои FONT-тексты (titleTxt/msgTxt/кнопки ПОДТВЕРДИТЬ+ОТМЕНА)');
{
    const popupStart = raznaryadkaSrc.indexOf('_showBuyoutPopup(day, cost){');
    const popupEnd = raznaryadkaSrc.indexOf('\n    _payDay', popupStart);
    const popupBody = raznaryadkaSrc.slice(popupStart, popupEnd);
    assert(/fontTexts\.push\(titleTxt\);/.test(popupBody), 'titleTxt собран');
    assert(/fontTexts\.push\(msgTxt\);/.test(popupBody), 'msgTxt собран');
    assert(/fontTexts\.push\(txt\);/.test(popupBody), 'текст кнопки (внутри mkUniversalBtn, вызывается дважды — ПОДТВЕРДИТЬ/ОТМЕНА) собран');
    assert(/scheduleFontRedraw\("24px '" \+ FONT \+ "'", fontTexts\);/.test(popupBody), 'редрав вызван перед открытием попапа');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

}

run();
