/**
 * Test: батч 25.09.2026 (по прямому указанию, скриншот попапа победы — "+20000"/"+1500" вместо
 * "+20к"/"+1.5к") — суммы наград в попапе результата боя (сигареты/очки рюкзака/опыт) теперь
 * форматируются через formatAchNum() (modules/achievement-tiers.js, уже используется в "Мои
 * достижения") вместо сырого числа: целые тысячи без точки (20000 → "20к"), нецелые — с одним
 * знаком после точки (1500 → "1.5к"), суммы < 1000 (150, 1) не меняются.
 *
 * Run: node tests/boss-result-reward-number-formatting.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');

console.log('\nTest 1: импортирует formatAchNum из общего модуля (не дублирует форматирование)');
{
    assert(/import \{ formatAchNum \} from '\.\.\/\.\.\/\.\.\/modules\/achievement-tiers\.js';/.test(src),
        'импорт formatAchNum из modules/achievement-tiers.js');
}

console.log('\nTest 2: _rewardLabel использует formatAchNum, не сырое число');
{
    const s = src.indexOf('const _rewardLabel = (pos, amount) => {');
    const e = src.indexOf('\n            };', s);
    const body = src.slice(s, e);
    assert(/'\+' \+ formatAchNum\(amount \|\| 0\)/.test(body), '"+" + formatAchNum(amount || 0) — не сырой "+" + (amount || 0)');
    assert(!/'\+' \+ \(amount \|\| 0\)/.test(body), 'старое сырое форматирование убрано');
}

console.log('\nTest 3: сверка формулы formatAchNum по конкретным числам из репорта (20000→20к, 1500→1.5к)');
{
    // Изолированный ре-имплемент — та же формула, что в modules/achievement-tiers.js (без
    // импорта ES-модуля в CJS-тестовой среде, тот же приём, что и в остальных тестах проекта).
    function formatAchNum(n){
        if(n >= 1000000){
            const v = n / 1000000;
            return (v % 1 === 0 ? v : v.toFixed(1)) + 'кк';
        }
        if(n >= 1000){
            const v = n / 1000;
            return (v % 1 === 0 ? v : v.toFixed(1)) + 'к';
        }
        return String(n);
    }
    assert(formatAchNum(20000) === '20к', '20000 → "20к" (целые тысячи без точки)');
    assert(formatAchNum(1500) === '1.5к', '1500 → "1.5к" (один знак после точки)');
    assert(formatAchNum(150) === '150', '150 остаётся как есть (< 1000)');
    assert(formatAchNum(1) === '1', '1 остаётся как есть (< 1000)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
