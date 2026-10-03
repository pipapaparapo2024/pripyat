/**
 * Test: батч 25.09.2026 (по прямому указанию) — dev-панель, кнопка "Тексты ошибок / ПОКАЗАТЬ"
 * открывает поп-ап с код+текст каждой записи server/json/errors.json, ◀/▶ листают список по
 * кругу.
 *
 * DEV_ERROR_CATALOG в dev_panel.js — зеркало errors.json (тот же приём, что у зеркала дроп-пула
 * шмоток в bosses_prefight.js) — сервер остаётся источником истины, зеркало только для офлайн-
 * просмотра текстов в dev-инструменте без реального провоцирования каждой ошибки.
 *
 * Run: node tests/dev-panel-error-browser.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const devSrc = read('_client/src/game/shell/overlays/dev_panel.js');
const errorsJson = JSON.parse(read('server/json/errors.json'));

console.log('\n1) DEV_ERROR_CATALOG — точное зеркало server/json/errors.json (тот же набор code/text)');
{
    const m = devSrc.match(/const DEV_ERROR_CATALOG = \[([\s\S]*?)\n\];/);
    assert(!!m, 'DEV_ERROR_CATALOG определён на уровне модуля');
    // Извлекаем {code:N, text:'...'} пары через безопасный eval в изолированной функции
    // (проще и надёжнее регулярки на 24 записи с кавычками/спецсимволами внутри текста).
    const arr = new Function('return [' + m[1] + ']')();
    assert(Array.isArray(arr) && arr.length === errorsJson.length,
        'длина совпадает с errors.json (' + errorsJson.length + '), получили: ' + (arr && arr.length));
    const mismatches = [];
    errorsJson.forEach(e => {
        const mirrored = arr.find(x => x.code === e.code);
        if(!mirrored || mirrored.text !== e.text) mismatches.push(e.code);
    });
    assert(mismatches.length === 0, 'все code/text совпадают с errors.json — расхождения в кодах: ' + mismatches.join(','));
}

console.log('\n2) Кнопка "Тексты ошибок / ПОКАЗАТЬ" добавлена в секцию "ТЕСТ UI"');
{
    const sectionIdx = devSrc.indexOf("_section('ТЕСТ UI');");
    const nextSectionIdx = devSrc.indexOf("_section('", sectionIdx + 1);
    const sectionBody = devSrc.slice(sectionIdx, nextSectionIdx);
    assert(/_row\('Тексты ошибок', \[\s*\{label:'ПОКАЗАТЬ', color:T, action:\(\)=>this\._openErrorBrowser\(\)\},\s*\]\);/.test(sectionBody),
        'строка "Тексты ошибок" с кнопкой ПОКАЗАТЬ, вызывающей _openErrorBrowser()');
}

console.log('\n3) _openErrorBrowser() — попап добавлен ВНУТРЬ this._devWin (не отдельным addChild в layer2_mc)');
{
    const start = devSrc.indexOf('proto._openErrorBrowser = function(){');
    const end   = devSrc.indexOf('\n    };', start);
    const body  = devSrc.slice(start, end);
    assert(start !== -1, '_openErrorBrowser определён');
    assert(/this\._devWin\.addChild\(win\);/.test(body),
        'popup — child самой панели (иначе тикер _devWinTickerFn переподнял бы devWin поверх попапа на следующем кадре)');
    assert(/this\._errBrowserWin = win;/.test(body), 'ссылка сохранена для повторного открытия без пересоздания');
}

console.log('\n4) ◀/▶ листают DEV_ERROR_CATALOG ПО КРУГУ (модуль % length — без тупиков на краях списка)');
{
    const start = devSrc.indexOf('proto._openErrorBrowser = function(){');
    const end   = devSrc.indexOf('\n    };', start);
    const body  = devSrc.slice(start, end);
    assert(/idx = \(idx - 1 \+ DEV_ERROR_CATALOG\.length\) % DEV_ERROR_CATALOG\.length;/.test(body),
        '◀ с первой записи переходит на последнюю (циклично)');
    assert(/idx = \(idx \+ 1\) % DEV_ERROR_CATALOG\.length;/.test(body),
        '▶ с последней записи переходит на первую (циклично)');
}

console.log('\n5) _buildDevPanel() сбрасывает this._errBrowserWin — панель пересоздаётся при каждом открытии, старая ссылка не должна ложно считаться "уже открытой"');
{
    const start = devSrc.indexOf('proto._buildDevPanel = function(){');
    const chunk = devSrc.slice(start, start + 600);
    assert(/this\._errBrowserWin = null;/.test(chunk),
        '_errBrowserWin обнуляется в начале _buildDevPanel() — иначе после переоткрытия панели popup молча не появлялся бы (ранний return на orphaned-ссылке)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
