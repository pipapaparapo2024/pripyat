/**
 * Test: 26.09.2026 (по прямому указанию) — Gangs._donate() тратил валюту клиента без отката.
 *
 * Раздел "Банды" полностью выключен на сервере (server/core/controllers/gangs.php —
 * private $BETA_LOCKED = true; join()/donate() безусловно возвращают ошибку 56), а кнопка
 * "Банда" в HUD (interface-panels.js) визуально погашена (interactive=false, alpha=0.45,
 * плашка "СКОРО", см. tests/hud-remove-left-panel-and-gang-soon-badge.test.js).
 *
 * НО класс Gangs (game/gangs.js) всё равно создаётся при загрузке игры (window.gangs, см.
 * modules/module_control.js), и его метод _donate() был доступен из консоли браузера в обход
 * спрятанной кнопки. _donate() СНАЧАЛА локально вычитал валюту из udata['coins']/udata['stew']
 * (оптимистичное обновление UI), ПОТОМ звал server gangs.donate — который гарантированно
 * отклоняет вызов (BETA_LOCKED). Отката вычтенной валюты при отказе сервера не было — то есть
 * прямой вызов window.gangs._donate(idx) из консоли списывал реальные деньги игрока без
 * какого-либо результата.
 *
 * Раздел всё равно мёртвый, поэтому чинить откат избыточно — просто заблокирована сама трата:
 * _donate() теперь сразу выходит через notify.showResult(...) + return, НЕ трогая udata вообще
 * (по аналогии с battlepass.js.addXp() — тот же паттерн раннего return для отключённой фичи).
 *
 * bot.js._tick() (авто-взнос в банду, settings[5]) тоже вызывает _donate() — после фикса он
 * просто больше не спишет валюту (получит "недоступно" вместо реального доната), это не баг,
 * а желаемое поведение для мёртвой фичи.
 *
 * Run: node tests/gangs-donate-client-side-block.test.js
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

const gangsJs = readSrc('_client/src/game/gangs.js');
const botJs   = readSrc('_client/src/game/bot.js');
const gangsPhp = readSrc('server/core/controllers/gangs.php');

console.log('\nTest 1: _donate() блокирована ранним return ДО любой записи в udata coins/stew');
{
    const start = gangsJs.indexOf('\t_donate(idx){');
    assert(start !== -1, 'метод _donate(idx) найден в gangs.js');
    const end = gangsJs.indexOf('\n\t_saveToUdata(){', start);
    const body = gangsJs.slice(start, end);

    const returnIdx = body.indexOf('return;');
    assert(returnIdx !== -1, 'внутри _donate() есть безусловный return');

    // Все места, где _donate() физически пишет в udata['coins'] / udata['stew'] (списание),
    // должны находиться ПОСЛЕ первого return в теле метода.
    const writeCoins = body.indexOf("udata['coins']  = parseInt");
    const writeStew  = body.indexOf("udata['stew']       = parseInt");
    assert(writeCoins !== -1 && writeStew !== -1, 'sanity: старый код списания coins/stew всё ещё физически присутствует в файле (return выше него, а не удалён сам код)');
    assert(returnIdx < writeCoins, 'return стоит РАНЬШЕ записи udata[\'coins\'] — списание монет недостижимо');
    assert(returnIdx < writeStew,  'return стоит РАНЬШЕ записи udata[\'stew\'] — списание тушёнки недостижимо');
}

console.log('\nTest 2: перед return есть понятное уведомление игроку, без побочных эффектов на udata');
{
    const start = gangsJs.indexOf('\t_donate(idx){');
    const end   = gangsJs.indexOf('\n\t_saveToUdata(){', start);
    const body  = gangsJs.slice(start, end);
    const returnIdx = body.indexOf('return;');
    const before = body.slice(0, returnIdx);

    assert(/notify\.showResult\(\{text:'[^']*Банд[^']*недоступен'\},\s*0\);/.test(before),
        'перед return вызывается notify.showResult с сообщением о недоступности раздела');
    // 27.09.2026 (плановая чистка тестов): проверка ловила ложный срабатывание — комментарий
    // 26.09.2026 над этим же return ОПИСЫВАЕТ баг и упоминает "udata['coins']/udata['stew']"
    // как текст документации, не как код. Убираем строки-комментарии (//...) перед проверкой,
    // чтобы проверять реальный исполняемый код, а не пояснение к нему.
    const beforeCode = before.replace(/^\s*\/\/.*$/gm, '');
    assert(!/udata\[/.test(beforeCode), 'до return нет ни одного обращения к udata в исполняемом коде — трата не начинается вообще');
}

console.log('\nTest 3: комментарий с датой и объяснением бага/фикса присутствует рядом с _donate()');
{
    assert(/26\.09\.2026/.test(gangsJs), 'дата 26.09.2026 указана в комментарии');
    assert(/BETA_LOCKED/.test(gangsJs), 'комментарий ссылается на BETA_LOCKED (причину блокировки на сервере)');
    assert(/без отката/.test(gangsJs), 'комментарий объясняет отсутствие отката при отказе сервера');
}

console.log('\nTest 4: window.gangs (класс Gangs целиком) не тронут — экспорт класса и другие методы остаются');
{
    assert(/export default class Gangs\{/.test(gangsJs), 'класс Gangs всё ещё экспортируется как есть');
    assert(/_toggleJoin\(idx\)\{/.test(gangsJs), '_toggleJoin() не удалён (не входит в задачу — не тратит coins/stew напрямую)');
    assert(/static getBonus\(key\)\{/.test(gangsJs), 'Gangs.getBonus() не удалён (используется bosses.js и др.)');
}

console.log('\nTest 5: server/core/controllers/gangs.php не тронут — остаётся BETA_LOCKED (эта задача — только клиент)');
{
    assert(/private \$BETA_LOCKED = true;/.test(gangsPhp), 'BETA_LOCKED всё ещё true на сервере (не менялось)');
}

console.log('\nTest 6: sanity — bot.js всё ещё вызывает g._donate(...), но теперь это безопасно (метод сам блокирует трату)');
{
    assert(/g\._donate\(g\.myGangId\)/.test(botJs), 'bot.js (авто-взнос в банду) по-прежнему вызывает _donate() — единственный легитимный клиентский caller кроме кнопки, и после фикса он больше не тратит валюту зря');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
