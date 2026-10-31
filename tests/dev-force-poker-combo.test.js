/**
 * Test: 25.09.2026, dev-панель — кнопка "100%" на каждую комбинацию покера (по прямому
 * указанию — "хочу тестировать все азартные игры").
 *
 * poker.php.deal() получает новый одноразовый server-only флаг dev_force_poker (личный,
 * пишется через users.setDevCombo, НЕ в whitelist) — хранит ГОТОВЫЙ comboKey (те же строки,
 * что COMBO_ROW_ORDER на клиенте). Если флаг непустой — передаётся НАПРЯМУЮ в уже существующую
 * _generateHandForCombo() (написана раньше для pity-системы royal-flush, здесь просто получает
 * другой источник комбо-ключа), обычный весовой _rollCombo() полностью пропускается. Флаг
 * гасится сразу.
 *
 * Run: node tests/dev-force-poker-combo.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const pokerSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'poker.php'), 'utf-8');

console.log('\nTest 1: dev_force_poker читается через strval()+проверку пустой строки, гасится сразу');
{
    const start = pokerSrc.indexOf('function deal(){');
    assert(start !== -1, 'deal() найден');
    const end = pokerSrc.indexOf('list($hand, $genAttempts) = $this->_generateHandForCombo', start);
    const body = pokerSrc.slice(start, end !== -1 ? end + 200 : start + 4000);

    assert(/\$devForcePoker = strval\(\$user\['dev_force_poker'\] \?\? ''\);/.test(body), 'флаг читается явным strval()');
    assert(/if\(\$devForcePoker !== ''\)\{/.test(body), 'проверка именно на непустую строку');
    assert(/\$user\['dev_force_poker'\] = '';/.test(body), 'флаг гасится сразу при срабатывании форса');
}

console.log('\nTest 2: при активном форсе targetCombo = сам флаг, обычный _rollCombo() НЕ вызывается; иначе — как раньше');
{
    const start = pokerSrc.indexOf("if(\$devForcePoker !== ''){");
    const end   = pokerSrc.indexOf('list($hand, $genAttempts)', start);
    const body  = pokerSrc.slice(start, end);

    assert(/\$targetCombo = \$devForcePoker;/.test(body), 'targetCombo напрямую = comboKey из флага');
    assert(/\} else \{[\s\S]*\$targetCombo = \$this->_rollCombo\(\$catalog, \$comboTrace\);/.test(body),
        'ветка else по-прежнему вызывает честный _rollCombo() (регресс-гвард — обычная игра не тронута)');
}

console.log('\nTest 3: результат (форс или честный) в любом случае идёт в уже существующую _generateHandForCombo() — новой генерации руки не написано');
{
    assert(/list\(\$hand, \$genAttempts\) = \$this->_generateHandForCombo\(\$catalog, \$targetCombo\);/.test(pokerSrc),
        '_generateHandForCombo() вызывается с targetCombo (общая точка для форса и честной игры)');
}

// Client force buttons were removed; server authorization and combination checks above remain.
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
