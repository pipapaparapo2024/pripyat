/**
 * Test: 03.10.2026 (репорт игрока — "у меня висит 1 автомат, по факту его у меня нет, либо я
 * им не могу воспользоваться. Проверь значения отображения имеющегося оружия").
 *
 * Корень: weapons.js._renderStatus() считал отображаемое число патронов так:
 *   const qty = parseInt(wp.qty || 0) || (wp.owned ? 1 : 0);
 * Классическая ловушка `||` с нулём — когда патроны РЕАЛЬНО закончились (wp.qty === 0, явный
 * ноль, не "ещё не задано"), `wp.qty || 0` даёт 0, `parseInt(0)` тоже 0, а 0 в JS falsy, поэтому
 * выражение проваливалось в правую часть `(wp.owned ? 1 : 0)`. owned остаётся true навсегда с
 * момента первого получения оружия (weapons.js._loadFromUdata() никогда не сбрасывает его
 * обратно при qty=0 — это по замыслу) — в итоге оружейка ПОКАЗЫВАЛА игроку "1", хотя патронов
 * реально 0, а бой (_attackWithWeapon()/_attack() в bosses_fight.js/bosses-combat.js, которые
 * читают wp.qty НАПРЯМУЮ, без этой же ошибки) честно отказывал как "нет оружия" — расхождение
 * между тем, что видел игрок, и тем, что реально происходило в бою.
 *
 * Фикс: различать "qty явно задан (в т.ч. 0)" и "qty ещё не задан вовсе" (undefined/null, старые
 * аккаунты без миграции) — легаси-фолбэк "owned без qty ⇒ считать за 1" применяется только во
 * втором случае.
 *
 * Run: node tests/weapons-stock-zero-qty-falsy-fallback-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'weapons.js'), 'utf-8');

console.log('\nTest 1: старая ловушка `||` с нулём убрана из _renderStatus()');
{
    assert(!/const qty = parseInt\(wp\.qty \|\| 0\) \|\| \(wp\.owned \? 1 : 0\);/.test(src),
        'старое выражение (0 патронов молча превращался в "1" при owned=true) больше не используется');
    assert(/const qty = \(wp\.qty !== undefined && wp\.qty !== null\) \? \(parseInt\(wp\.qty\) \|\| 0\) : \(wp\.owned \? 1 : 0\);/.test(src),
        'новое выражение явно отличает "qty=0" от "qty не задан" — легаси-фолбэк применяется только во втором случае');
}

console.log('\nTest 2: поведение — симуляция реальных значений, которые видит _renderStatus()');
{
    // Та же формула, что в src — проверяем её логически, не гоняя PIXI/весь класс.
    const computeQty = (wp) => (wp.qty !== undefined && wp.qty !== null) ? (parseInt(wp.qty) || 0) : (wp.owned ? 1 : 0);

    assert(computeQty({owned: true, qty: 0}) === 0,
        'owned=true, qty=0 (реально кончились патроны) — отображается 0, не 1 (это и был баг)');
    assert(computeQty({owned: true, qty: 5}) === 5,
        'owned=true, qty=5 — отображается реальное число 5');
    assert(computeQty({owned: true, qty: undefined}) === 1,
        'owned=true, qty не задан (легаси-аккаунт без миграции) — легаси-фолбэк 1, как и раньше');
    assert(computeQty({owned: false, qty: undefined}) === 0,
        'owned=false, qty не задан — 0 (оружие не куплено)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
