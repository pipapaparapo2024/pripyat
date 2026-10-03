/**
 * Test: после закрытия вкладки скиллов (СКИЛЫ, открывается прямо с экрана боя) счётчики
 * ОЧКИ/НОВЫЕ на экране боя не обновлялись сразу — оставались со старым значением, пока не
 * происходило что-то ещё, что триггерило _updateBossFightStats(). Теперь _closeBossesSkillsScreen()
 * обновляет их сразу при закрытии.
 *
 * Run: node tests/skills-close-refreshes-fight-stats.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_skills.js'), 'utf-8'
);

console.log('\nTest 1: _closeBossesSkillsScreen вызывает _updateBossFightStats(), если он определён');
{
    const m = src.match(/proto\._closeBossesSkillsScreen = function\(\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_closeBossesSkillsScreen найден');
    if (m) {
        const body = m[1];
        assert(/if\(typeof this\._updateBossFightStats === 'function'\) this\._updateBossFightStats\(\);/.test(body),
            'обновляет ОЧКИ/НОВЫЕ на экране боя сразу при закрытии вкладки скиллов');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
