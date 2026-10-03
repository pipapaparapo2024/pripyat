/**
 * Test: батч 23.09.2026 (по прямому указанию, скриншот редактора позиций):
 *
 *  1) "убери подсвечивание для игры рулетку" — жёлтый мигающий клин-подсветка сектора
 *     (sectorHighlight/_drawRouletteSector/_uAdjustWidth/SECTOR_HALF_DEG и весь связанный код
 *     в _buildRouletteScreen/_animRouletteWheel/_resolveRouletteNewScreen) убран из рулетки
 *     целиком — и создание объекта, и его отрисовка/мигание после спина.
 *  2) "я добавил блок для текста куда ты будешь вписывать игрока который последний выбил
 *     джекпот" — бокс ника победителя (winnerNameTxt, window._centerTextIn) уточнён редактором
 *     позиций: было {x:794,y:285,w:152,h:42}, стало {x:794,y:288,w:152,h:31}.
 *
 * Run: node tests/roulette-sector-highlight-removed.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const roulSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-screen.js'), 'utf-8');

console.log('\nTest 1: клин-подсветка сектора убран целиком (создание объекта)');
{
    assert(!/const sectorHighlight = new PIXI\.Graphics\(\);/.test(roulSrc), 'sectorHighlight больше не создаётся');
    assert(!/this\._roulSectorHighlight = sectorHighlight;/.test(roulSrc), 'this._roulSectorHighlight больше не назначается');
    assert(!/function _drawRouletteSector\(h, halfDeg\)\{/.test(roulSrc), '_drawRouletteSector() (функция отрисовки клина) удалена');
    assert(!/const SECTOR_HALF_DEG/.test(roulSrc), 'константы геометрии клина (SECTOR_HALF_DEG/INNER/OUTER) удалены');
}

console.log('\nTest 2: клин-подсветка не показывается и не мигает после остановки колеса');
{
    const m = roulSrc.match(/proto\._resolveRouletteNewScreen = function\(idx, isJack, reward, clientRewards\)\{([\s\S]*?)\n        \/\/ 15 слотов/);
    assert(!!m, '_resolveRouletteNewScreen найден');
    const body = m ? m[1] : '';
    assert(!/h\.visible = true;/.test(body), 'клин больше не показывается (h.visible=true убрано)');
    assert(!/gsap\.timeline\(\)/.test(body), 'мигание alpha (gsap.timeline) убрано из результата спина');
}

console.log('\nTest 3: _animRouletteWheel не сбрасывает больше не существующий клин');
{
    const m = roulSrc.match(/proto\._animRouletteWheel = function\(targetIdx, onComplete\)\{([\s\S]*?)\n        const SEG/);
    assert(!!m, '_animRouletteWheel найден');
    const body = m ? m[1] : '';
    assert(!/_roulSectorHighlight/.test(body), '_animRouletteWheel не ссылается на несуществующий this._roulSectorHighlight');
}

console.log('\nTest 4: бокс ника победителя джекпота уточнён редактором позиций (03.10.2026: y:288→278, поднято на 10px)');
{
    assert(/window\._centerTextIn\(winnerNameTxt, \{x:794, y:278, w:152, h:31\}\);/.test(roulSrc),
        'winnerNameTxt теперь в боксе {x:794,y:278,w:152,h:31}');
    // Регресс-гвард — сам механизм показа ника победителя (dvor-roulette.js читает
    // udata['roulette_winner'] и пишет w.name в _roulWinnerNameTxt.text) не тронут этой правкой.
    const orchSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette.js'), 'utf-8');
    assert(/if\(this\._roulWinnerNameTxt\) this\._roulWinnerNameTxt\.text = w\.name;/.test(orchSrc),
        'dvor-roulette.js по-прежнему заполняет _roulWinnerNameTxt.text из udata[\'roulette_winner\']');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
