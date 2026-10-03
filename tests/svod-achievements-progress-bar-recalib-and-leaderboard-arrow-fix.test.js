/**
 * Test: батч 23.09.2026 (по прямому указанию, скриншоты редактора позиций + Photoshop).
 *
 * 1) svod-achievements.js: прогресс-бар тира ("ячейка прогресса") пересчитан из абсолютных
 *    PSD-координат X:518 Y:258 (тот же макет, что уже даёт X=354/Y=169 для самой карточки) —
 *    в локальные координаты относительно карточки: (518-354, 258-169-43) = (164, 46).
 *    Размер задан прямо — 308×12 (было формулой 420×12). Пользователь подтвердил: применяется
 *    одинаково ко ВСЕМ ячейкам списка (общие константы цикла, не только первая).
 *
 * 2) svod-scroll.js: cfg.arrowUpY/arrowDownY (были в JSDoc, но не читались) теперь реально
 *    применяются как override формулы viewY±. svod-leaderboard.js передаёт arrowDownY:480,
 *    arrowX:1034 (репорт "стрелка вниз не отображается" на экране "Топ по авторитету/урону" —
 *    формула давала Y≈480). svod-achievements.js по-прежнему на формуле (не репортили отдельно).
 *
 * Run: node tests/svod-achievements-progress-bar-recalib-and-leaderboard-arrow-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game');
const achSrc   = fs.readFileSync(path.join(root, 'svod', 'svod-achievements.js'), 'utf-8');
const scrollSrc= fs.readFileSync(path.join(root, 'svod', 'svod-scroll.js'), 'utf-8');
const lbSrc    = fs.readFileSync(path.join(root, 'svod', 'svod-leaderboard.js'), 'utf-8');

console.log('\nTest 1: svod-achievements.js — PROGRESS_BAR_X/Y/W/H пересчитаны из PSD-координат (X:518 Y:258)');
{
    assert(/const PROGRESS_BAR_X = 164, PROGRESS_BAR_Y = 46, PROGRESS_BAR_W = 308, PROGRESS_BAR_H = 12;/.test(achSrc),
        'новые точечные значения: X=164 (518-354), Y=46 (258-169-43 обрезка), W=308, H=12 (не менялась)');
    assert(!/PROGRESS_BAR_Y = PTS_Y/.test(achSrc), 'PROGRESS_BAR_Y больше не завязан на PTS_Y (независимая точечная константа)');
}

console.log('\nTest 2: svod-achievements.js — DESC_CENTER_X по-прежнему формулой от новых PROGRESS_BAR_X/W (согласован автоматически)');
{
    assert(/const DESC_CENTER_X = PROGRESS_BAR_X \+ PROGRESS_BAR_W \/ 2;/.test(achSrc),
        'формула не тронута — описание останется центрированным относительно бара при любых будущих правках его размера/позиции');
}

console.log('\nTest 3: svod-scroll.js — arrowUpY/arrowDownY из cfg реально читаются и применяются (раньше были в JSDoc, но не в destructuring)');
{
    assert(/const \{ parent, contentContainer, viewX, viewY, viewW, viewH, trackX, arrowX, stepPx, arrowUpY, arrowDownY \} = cfg;/.test(scrollSrc),
        'arrowUpY/arrowDownY добавлены в деструктуризацию cfg');
    assert(/arrowUp\.y = \(arrowUpY !== undefined\) \? arrowUpY : viewY - 32;/.test(scrollSrc),
        'arrowUp.y использует override, если передан, иначе прежняя формула (viewY-32)');
    assert(/arrowDown\.y = \(arrowDownY !== undefined\) \? arrowDownY : viewY \+ viewH \+ 2;/.test(scrollSrc),
        'arrowDown.y использует override, если передан, иначе прежняя формула (viewY+viewH+2)');
}

console.log('\nTest 4: svod-leaderboard.js — передаёт arrowDownY:480, arrowX:1034 (координаты с редактора)');
{
    assert(/trackX: 1035, arrowX: 1034, arrowDownY: 480,/.test(lbSrc),
        'leaderboard передаёт точечную Y для стрелки вниз и обновлённый X (было 1033)');
}

console.log('\nTest 5: svod-achievements.js — 24.09.2026, по прямому указанию, теперь ТОЖЕ передаёт arrowDownY:480 (репорт: "стрелка вниз в Мои достижения на y543, а в Общем топе на y480, сделай одинаково")');
{
    const start = achSrc.indexOf('this._buildSvodScroll({');
    const end   = achSrc.indexOf('});', start);
    const body  = achSrc.slice(start, end);
    assert(/arrowDownY: 480,/.test(body), 'achievements теперь тоже явно фиксирует arrowDownY:480, синхронно с leaderboard');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
