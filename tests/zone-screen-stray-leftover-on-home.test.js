/**
 * Test: 18.10.2026 (баг найден по живому репорту пользователя через консоль — "серый
 * прямоугольник на главном экране, редактор позиций его не видит").
 *
 * Корень: Зона — единственный игровой экран, который кладёт себя в root.layer1_mc НАПРЯМУЮ
 * (zone_screen.js._openZoneScreen → root.layer1_mc.addChild(win)), а не через общий
 * home.openScreen(this.win)/home.current_screen, которым пользуются ВСЕ остальные экраны
 * (dvor/bosses/vassilich/gangs/hapuga/bot/battlepass/top/zadaniya). У home.closeScreen()
 * нет понятия о _zoneWin — если открыть Зону, затем нажать кнопку ХУДа, ведущую на один из
 * ТЕХ экранов (минуя собственную кнопку выхода Зоны), _zoneWin остаётся visible=true под
 * новым экраном. Когда тот потом закрывается — Зона "всплывает" обратно на главном экране,
 * то есть виден лишний прямоугольник именно там, где пользователь и сообщил. Подтверждено
 * живым дампом window.root.layer1_mc.children в консоли — найденный объект (0,0,2400,894,
 * 12 детей, последний ребёнок x:1240,y:86,w:31,h:29) побайтово совпал с exitBtn Зоны
 * (exitBtn.x=1240,exitBtn.y=86 в zone_screen.js).
 *
 * Фикс — симметричный, в обе стороны:
 *  1) zone_screen.js._openZoneScreen() вызывает home.closeScreen() в начале (открытие Зоны
 *     закрывает любой другой открытый через home.openScreen() экран).
 *  2) home.js.openScreen() вызывает iface._closeZoneScreen() в начале (открытие любого
 *     другого экрана прячет Зону, если она была открыта).
 *  3) Инлайн-логика кнопки выхода Зоны вынесена в отдельный idempotent-метод
 *     _closeZoneScreen() — переиспользуется в обоих местах, не дублируется.
 *
 * Попутно найдено и убрано: home.js содержал ДВА определения openScreen()/closeScreen() —
 * второе (ниже) молча перекрывало первое (JS держит только последнее определение метода в
 * классе), первая пара была мёртвым кодом. Удалена, чтобы больше не вводить в заблуждение.
 *
 * Run: node tests/zone-screen-stray-leftover-on-home.test.js
 */

const fs  = require('fs');
const path = require('path');
const vm  = require('vm');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const zoneSrc = read('_client/src/game/shell/overlays/zone_screen.js');
const homeSrc = read('_client/src/game/home.js');

console.log('\n1) zone_screen.js — открытие Зоны закрывает любой другой открытый home-экран');
{
    const start = zoneSrc.indexOf('proto._openZoneScreen = function(targetLocIdx){');
    const end   = zoneSrc.indexOf('\n\tproto._closeZoneScreen', start);
    const body  = zoneSrc.slice(start, end);
    assert(/if\(window\.home\) home\.closeScreen\(\);/.test(body), '_openZoneScreen вызывает home.closeScreen() до построения своего окна');
}

console.log('\n2) zone_screen.js — _closeZoneScreen() вынесен в отдельный idempotent-метод');
{
    assert(/proto\._closeZoneScreen = function\(\){/.test(zoneSrc), '_closeZoneScreen определён');
    assert(/exitBtn\.on\('pointerdown', \(\)=>this\._closeZoneScreen\(\)\);/.test(zoneSrc),
        'кнопка выхода Зоны зовёт общий _closeZoneScreen(), не дублирует логику инлайн');
    // Старый инлайн-блок (три вызова подряд без обёртки в метод) должен исчезнуть как дубль.
    assert(!/exitBtn\.on\('pointerdown', \(\)=>\{\s*clearInterval\(this\._zoneTimerInterval\);/.test(zoneSrc),
        'старая инлайн-логика кнопки выхода удалена (заменена вызовом метода)');
}

console.log('\n3) zone_screen.js — _closeZoneScreen() реально исполнена: idempotent, чистит таймер/HUD/амбиент');
{
    const start = zoneSrc.indexOf('proto._closeZoneScreen = function(){');
    const end   = zoneSrc.indexOf('\n\t};', start) + 4;
    const fnSrc = zoneSrc.slice(start, end).replace('proto._closeZoneScreen = function', 'function _closeZoneScreen');

    const sandbox = { clearInterval: (id) => { sandbox._clearedId = id; }, console };
    vm.createContext(sandbox);
    vm.runInContext(fnSrc, sandbox);

    const calls = [];
    const self = {
        _zoneWin: { visible: true },
        _zoneTimerInterval: 42,
        popHud: (id) => calls.push('popHud:' + id),
        _stopZoneAmbient: () => calls.push('_stopZoneAmbient'),
    };
    sandbox._closeZoneScreen.call(self);

    assert(self._zoneWin.visible === false, 'окно Зоны реально прячется (visible=false)');
    assert(self._zoneTimerInterval === null, 'таймер сбора обнулён');
    assert(sandbox._clearedId === 42, 'clearInterval вызван с реальным id таймера');
    assert(calls.includes('popHud:zone') && calls.includes('_stopZoneAmbient'), 'HUD и амбиент-звук корректно откатываются');

    // Повторный вызов на УЖЕ скрытом окне — no-op, не должен падать и не должен звать popHud второй раз.
    calls.length = 0;
    sandbox._closeZoneScreen.call(self);
    assert(calls.length === 0, 'повторный вызов на уже скрытой Зоне — no-op (idempotent)');

    // Без открытого окна вообще — тоже no-op, не падает.
    let threw = false;
    try{ sandbox._closeZoneScreen.call({ _zoneWin: null }); } catch(e){ threw = true; }
    assert(!threw, '_zoneWin === null — не бросает исключение');
}

console.log('\n4) home.js — openScreen() прячет Зону перед открытием любого другого home-экрана');
{
    const start = homeSrc.indexOf('openScreen(screen_mc){');
    const end   = homeSrc.indexOf('\n\t}', start);
    const body  = homeSrc.slice(start, end);
    assert(/iface\._closeZoneScreen/.test(body), 'openScreen() зовёт iface._closeZoneScreen() как защитный вызов');
}

console.log('\n5) home.js — старая мёртвая пара openScreen()/closeScreen() (перекрытая второй) удалена');
{
    const openCount  = (homeSrc.match(/\n\topenScreen\(screen_mc\)\{/g) || []).length;
    const closeCount = (homeSrc.match(/\n\tcloseScreen\(\)\{/g) || []).length;
    assert(openCount === 1, `openScreen() определён РОВНО один раз (было 2 — второе молча перекрывало первое), найдено: ${openCount}`);
    assert(closeCount === 1, `closeScreen() определён РОВНО один раз, найдено: ${closeCount}`);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
