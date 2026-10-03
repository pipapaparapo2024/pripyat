/**
 * Test: 25.09.2026, dev-панель — кнопка "100%" на каждую комбинацию блэкджека (по прямому
 * указанию — "хочу тестировать все азартные игры").
 *
 * blackjack.php.deal() получает новый одноразовый server-only флаг dev_force_blackjack (личный,
 * пишется через users.setDevCombo, НЕ в whitelist) — хранит либо конкретный ранг из
 * blackjack_config.json.ranks (передаётся как $forcedRank в уже существующую _dealRealPair(),
 * написанную раньше для pity AA/KK/QQ), либо спецключ '__nonpair' (гарантированно РАЗНЫЕ ранги —
 * _dealRealPair() для этого не подходит, она только СНИЖАЕТ шанс совпадения премиум-рангов, не
 * гарантирует различие — написана отдельная ручная ветка). Флаг гасится сразу в обеих ветках.
 *
 * Run: node tests/dev-force-blackjack-combo.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bjSrc    = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'blackjack.php'), 'utf-8');
const forceSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel_casino_force.js'), 'utf-8');
const catalog  = JSON.parse(fs.readFileSync(path.join(root, 'server', 'json', 'blackjack_config.json'), 'utf-8'));

console.log('\nTest 1: dev_force_blackjack читается через strval()+проверку пустой строки');
{
    const start = bjSrc.indexOf('function deal(){');
    assert(start !== -1, 'deal() найден');
    const end = bjSrc.indexOf('$swapsAllowed = $this->_swapsAllowed($user, $catalog);', start);
    const body = bjSrc.slice(start, end !== -1 ? end : start + 4000);

    assert(/\$devForceBj = strval\(\$user\['dev_force_blackjack'\] \?\? ''\);/.test(body), 'флаг читается явным strval()');
    assert(/if\(\$devForceBj !== '' && \$devForceBj !== '__nonpair'\)\{/.test(body), 'ветка обычного ранга проверяет непустую строку и исключает __nonpair');
    assert(/\} else if\(\$devForceBj === '__nonpair'\)\{/.test(body), 'отдельная ветка для спецключа __nonpair');
}

console.log('\nTest 2: обычный ранг форса — гасится сразу, передаётся в существующую _dealRealPair() как $forcedRank');
{
    const start = bjSrc.indexOf("if(\$devForceBj !== '' && \$devForceBj !== '__nonpair'){");
    const end   = bjSrc.indexOf('} else if(', start);
    const body  = bjSrc.slice(start, end);

    assert(/\$user\['dev_force_blackjack'\] = '';/.test(body), 'флаг гасится сразу');
    assert(/\$forcedRank = \$devForceBj;/.test(body), 'forcedRank = ранг из флага');
    assert(/\$hand = \$this->_dealRealPair\(\$catalog, \$forcedRank, \$dealTrace\);/.test(body),
        'идёт в уже существующую _dealRealPair() — не написана новая раздача');
}

console.log('\nTest 3: __nonpair — ручная ветка, ГАРАНТИРОВАННО разные ранги (do-while, не _dealRealPair)');
{
    const start = bjSrc.indexOf("} else if(\$devForceBj === '__nonpair'){");
    const end   = bjSrc.indexOf('} else {', start);
    const body  = bjSrc.slice(start, end);

    assert(/\$user\['dev_force_blackjack'\] = '';/.test(body), 'флаг гасится сразу и в этой ветке тоже');
    assert(/\$r1 = \$this->_pickRank\(\$RANKS\);/.test(body), 'первый ранг — обычный случайный выбор');
    assert(/do \{ \$r2 = \$this->_pickRank\(\$RANKS\); \} while\(\$r2 === \$r1\);/.test(body),
        'второй ранг гарантированно ОТЛИЧАЕТСЯ от первого (do-while, не полагается на _dealRealPair)');
    assert(/\$hand = \[\$r1, \$r2\];/.test(body), 'рука строится напрямую из двух разных рангов');
}

console.log('\nTest 4: обычная (не форсированная) раздача не тронута — по-прежнему идёт через _dealRealPair() с честным pity forcedRank');
{
    const nonpairIdx = bjSrc.indexOf("\$devForceBj === '__nonpair'");
    const finalElseIdx = bjSrc.indexOf('} else {', nonpairIdx);
    const tailBody = bjSrc.slice(finalElseIdx, finalElseIdx + 200);
    assert(/\$hand = \$this->_dealRealPair\(\$catalog, \$forcedRank, \$dealTrace\);/.test(tailBody),
        'ветка "иначе" (честная игра, после __nonpair) сохранена — использует _dealRealPair() как раньше');
}

console.log('\nTest 5: dev_panel_casino_force.js — 9 позиций блэкджека (8 премиум-рангов + __nonpair), ключи реальные ранги из каталога');
{
    const listStart = forceSrc.indexOf('const BJ_COMBOS = [');
    const listEnd   = forceSrc.indexOf('];', listStart);
    const list = forceSrc.slice(listStart, listEnd);
    assert((list.match(/key:'/g) || []).length === 9, 'ровно 9 позиций (8 рангов + __nonpair)');
    assert(/key:'__nonpair'/.test(list), '__nonpair присутствует как отдельная позиция');

    const keys = [...list.matchAll(/key:'([^']+)'/g)].map(m => m[1]).filter(k => k !== '__nonpair');
    keys.forEach(k => {
        assert(catalog.ranks.includes(k), `ранг "${k}" из dev-панели реально существует в blackjack_config.json.ranks`);
    });

    assert(/BJ_COMBOS\.forEach\(c => _row\(c\.label, mkBtn\('blackjack', c\.key\)\)\);/.test(forceSrc),
        'каждая строка зовёт mkBtn(\'blackjack\', c.key)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
