/**
 * Test: репорт игрока 29.09.2026 — "прокачал бизнес на сигареты на максимум на двух
 * локациях (50 сигарет за сбор на первой, 100 на второй — суммарно должно быть 150), собрал
 * прибыль, получил суммарно только 70".
 *
 * Корень: кнопка "Собрать прибыль" (zone_screen.js) раньше в цикле звала
 * zone.collectLocIncome(i) для ВСЕХ подходящих локаций СРАЗУ, не дожидаясь ответа сервера —
 * до 5 параллельных HTTP-запросов zone.collectIncome ОДНОГО игрока одновременно.
 * Gameops::loadUser()/saveUser() (server/core/models/gameops.php) — обычный SELECT +
 * INSERT...ON DUPLICATE KEY UPDATE, БЕЗ блокировки строки и без атомарного инкремента: два
 * параллельных запроса читают одно и то же старое значение cigarettes, каждый прибавляет
 * свою сумму К НЕМУ и пишет обратно — тот запрос, что сохранился НЕ последним, теряет своё
 * начисление целиком (classic lost update). Тот же класс гонки актуален для
 * fillCheckpoint/captureLocation/upgradeBusiness — все мутируют cigarettes/exp/respect/'zone'
 * по той же схеме read-modify-write.
 *
 * Фикс — оба слоя:
 * 1) Клиент (zone.js/zone_screen.js): сбор локаций теперь последовательный (ждёт onDone
 *    перед следующим запросом) — сама причина гонки с клиента убрана.
 * 2) Сервер (zone.php): именная блокировка (_withUserLock, GET_LOCK/RELEASE_LOCK на отдельном
 *    соединении) вокруг load→mutate→save во всех 4 мутирующих методах Зоны — защита не
 *    зависит только от дисциплины клиента (сетевой ретрай, несколько вкладок и т.п.).
 *
 * Run: node tests/zone-collect-income-lost-update-race-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const zonePhp   = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'zone.php'), 'utf-8');
const zoneJs    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'zone.js'), 'utf-8');
const zoneScreenJs = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'zone_screen.js'), 'utf-8');

function methodBody(src, name){
    const start = src.indexOf('function ' + name + '(){');
    if(start === -1) return null;
    // следующая function на том же уровне отступа (8 пробелов) — граница метода
    const next = src.indexOf('\n        function ', start + 10);
    return src.slice(start, next === -1 ? src.length : next);
}

console.log('\nTest 1: zone.php определяет _withUserLock() с GET_LOCK/RELEASE_LOCK на отдельном соединении');
{
    assert(/private function _withUserLock\(callable \$fn\)/.test(zonePhp), '_withUserLock объявлен');
    const start = zonePhp.indexOf('private function _withUserLock');
    const body = zonePhp.slice(start, start + 1200);
    assert(/_rawLink\(\)/.test(body), 'использует отдельное соединение (_rawLink), не общий $this->registry[\'udb\']');
    assert(/GET_LOCK\(/.test(body), 'вызывает GET_LOCK');
    assert(/RELEASE_LOCK\(/.test(body), 'вызывает RELEASE_LOCK');
    assert(/finally\s*\{/.test(body), 'освобождение лока — в finally (гарантированно выполняется даже при раннем return/исключении)');
}

console.log('\nTest 2: все 4 server-authoritative мутации Зоны обёрнуты в _withUserLock');
for(const name of ['fillCheckpoint', 'captureLocation', 'upgradeBusiness', 'collectIncome']){
    const body = methodBody(zonePhp, name);
    assert(!!body, name + '() найден в zone.php');
    assert(!!body && /\$this->_withUserLock\(function\(\)/.test(body), name + '() оборачивает load→mutate→save в _withUserLock(...)');
    // loadUser должен быть ВНУТРИ закрытия (после _withUserLock), не до него — иначе гонка не закрыта
    assert(!!body && body.indexOf('_withUserLock') < body.indexOf('$this->ops->loadUser()'),
        name + '(): _withUserLock() оборачивает loadUser(), а не наоборот');
}

console.log('\nTest 3: zone.js — collectLocIncome() принимает onDone и вызывает его на каждом выходе (кулдаун/ошибка ответа/успех/сетевая ошибка)');
{
    const start = zoneJs.indexOf('collectLocIncome(locIdx, onDone){');
    assert(start !== -1, 'collectLocIncome(locIdx, onDone) — сигнатура с onDone');
    const end = zoneJs.indexOf('\n    getCollectCooldown', start);
    const body = zoneJs.slice(start, end === -1 ? zoneJs.length : end);
    const calls = (body.match(/onDone\(\)/g) || []).length;
    assert(calls >= 4, 'onDone() вызывается минимум на 4 путях выхода (кулдаун, невалидный ответ, успех, ошибка сервера) — нашлось ' + calls);
}

console.log('\nTest 4: zone.js — _collectIncome() отправляет один общий запрос, без набора запросов по локациям');
{
    const start = zoneJs.indexOf('_collectIncome(onAllDone){');
    assert(start !== -1, '_collectIncome(onAllDone) найден');
    const end = zoneJs.indexOf('\n\n', start + 20);
    const body = zoneJs.slice(start, end === -1 ? start + 1200 : end);
    assert(/TS\.php\('zone\.collectAllIncome', \{\}/.test(body),
        'вызывает один zone.collectAllIncome вместо отдельных запросов по локациям');
    assert(!/collectLocIncome\(/.test(body),
        'не вызывает collectLocIncome() из общего сбора — нет ни параллельной гонки, ни зависимости UI от последнего ответа');
}

console.log('\nTest 5: zone_screen.js — кнопка "Собрать прибыль" зовёт zone._collectIncome(...), а не параллельный цикл напрямую');
{
    const btnStart = zoneScreenJs.indexOf("btnCollect.on('pointerdown'");
    assert(btnStart !== -1, 'обработчик кнопки btnCollect найден');
    const btnEnd = zoneScreenJs.indexOf('});', btnStart) + 3;
    const body = zoneScreenJs.slice(btnStart, btnEnd);
    assert(/zone\._collectIncome\(/.test(body), 'вызывает zone._collectIncome(...)');
    assert(!/for\s*\(let i = 0; i < 5; i\+\+\)/.test(body), 'старый ручной цикл по 5 локациям с прямым вызовом collectLocIncome убран из обработчика кнопки');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
