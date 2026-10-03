/**
 * Test: 17.09.2026 — репорт "нажатие на Сводку показывает бесконечный компас" + консоль:
 *   "Uncaught TypeError: Cannot read properties of null (reading 'parent')
 *    at r.addChild ... at W.open (svod.js:136:24)"
 *
 * Причина: _buildPixiWin() записывал построенный контейнер в this._svodWin, а open()/close()
 * читали (и addChild'или) this._pixiWin — который так и оставался null из конструктора,
 * потому что ничего и никогда его не устанавливало. root.layer2_mc.addChild(null) кидает
 * исключение ДО iface.restoreHud()/_compassHide() — отсюда завис компас (исключение обрывало
 * цепочку openModule() раньше, чем она успевала его спрятать).
 *
 * Второй репорт того же батча: попап "ВОЗМОЖНАЯ НАГРАДА" показывал "+5 ОЧКОВ РЮКЗАКА" — плюс
 * убран, теперь просто "5 очков рюкзака" (два соседних пункта той же плашки — сигареты/опыт —
 * и так были без плюса, только рюкзак был не в ряд).
 *
 * Run: node tests/svod-pixiwin-null-crash-and-ryukzak-plus-sign.test.js
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

const svodSrc      = readSrc('_client/src/game/svod.js');
const prefightSrc  = readSrc('_client/src/game/shell/overlays/bosses_prefight.js');

console.log('\nTest 1: svod.js больше не путает this._svodWin и this._pixiWin — единое имя везде');
{
    assert(!/this\._svodWin/.test(svodSrc), 'this._svodWin нигде не остался (был мёртвым присваиванием, из-за которого _pixiWin никогда не устанавливался)');

    const buildStart = svodSrc.indexOf('_buildPixiWin(){');
    const buildEnd   = svodSrc.indexOf('_ensurePanel(key){');
    const buildBody  = svodSrc.slice(buildStart, buildEnd);
    assert(/this\._pixiWin = win;/.test(buildBody), '_buildPixiWin() реально устанавливает this._pixiWin (баг был именно в этом)');

    const ensureStart = svodSrc.indexOf('_ensurePanel(key){');
    const ensureEnd   = svodSrc.indexOf('_selectMainTab(key){');
    const ensureBody  = svodSrc.slice(ensureStart, ensureEnd);
    assert(/this\._pixiWin\.addChild\(achPanel\);/.test(ensureBody) && /this\._pixiWin\.addChild\(panel\);/.test(ensureBody),
        '_ensurePanel добавляет панели именно в this._pixiWin (тот же контейнер, что реально попадает в layer2_mc)');

    assert(/if\(!this\._pixiWin\) this\._buildPixiWin\(\);\s*\n\s*root\.layer2_mc\.addChild\(this\._pixiWin\);/.test(svodSrc),
        'open() строит и добавляет ОДИН И ТОТ ЖЕ this._pixiWin — addChild(null) больше невозможен');
}

console.log('\nTest 2: попап "ВОЗМОЖНАЯ НАГРАДА" — очки рюкзака без лишнего плюса');
{
    assert(/tip: \(\)=>\(RYUKZAK_PTS\[bossIdx\]\|\|0\)\+' очков рюкзака'/.test(prefightSrc),
        'текст очков рюкзака — просто число + подпись, без ведущего "+"');
    assert(!/tip: \(\)=>'\+'\+\(RYUKZAK_PTS\[bossIdx\]\|\|0\)/.test(prefightSrc),
        'старый вариант с плюсом не остался');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
