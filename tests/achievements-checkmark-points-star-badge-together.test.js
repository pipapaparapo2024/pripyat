/**
 * Test: 26.09.2026, повторный репорт тем же днём (скриншот "МОЛНИЕНОСНО ОХОТНИК" —
 * "у некоторых выполненных достижений нет галочки и кол-ва очков достижений, полученных за
 * него, и значка звёзды полученные.png") —
 *
 * Предыдущий фикс (26.09.2026, задача #62) добавил показ галочки при done===true в ветке
 * showBar, но ptsTxt/starsGotBadge остались жёстко скрыты (`c.ptsTxt.visible = false;`,
 * `c.starsGotBadge.visible = false;`) в этой же ветке. Координаты всех трёх элементов
 * (CHECK_X=490, PTS_TXT_X=519, STARS_GOT_X=541) стоят ПОСЛЕДОВАТЕЛЬНО сразу за концом бара
 * (PROGRESS_BAR_X+W=472) — не перекрывают ни бар, ни друг друга, поэтому все три можно
 * показывать одновременно с баром. Теперь при done===true показываются все три: галочка,
 * "+N" очков (a.pts), бейдж "звёзды полученные".
 *
 * Run: node tests/achievements-checkmark-points-star-badge-together.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const achSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');

console.log('\nTest 1: showBar-ветка — checkMark/ptsTxt/starsGotBadge все управляются через done, не жёстко false');
{
    const start = achSrc.indexOf('if(showBar){');
    const body = achSrc.slice(start, start + 3400);
    assert(/c\.checkMark\.visible = done;/.test(body), 'checkMark.visible = done');
    assert(/c\.starsGotBadge\.visible = done;/.test(body), 'starsGotBadge.visible = done (было жёстко false)');
    assert(/c\.ptsTxt\.visible = done;/.test(body), 'ptsTxt.visible = done (было жёстко false)');
    assert(/c\.ptsTxt\.text = done \? \('\+' \+ \(a\.pts \|\| 0\)\) : '';/.test(body),
        'ptsTxt.text показывает "+N" очков достижения (a.pts) при done, иначе пусто');
    assert(!/c\.ptsTxt\.visible = false;\s*\n\s*\/\/ 26\.09\.2026/.test(body),
        'старое безусловное скрытие ptsTxt в начале ветки убрано');
}

console.log('\nTest 2: координаты трёх элементов не перекрываются (последовательный ряд после бара)');
{
    assert(/const PROGRESS_BAR_X = 164, PROGRESS_BAR_Y = 46, PROGRESS_BAR_W = 308/.test(achSrc), 'бар: X=164, W=308 (конец=472)');
    assert(/const CHECK_X = 490, CHECK_Y = 50;/.test(achSrc), 'галочка: X=490 (после конца бара)');
    assert(/const PTS_TXT_X = 519, PTS_TXT_Y = 50;/.test(achSrc), 'очки: X=519 (после галочки)');
    assert(/const STARS_GOT_X = 541, STARS_GOT_Y = 49;/.test(achSrc), 'бейдж звёзд: X=541 (после очков)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
