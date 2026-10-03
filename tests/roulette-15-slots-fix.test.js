/**
 * Test: колесо рулетки (рулетка колесо.png) физически имеет 15 подписанных секторов
 * (1-10, 12-16) — сектора "11" на арте никогда не было (художник пропустил номер, проверено
 * прямым промером пикселей). Код при этом считал 16 равных секторов (SEG=22.5°, SLOTS[16]
 * с наградой "+3000 сигарет" в несуществующем слоте) — отсюда системное расхождение
 * "маркер стоит на одном секторе, награда — за соседний" при любом спине. По решению —
 * убрать награду "+3000 сигарет" из пула, а не дорисовывать колесо.
 *
 * Run: node tests/roulette-15-slots-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const screenSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-roulette-screen.js'), 'utf-8'
);
const orchSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-roulette.js'), 'utf-8'
);

console.log('\nTest 1: SLOTS содержит 15 наград (не 16), "+3000 сигарет" убрана из пула');
{
    const m = screenSrc.match(/proto\._resolveRouletteNewScreen = function\(idx, isJack\)\{const SLOTS = \[([\s\S]*?)\];/) ||
              screenSrc.match(/const SLOTS = \[([\s\S]*?)\];\s*\n\s*const slot = SLOTS\[idx\];/);
    assert(!!m, 'SLOTS массив найден в _resolveRouletteNewScreen');
    if (m) {
        const body = m[1];
        const entries = body.match(/\{lbl:/g) || [];
        assert(entries.length === 15, `SLOTS содержит ровно 15 записей (нашёл ${entries.length})`);
        assert(!/\+3000 сигарет/.test(body), '"+3000 сигарет" удалена из пула наград');
        assert(/СУПЕРПРИЗ!/.test(body), 'СУПЕРПРИЗ на месте (сдвинулся с индекса 13 на 12)');
    }
}

console.log('\nTest 2: _animRouletteWheel использует SEG=24 (360/15), не 22.5 (360/16)');
{
    assert(/const SEG = 24;/.test(screenSrc), 'SEG = 24 (реальный шаг физического сектора)');
    assert(!/const SEG = 22\.5;/.test(screenSrc), 'старое значение 22.5 (под несуществующие 16 секторов) убрано');
}

// 23.09.2026 (перенос награды обычного спина на сервер, аудит "что ещё не на сервере" —
// см. roulette.php.spin()/_rollSlot()): выбор slotIdx (джекпот=12, иначе 0-14 равновероятно
// исключая 12/0) переехал 1-в-1 на сервер — та же логика, что тестировалась здесь для клиента,
// теперь проверяется в _rollSlot() (server/core/controllers/roulette.php).
console.log('\nTest 3: roulette.php._rollSlot() выбирает индекс 0-14, СУПЕРПРИЗ = 12 (логика перенесена с клиента на сервер)');
{
    const rouletteSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');
    // 25.09.2026 (дев-форс комбинаций казино, другая сессия): добавлен параметр $forceIdx —
    // сигнатура и regex ниже обновлены под него.
    const m = rouletteSrc.match(/private function _rollSlot\(\$jackpot, \$keyringAvailable, &\$user, &\$trace = null, \$forceIdx = null\)\{([\s\S]*?)\r?\n    \}/);
    assert(!!m, '_rollSlot найден в roulette.php');
    if (m) {
        const body = m[1];
        assert(/\$idx = 12;/.test(body), 'джекпот теперь ведёт на индекс 12 (был 13)');
        assert(/mt_rand\(0, 14\)/.test(body), 'случайный индекс в диапазоне 0-14 (15 слотов), не 0-15');
        assert(/\$idx === 12 \|\| \$idx === 0/.test(body), 'исключает СУПЕРПРИЗ (12) и "не выпадает" (0) из обычного спина');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
