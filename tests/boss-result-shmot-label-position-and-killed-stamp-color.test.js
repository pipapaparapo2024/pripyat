/**
 * Test: батч 23.09.2026 (по прямому указанию, скриншот редактора позиций поверх попапа
 * "ТЫ ПОБЕДИЛ!"):
 *
 *  1) "поменял расположение +кол-во шмоток исправь" — подпись "+N" рядом с иконкой шмотки
 *     переставлена: было {x:SHMOT_POS.x+44, y:SHMOT_POS.y+22} (абсолютно 857,297), стало
 *     {x:SHMOT_POS.x+50, y:SHMOT_POS.y+20} (абсолютно 863,295 — снято редактором позиций).
 *  2) "сделай слово убит на боссе белым шрифтом" — штамп "УБИТ" был красным (#c81e1e), стал
 *     белым (#ffffff).
 *
 * Run: node tests/boss-result-shmot-label-position-and-killed-stamp-color.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');

console.log('\nTest 1: штамп "УБИТ" — белый шрифт, не красный');
{
    const m = src.match(/const killedStamp = new PIXI\.Text\('УБИТ', \{([\s\S]*?)\}\);/);
    assert(!!m, 'killedStamp найден');
    const body = m ? m[1] : '';
    assert(/fill: '#ffffff'/.test(body), 'fill: #ffffff (было #c81e1e)');
    assert(!/fill: '#c81e1e'/.test(body), 'старый красный цвет (#c81e1e) убран');
}

console.log('\nTest 2: подпись "+N" рядом с иконкой шмотки — новая позиция (абсолютно x:863 y:295)');
{
    assert(/_rewardLabel\(\{ x: SHMOT_POS\.x \+ 50, y: SHMOT_POS\.y \+ 20 \}, opts\.shmotAmount\);/.test(src),
        'смещение от SHMOT_POS теперь +50/+20 (было +44/+22)');
    // Регресс-гвард: SHMOT_POS сам не менялся этой правкой (813,275) — 813+50=863, 275+20=295,
    // ровно то, что снял редактор позиций.
    assert(/const SHMOT_POS\s*=\s*\{ x: 813, y: 275 \};/.test(src), 'SHMOT_POS не менялся (813,275) — регресс-гвард для арифметики выше');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
