/**
 * Test: попап победы над боссом — диагональный штамп "УБИТ" поверх портрета (22.09.2026,
 * по прямому указанию со скриншотом попапа победы). Показывается только при isWin, повёрнут
 * на 45° против часовой стрелки (PIXI.rotation = -Math.PI/4, т.к. ось Y направлена вниз —
 * положительное вращение в PIXI визуально по часовой).
 *
 * Run: node tests/boss-result-killed-stamp.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8'
);

console.log('\nTest 1: штамп "УБИТ" создаётся только при isWin, поверх портрета');
{
    const start = src.indexOf('const portrait = _sprite(portraitFile, PORTRAIT_POS);');
    const end   = src.indexOf('const banner = _sprite(', start);
    const body  = src.slice(start, end);
    assert(/if\(isWin\)\{/.test(body), 'штамп оборачивается в if(isWin) — на поражении не показывается');
    assert(/new PIXI\.Text\('УБИТ',/.test(body), 'текст штампа — "УБИТ"');
    assert(/killedStamp\.rotation = -Math\.PI \/ 4;/.test(body), 'поворот -45° (против часовой в экранных координатах PIXI)');
    assert(/killedStamp\.x = PORTRAIT_POS\.x \+ PORTRAIT_W \/ 2;/.test(body), 'X — центр портрета по горизонтали');
    assert(/killedStamp\.y = PORTRAIT_POS\.y \+ PORTRAIT_H \/ 2;/.test(body), 'Y — центр портрета по вертикали');
    assert(/killedStamp\.anchor\.set\(0\.5, 0\.5\);/.test(body), 'якорь по центру текста (поворот вокруг своего центра)');
}

console.log('\nTest 2: PORTRAIT_H определена как константа рядом с PORTRAIT_W');
{
    assert(/const PORTRAIT_H = 230;/.test(src), 'PORTRAIT_H = 230 (средний ориентир натуральной высоты файлов BOSS_PORTRAITS, 227-236px)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
