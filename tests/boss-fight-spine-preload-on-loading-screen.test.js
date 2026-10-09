/**
 * Test: репорт 08.10.2026 — "анимация босса появляется через ~0.5с при входе в бой, пусть
 * грузится заранее, пока крутится прелоадер". Фикс — _spineBossPreloadAll() грузит все 4
 * скелета боссов (+ взрыв Счастливчика) в this._spineCache ЗАРАНЕЕ, вызывается из
 * game-boot.js._showGame() сразу после iface.init() (самая ранняя точка, где window.iface
 * гарантированно существует — _showGame уже обращается к iface.init() строкой выше, значит
 * iface создан раньше по стеку checkFlags(['interface','home'], ...)).
 *
 * Run: node tests/boss-fight-spine-preload-on-loading-screen.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const spineSrc = fs.readFileSync(
    path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'spine-boss.js'), 'utf-8'
);
const bootSrc = fs.readFileSync(
    path.join(root, '_client', 'src', 'game', 'game-boot.js'), 'utf-8'
);

console.log('\nTest 1: _spineBossPreloadAll() определён и грузит ВСЕ сконфигурированные боссы');
{
    assert(/proto\._spineBossPreloadAll = function\(\) \{/.test(spineSrc), '_spineBossPreloadAll() определена');
    const start = spineSrc.indexOf('proto._spineBossPreloadAll = function() {');
    const end   = spineSrc.indexOf('proto._spineBossStartLoop = function()');
    const body  = spineSrc.slice(start, end);
    assert(/BOSS_SPINE\.forEach\(\(cfg, bossIdx\) => \{/.test(body), 'перебирает весь BOSS_SPINE, не один конкретный индекс');
    assert(/if \(!cfg \|\| this\._spineCache\[bossIdx\]\) return;/.test(body),
        'пропускает боссов без конфига и уже закэшированных — не грузит повторно');
}

console.log('\nTest 2: предзагрузка НЕ стартует render loop и не трогает _spineBossIdx/visible (бой ещё не открыт)');
{
    const start = spineSrc.indexOf('proto._spineBossPreloadAll = function() {');
    const end   = spineSrc.indexOf('proto._spineBossStartLoop = function()');
    const body  = spineSrc.slice(start, end);
    assert(!/_spineBossStartLoop/.test(body), '_spineBossPreloadAll не вызывает _spineBossStartLoop()');
    assert(!/_spineBossIdx\s*=/.test(body), '_spineBossPreloadAll не присваивает _spineBossIdx');
    assert(!/\.visible\s*=\s*true/.test(body), '_spineBossPreloadAll не включает видимость спрайта');
}

console.log('\nTest 3: game-boot.js вызывает предзагрузку сразу после iface.init(), до _finishLoading()');
{
    const showGameStart = bootSrc.indexOf('const _showGame = () => {');
    const showGameEnd   = bootSrc.indexOf('const _allPngs');
    assert(showGameStart !== -1 && showGameEnd !== -1, '_showGame() найдена');
    const body = bootSrc.slice(showGameStart, showGameEnd);

    const ifaceInitIdx = body.indexOf('iface.init();');
    const preloadIdx   = body.indexOf('iface._spineBossPreloadAll()');
    const finishIdx    = body.indexOf('setTimeout(_finishLoading, 300);');
    assert(ifaceInitIdx !== -1 && preloadIdx !== -1 && finishIdx !== -1, 'все три маркера найдены');
    assert(preloadIdx > ifaceInitIdx, 'предзагрузка вызывается ПОСЛЕ iface.init() (iface уже существует)');
    assert(preloadIdx < finishIdx, 'предзагрузка запускается ДО _finishLoading() — значит пока прелоадер ещё может быть на экране');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
