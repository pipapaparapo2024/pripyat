/**
 * Test: 25.09.2026, dev-панель — кнопка "100%" на каждый сектор рулетки (по прямому указанию —
 * "хочу тестировать все азартные игры").
 *
 * roulette.php.spin()/_rollSlot() получает новый одноразовый server-only флаг dev_force_roulette
 * (личный, пишется через users.setDevCombo, НЕ в whitelist) — хранит slotIdx (0-14, тот же
 * индекс, что SPIN_SLOTS). _rollSlot() проверяет $forceIdx ПЕРВЫМ, раньше $jackpot/
 * $keyringAvailable веток. Если форс = idx12 (джекпот/куш) — $jackpot тоже выставляется в true
 * (чтобы roulette_cups/"выбор приза" сработали как обычно, не только голая выдача слота).
 * Флаг гасится сразу.
 *
 * Run: node tests/dev-force-roulette-slot.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const rouletteSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');

console.log('\nTest 1: dev_force_roulette читается через strval()+проверку пустой строки в spin(), НЕ через Gameops::i()');
{
    const start = rouletteSrc.indexOf('function spin(){');
    assert(start !== -1, 'spin() найден');
    const end = rouletteSrc.indexOf('$link = $this->_rawLink();', start);
    const body = rouletteSrc.slice(start, end);

    assert(/\$devForceRouletteRaw = strval\(\$user\['dev_force_roulette'\] \?\? ''\);/.test(body), 'флаг читается явным strval()');
    assert(/if\(\$devForceRouletteRaw !== ''\)\{/.test(body), 'проверка именно на непустую строку');
    // 26.09.2026 (баг найден по живым логам — "Array to string conversion", каждый спин
    // форсился на idx=0/связку ключей из-за отдельного бага в Database::trueJSON(), см.
    // tests/roulette-devforce-array-corruption-fix.test.js): прямое присваивание
    // "$devForceIdx = intval(...)" заменено на defense-in-depth — intval() сначала кладётся
    // во временную $idx и применяется, только если попадает в реальный диапазон слотов.
    assert(/\$idx = intval\(\$devForceRouletteRaw\);/.test(body), 'idx парсится ТОЛЬКО внутри непустой ветки (не Gameops::i() снаружи)');
    assert(/if\(\$idx >= 0 && \$idx < count\(\$this->SPIN_SLOTS\)\) \$devForceIdx = \$idx;/.test(body), 'idx применяется только после проверки диапазона (защита от порченного/аномального значения)');
    assert(/\$user\['dev_force_roulette'\] = '';/.test(body), 'флаг гасится сразу внутри той же ветки');
}

console.log('\nTest 2: devForceIdx===12 форсирует jackpot=true (чтобы roulette_cups/выбор приза сработали как обычно)');
{
    assert(/\$jackpot = \$realJackpot \|\| \$devForceJackpot \|\| \(\$devForceIdx === 12\);/.test(rouletteSrc),
        'jackpot учитывает devForceIdx===12 наравне с реальным порогом и старым dev_force_jackpot');
}

console.log('\nTest 3: _rollSlot($jackpot, $keyringAvailable, &$user, &$trace, $forceIdx) — forceIdx проверяется ПЕРВЫМ, до jackpot/keyring веток');
{
    const sigIdx = rouletteSrc.indexOf('private function _rollSlot($jackpot, $keyringAvailable, &$user, &$trace = null, $forceIdx = null){');
    assert(sigIdx !== -1, 'сигнатура _rollSlot содержит $forceIdx = null (опциональный, обратная совместимость)');

    const bodyStart = sigIdx;
    const bodyEnd = rouletteSrc.indexOf('$slot = $this->SPIN_SLOTS[$idx]', bodyStart);
    const body = rouletteSrc.slice(bodyStart, bodyEnd);

    const forceCheckIdx = body.indexOf('if($forceIdx !== null){');
    const jackpotCheckIdx = body.indexOf('} else if($jackpot){');
    assert(forceCheckIdx !== -1 && jackpotCheckIdx !== -1 && forceCheckIdx < jackpotCheckIdx,
        '$forceIdx проверяется ПЕРВЫМ, раньше $jackpot — форс работает даже если случайно совпал бы с настоящим джекпотом');
}

console.log('\nTest 4: spin() передаёт devForceIdx в _rollSlot() как 5-й аргумент (реально доходит до места применения)');
{
    assert(/\$slotResult = \$this->_rollSlot\(\$jackpot, \$keyringAvailable, \$user, \$slotTrace, \$devForceIdx\);/.test(rouletteSrc),
        'основной вызов (когда _rawLink() доступен) передаёт devForceIdx');
    assert(/\$slotResult = \$this->_rollSlot\(\$devForceJackpot, false, \$user, \$slotTrace, \$devForceIdx\);/.test(rouletteSrc),
        'резервный вызов (когда _rawLink() НЕ доступен) тоже передаёт devForceIdx — форс не теряется при недоступности общей таблицы');
}

// Client force buttons were removed; server authorization and combination checks above remain.
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
