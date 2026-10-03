/**
 * Test: батч 25.09.2026 (по прямому указанию — "они не копируются, исправь и добавь ещё
 * название файла") — редактор позиций, кнопка «📋 КОПИРОВАТЬ x/y».
 *
 * Корень бага «не копируется»: navigator.clipboard.writeText() — async Clipboard API,
 * подчиняется Permissions Policy iframe, в котором открыт VK Mini App. Без разрешения
 * "clipboard-write" у этого iframe navigator.clipboard может отсутствовать вовсе (весь
 * старый код внутри `if(navigator.clipboard && ...)` тогда молча не выполнялся, даже
 * console.error не печатался) или промис реджектится без видимой пользователю реакции
 * (только notify при УСПЕХЕ, ничего при провале).
 *
 * Фикс: синхронный fallback через document.execCommand('copy') (скрытый textarea), не
 * зависящий от той же Permissions Policy; плюс имя файла текстуры (человекочитаемое —
 * decodeURIComponent, файлы с кириллицей иначе показывались как %D0%B3%D0%B0...) добавлено
 * и в копируемый текст, и в читаемую панель на экране.
 *
 * Run: node tests/pos-editor-copy-clipboard-fallback-and-filename.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8');

console.log('\nTest 1: общий хелпер _uFileLabel — декодирует URL-кодированное имя файла (кириллица человекочитаема)');
{
    const s = src.indexOf('proto._uFileLabel = function(s){');
    const e = src.indexOf('\n    };', s);
    assert(s !== -1, '_uFileLabel определён');
    const body = src.slice(s, e);
    assert(/decodeURIComponent\(raw\)/.test(body), 'декодирует сырую URL-строку имени файла');
    assert(/catch\(e\)\{ return raw; \}/.test(body), 'если decode кидает (битый escape) — возвращает хотя бы сырую строку, не падает');
}

console.log('\nTest 2: читаемая панель (_uUpdateReadout) использует общий _uFileLabel — имя файла тоже декодировано на экране');
{
    const s = src.indexOf('proto._uUpdateReadout = function(extra){');
    const e = src.indexOf('\n    };', src.indexOf('this._uReadout.text = \'Выбрано:', s));
    const body = src.slice(s, e);
    assert(/label = this\._uFileLabel\(s\) \|\| '\(без текстуры\)';/.test(body),
        'label теперь берётся через decodeURIComponent-хелпер, не сырой url.split');
    assert(!/label = url \? url\.split\('\/'\)\.pop\(\) : '\(без текстуры\)';/.test(body),
        'старый недекодированный способ убран');
}

console.log('\nTest 3: _uCopySelected — имя файла идёт первым в копируемом тексте (кроме текст-боксов)');
{
    const s = src.indexOf('proto._uCopySelected = function(){');
    const e = src.indexOf('\n    };', s);
    const body = src.slice(s, e);
    assert(/const fileLabel = s\._uIsTextBox \? null : this\._uFileLabel\(s\);/.test(body), 'имя файла читается через общий хелпер');
    assert(/filePrefix \+ 'x: ' \+ Math\.round\(s\.x\)/.test(body), 'обычные объекты: имя файла добавлено ПЕРЕД x/y/scale');
    assert(/\? '\{x: ' \+ Math\.round\(s\.x\) \+ ', y: ' \+ Math\.round\(s\.y\) \+ ', w: ' \+ Math\.round\(s\.width\) \+ ', h: ' \+ Math\.round\(s\.height\) \+ '\}'/.test(body),
        'текст-бокс — формат {x,y,w,h} не тронут (у него нет имени файла)');
}

console.log('\nTest 4: _uCopySelected — пробует Clipboard API, при провале/отсутствии — синхронный execCommand-fallback');
{
    const s = src.indexOf('proto._uCopySelected = function(){');
    const e = src.indexOf('\n    };', s);
    const body = src.slice(s, e);
    assert(/if\(navigator\.clipboard && navigator\.clipboard\.writeText\)\{/.test(body), 'сначала пробует async Clipboard API, если он вообще есть');
    assert(/_report\(this\._uTryFallbackCopy\(text\)\);/.test(body), 'и при отказе Promise, и при полном отсутствии navigator.clipboard — вызывает fallback');
    assert(/this\._uUpdateReadout\('Скопировано \(или см\. текст ниже/.test(body),
        'КРИТИЧНО: текст ВСЕГДА показывается на читаемой панели — работает, даже если оба способа копирования недоступны');
}

console.log('\nTest 5: _uTryFallbackCopy — скрытый textarea + execCommand(\'copy\'), не зависит от Clipboard API/Permissions Policy');
{
    const s = src.indexOf("proto._uTryFallbackCopy = function(text){");
    const e = src.indexOf('\n    };', s);
    assert(s !== -1, '_uTryFallbackCopy определён');
    const body = src.slice(s, e);
    assert(/document\.createElement\('textarea'\)/.test(body), 'создаёт временный textarea');
    assert(/ta\.style\.position = 'fixed';/.test(body) && /ta\.style\.top = '-9999px';/.test(body),
        'textarea визуально скрыт за пределами экрана (не мелькает на экране игры)');
    assert(/ta\.select\(\);/.test(body), 'выделяет текст перед копированием');
    assert(/document\.execCommand\('copy'\)/.test(body), 'КРИТИЧНО: использует execCommand(\'copy\') — работает независимо от async Clipboard API/Permissions Policy iframe');
    assert(/document\.body\.removeChild\(ta\);/.test(body), 'убирает временный textarea за собой после копирования');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
