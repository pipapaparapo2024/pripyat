/**
 * Test: 26.09.2026 (по прямому указанию) —
 *
 * Раздел "Хапуга" (game/hapuga.js) полностью выключен на сервере
 * (server/core/controllers/hapuga.php: private $BETA_LOCKED = true; buy() безусловно
 * возвращает fail(56)). Кнопка входа в раздел убрана из HUD целиком
 * (interface-panels.js._buildPngSidePanels, 21.09.2026).
 *
 * Проблема: window.hapuga (game/hapuga.js) всё равно создаётся при загрузке игры
 * (module_control.js.constructHapuga()), и его методы покупки/обновления ассортимента
 * можно вызвать напрямую из консоли браузера в обход отсутствующей кнопки. Оба метода
 * делали ЛОКАЛЬНЫЕ, оптимистичные изменения udata (списание/начисление coins/stew/
 * cigarettes/energy/health, инкремент window.habar.containers[].count) ДО вызова
 * сервера (или вообще без вызова сервера, как в _refreshShop()) — без отката при
 * отказе. Сервер buy() гарантированно отклоняет вызов, но локально списанная/
 * начисленная валюта уже могла долететь до сервера через обычный автосейв (см.
 * users.save whitelist для coins/stew/cigarettes/energy).
 *
 * Фикс: _buy(idx) и _refreshShop() теперь сразу выходят через notify.showResult(...)
 * + return — той же схемой раннего return, что и Battlepass.addXp() (game/battlepass.js,
 * см. tests/achievements-v2-and-battlepass-off.test.js) — и НЕ доходят ни до одной
 * записи в udata. Старое тело методов оставлено ниже return как мёртвый код (как и в
 * addXp()) — это сознательно, чтобы не переписывать логику целиком и не ломать другие
 * статические тесты, которые регексами проверяют её текст (например coins_spent в
 * achievements-v2-and-battlepass-off.test.js).
 *
 * Run: node tests/hapuga-client-side-buy-refresh-lockout.test.js
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

const hapugaSrc     = readSrc('_client/src/game/hapuga.js');
const hapugaPhpSrc  = readSrc('server/core/controllers/hapuga.php');
const panelsSrc     = readSrc('_client/src/game/interface/interface-panels.js');
const moduleCtrlSrc = readSrc('_client/src/modules/module_control.js');

// Границы методов — по сигнатурам, а не по фиксированным номерам строк (устойчиво к
// мелким правкам выше по файлу).
const buyStart      = hapugaSrc.indexOf('_buy(idx){');
const refreshStart  = hapugaSrc.indexOf('_refreshShop(){');
const timerStart    = hapugaSrc.indexOf('_startTimer(){');

assert(buyStart !== -1, '_buy(idx){ найден в hapuga.js');
assert(refreshStart !== -1, '_refreshShop(){ найден в hapuga.js');
assert(timerStart !== -1, '_startTimer(){ найден в hapuga.js (граница конца _refreshShop)');
assert(buyStart < refreshStart && refreshStart < timerStart, 'порядок методов в файле как ожидается (_buy → _refreshShop → _startTimer)');

const buyBody     = hapugaSrc.slice(buyStart, refreshStart);
const refreshBody = hapugaSrc.slice(refreshStart, timerStart);

console.log('\nTest 1: window.hapuga по-прежнему создаётся (класс целиком не выключен)');
{
    assert(/window\.hapuga = new Hapuga\(/.test(moduleCtrlSrc), 'module_control.js.constructHapuga() продолжает создавать window.hapuga');
    assert(/export default class Hapuga\{/.test(hapugaSrc), 'game/hapuga.js экспортирует класс Hapuga без изменений сигнатуры');
}

console.log('\nTest 2: сервер hapuga.php остался заблокирован (не трогали по ТЗ)');
{
    assert(/private \$BETA_LOCKED = true;/.test(hapugaPhpSrc), 'BETA_LOCKED всё ещё true в server/core/controllers/hapuga.php');
    assert(/if\(\$this->BETA_LOCKED\) return \$this->ops->fail\(56\);/.test(hapugaPhpSrc), 'buy() всё ещё отклоняет любой вызов кодом 56 первой строкой');
}

console.log('\nTest 3: кнопка входа в раздел по-прежнему убрана из HUD (не восстанавливали)');
{
    assert(/Левая панель \(скряга\/бот\/пропуск\) убрана целиком/.test(panelsSrc), 'комментарий про убранную левую панель на месте — кнопка не возвращена');
}

console.log('\nTest 4: _buy(idx) — гарантированный ранний return ДО любой записи в udata');
{
    assert(/notify\.showResult\(\{text:'Раздел "Хапуга" пока недоступен'\}, 0\);\s*\n\s*return;/.test(buyBody),
        '_buy(): notify.showResult(...) + безусловный return присутствуют');

    const guardIdx = buyBody.search(/notify\.showResult\(\{text:'Раздел "Хапуга" пока недоступен'\}, 0\);/);
    assert(guardIdx !== -1, '_buy(): найден индекс защитного notify-вызова');

    // Любая запись в udata валюты/эффекта должна физически находиться ПОСЛЕ guard —
    // то есть является недостижимым мёртвым кодом, а не реально исполняемой веткой.
    const currencyWrites = [
        `udata['coins'] = coins - salePrice;`,
        `udata['coins']      = parseInt(udata['coins']||0)      + it.amount; break;`,
        `udata['stew']        = parseInt(udata['stew']||0)        + it.amount; break;`,
        `udata['cigarettes']  = parseInt(udata['cigarettes']||0)  + it.amount; break;`,
        `udata['energy']      = parseInt(udata['energy']||0)      + it.amount; break;`,
        `udata['health']      = Math.min(100, parseInt(udata['health']||100)  + it.amount); break;`,
        `window.habar.containers[it.amount === 2 ? 2 : 1].count++;`,
        `udata['max_energy'] = parseInt(udata['max_energy']||50) + it.amount;`,
    ];
    for(const snippet of currencyWrites){
        const idx = buyBody.indexOf(snippet);
        assert(idx !== -1, `_buy(): фрагмент найден в исходнике — "${snippet.slice(0, 40)}..."`);
        assert(idx === -1 || idx > guardIdx, `_buy(): запись "${snippet.slice(0, 40)}..." находится ПОСЛЕ безусловного return (недостижима)`);
    }

    // Между открывающей скобкой метода и guard-ом не должно быть НИЧЕГО, кроме комментариев —
    // никакого if/условия, которое могло бы обойти защиту.
    const beforeGuard = buyBody.slice('_buy(idx){'.length, guardIdx);
    const codeLines = beforeGuard.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('//'));
    assert(codeLines.length === 0, '_buy(): между началом метода и guard-ом нет исполняемого кода (только комментарии/пустые строки) — return безусловен');

    assert(/26\.09\.2026/.test(buyBody), '_buy(): комментарий датирован 26.09.2026');
    assert(/BETA_LOCKED/.test(buyBody), '_buy(): комментарий ссылается на BETA_LOCKED (причина блокировки)');
}

console.log('\nTest 5: _refreshShop() — гарантированный ранний return ДО списания сигарет');
{
    assert(/notify\.showResult\(\{text:'Раздел "Хапуга" пока недоступен'\}, 0\);\s*\n\s*return;/.test(refreshBody),
        '_refreshShop(): notify.showResult(...) + безусловный return присутствуют');

    const guardIdx = refreshBody.search(/notify\.showResult\(\{text:'Раздел "Хапуга" пока недоступен'\}, 0\);/);
    assert(guardIdx !== -1, '_refreshShop(): найден индекс защитного notify-вызова');

    const cigWriteIdx = refreshBody.indexOf(`udata['cigarettes'] = cigs - cost;`);
    assert(cigWriteIdx !== -1, '_refreshShop(): старая запись списания сигарет всё ещё присутствует в исходнике (как мёртвый код)');
    assert(cigWriteIdx > guardIdx, '_refreshShop(): списание udata[\'cigarettes\'] находится ПОСЛЕ безусловного return (недостижимо)');

    const beforeGuard = refreshBody.slice('_refreshShop(){'.length, guardIdx);
    const codeLines = beforeGuard.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('//'));
    assert(codeLines.length === 0, '_refreshShop(): между началом метода и guard-ом нет исполняемого кода — return безусловен');

    assert(/26\.09\.2026/.test(refreshBody), '_refreshShop(): комментарий датирован 26.09.2026');
}

console.log('\nTest 6: другие методы Hapuga (генерация/рендер/таймер/save-load) не тронуты — блокировка точечная');
{
    // _generateShop/_render/_saveToUdata/_loadFromUdata/scheduleGone/open/close должны
    // остаться рабочими как раньше — они не пишут валюту, только служебные hapuga_* поля.
    for(const fn of ['_generateShop(){', '_render(){', '_saveToUdata(){', '_loadFromUdata(){', 'scheduleGone(hours){', 'open(){', 'close(){']){
        assert(hapugaSrc.includes(fn), `метод ${fn} присутствует и не переименован`);
    }
    // Ни один из них не должен получить свой собственный guard-return "Хапуга пока недоступен" —
    // блокировка должна быть только в _buy/_refreshShop, а не размазана по всему классу.
    const guardCount = (hapugaSrc.match(/Раздел "Хапуга" пока недоступен/g) || []).length;
    assert(guardCount === 2, 'ровно 2 вхождения guard-текста во всём файле (по одному на _buy и _refreshShop), нет лишних/недостающих');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
