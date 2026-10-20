/**
 * Test: батч 20.10.2026 (третья часть дня, по прямому указанию) —
 *
 *  1) interface.js: заливка шкалы энергии верхнего ХУДа (nrg_bar_fill) опущена вниз на 5px.
 *  2) onboarding-data.js: обучение вкладки "Сидорович" — рука + пульсация сдвинуты влево на 80px.
 *  3) interface-currency-purchase.js: репорт "буквы/цифры разного размера" на картах валюты
 *     ПОВТОРИЛСЯ даже после фикса padding:6 (добавлен тем же днём ранее) — значит дело не в
 *     обрезке canvas-текстуры. Новая гипотеза: гонка загрузки шрифта (PIXI печёт текст сразу
 *     по запросу, не дожидаясь реальной готовности @font-face "Southbank LT" — нигде в проекте
 *     не было document.fonts.ready/check() перед печатью текста этим шрифтом; незавершённая
 *     загрузка молча подставляет системный fallback для всей строки, что и выглядит как
 *     "некоторые буквы крупнее других"). Добавлен guard: попап валюты не строится, пока шрифт
 *     не готов (document.fonts.ready), тогда ждёт и открывает попап повторно.
 *     ВАЖНО: это теория, не подтверждённая визуально (ПРАВИЛО №6 запрещает самостоятельно
 *     открывать игру в браузере) — требует проверки пользователем вживую.
 *
 * Run: node tests/oct20-batch3-energy-bar-shift-onboarding-sidorovich-font-race-guard.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const ifaceSrc     = readSrc('_client/src/game/interface.js');
const onboardSrc   = readSrc('_client/src/game/onboarding/onboarding-data.js');
const purchaseSrc  = readSrc('_client/src/game/interface/interface-currency-purchase.js');

console.log('\nTest 1: interface.js — заливка шкалы энергии опущена вниз на 5px');
{
    // 20.10.2026 (по прямому указанию, редактор позиций — "x:495,y:42"): было 495,49.
    assert(/this\.nrg_bar_fill\.x = 495; this\.nrg_bar_fill\.y = 42;/.test(ifaceSrc),
        'nrg_bar_fill.y 49→42 (редактор позиций 20.10.2026)');
}

console.log('\nTest 2: onboarding-data.js — шаг "Сидорович" сдвинут влево на 80px');
{
    const start = onboardSrc.indexOf("key: 'sidorovich'");
    const end   = onboardSrc.indexOf('\n    },', start);
    const body  = onboardSrc.slice(start, end);
    assert(/target: \{ x: 104, y: 632 \}/.test(body), 'target.x 184→104 (-80px)');
    assert(/hand: \{ x: 146, y: 671, scale: 1\.000, rot: -143 \}/.test(body), 'hand.x 226→146 (-80px)');
}

console.log('\nTest 3: interface-currency-purchase.js — guard на готовность шрифта перед построением попапа');
{
    const start = purchaseSrc.indexOf('proto._openCurrencyPurchasePopup = function(tab){');
    const end   = purchaseSrc.indexOf('\n    };', start);
    const body  = purchaseSrc.slice(start, end);
    assert(/document\.fonts\.check\("18px 'Southbank LT'"\)/.test(body), 'проверяет готовность шрифта через document.fonts.check()');
    assert(/document\.fonts\.ready\.then\(\(\) => \{/.test(body), 'ждёт document.fonts.ready, если шрифт ещё не готов');
    assert(/this\._openCurrencyPurchasePopup\(tab\);/.test(body), 'после готовности шрифта вызывает себя повторно с теми же аргументами');
    assert(/return;/.test(body.slice(0, body.indexOf('const startKey'))), 'при незавершённой загрузке шрифта функция выходит ДО построения попапа (return до startKey)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
