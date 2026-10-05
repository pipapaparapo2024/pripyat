/**
 * Test: пул "урон Седого" (тип награды 'damage') раньше складывался с уже имеющимся при
 * каждом сборе хабара (total += r.amount; left += r.amount) — при повторных сборах total/left
 * росли бы неограниченно. По прямому указанию: сбор хабара должен ПОЛНОСТЬЮ ПЕРЕЗАПОЛНЯТЬ пул
 * до максимума из уже полученного/нового, а не накапливать поверх — например было 450к/500к
 * (уже потрачено 50к), после сбора хабара должно стать 500к/500к (полный рефилл, а не 950к/1000к).
 *
 * 24.09.2026 (перенос экономики хабара на сервер): логика перенесена 1-в-1 из habar.js
 * (клиент больше switch/case с наградами не считает вообще) в habar.php — та же формула
 * max(total, amount), тот же рефилл total И left, просто теперь на сервере.
 *
 * Run: node tests/sedoy-damage-refill-not-stack.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const habarJs = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'habar.js'), 'utf-8'
);
const src = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'core', 'controllers', 'habar.php'), 'utf-8'
);

console.log('\nTest 0: регресс-гвард — клиент больше не считает награды сам (switch/case убран целиком)');
{
    assert(!/case 'damage':/.test(habarJs), "habar.js не содержит case 'damage' — вся логика наград на сервере");
}

console.log('\nTest 1: сбор хабара с наградой type=\'damage\' (habar.php) — рефилл до максимума, не накопление');
{
    const m = src.match(/\} else if\(\$type === 'damage'\)\{([\s\S]*?)\n\s{12}\}/);
    assert(!!m, 'ветка else if($type === \'damage\') найдена в habar.php');
    if (m) {
        const body = m[1];
        assert(!/sedoy_dmg_total'\]\s*\+=/.test(body), 'старая аддитивная формула (total += amount) отсутствует');
        // 05.10.2026 (стале-пин, не регрессия — блокировка строки в collectDay(), $lockedUser вместо $user).
        assert(/\$sedoyMax = max\(\$this->ops->i\(\$lockedUser, 'sedoy_dmg_total'\), \$amount\);/.test(body),
            'новый максимум = max(текущий total, новая награда)');
        assert(/\$lockedUser\['sedoy_dmg_total'\] = \$sedoyMax;/.test(body), 'total устанавливается в sedoyMax (не складывается)');
        assert(/\$lockedUser\['sedoy_dmg_left'\]\s*= \$sedoyMax;/.test(body),
            'left тоже полностью рефиллится до sedoyMax (использованное ранее сгорает — полный рефилл)');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
