/**
 * Test: два фикса экрана боя с боссом (bosses_fight.js).
 *
 * Баг 1 — иконка "купить хабар" не обновлялась после покупки:
 *   habar.js открывается ПОВЕРХ экрана боя (root.layer2_mc.addChild), покупка происходит
 *   там же, а видимость _bossFightHabarBtn/_bossFightSidBtn выставляется только внутри
 *   _updateBossesFight(), который вызывается лишь при (пере)открытии боя — НЕ при закрытии
 *   оверлея хабара. Игрок покупал хабар, закрывал оверлей — иконка "не куплен хабар"
 *   продолжала висеть поверх автомата, и урон "Седым" был недоступен без полного
 *   перезахода в боссфайт.
 *   Фикс: bosses_fight.js добавляет proto._refreshBossFightHabarBtn() на Interface.prototype
 *   (attachBossesFight подключается именно к Interface, см. interface.js). habar.js.close()
 *   изначально вызывал bosses._refreshBossFightHabarBtn() — метода на bosses НИКОГДА не было,
 *   поэтому `typeof === 'function'` тихо проваливался и обновление не срабатывало вообще.
 *   Исправлено на iface._refreshBossFightHabarBtn().
 *
 * Баг 2 — блок "ОЧКИ / НОВЫЕ" в правом нижнем углу боя показывал не то:
 *   _updateBossFightStats() присваивал ptsTxt/newTxt значения skills._xp / skills._xpNext —
 *   это прогресс урона ДО следующего очка (те же числа, что и на полоске прогресса рядом),
 *   а не реальные очки скиллов. По требованию: "ОЧКИ" — уже вложенные (потраченные) очки,
 *   "НОВЫЕ" — заработанные, но ещё не потраченные (доступные к вложению).
 *   Фикс: ptsTxt ← skills.spentPoints, newTxt ← skills.availablePoints.
 *
 * Run: node tests/bossfight-habar-and-skillpoints.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const bossFightSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8'
);
const habarSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'habar.js'), 'utf-8'
);

// ── Test 1: _refreshBossFightHabarBtn существует и пересчитывает обе кнопки ──
console.log('\nTest 1: proto._refreshBossFightHabarBtn пересчитывает видимость по habar_bought');
{
    const m = bossFightSrc.match(/proto\._refreshBossFightHabarBtn = function\(\)\{([\s\S]*?)\n\s*\};/);
    assert(!!m, '_refreshBossFightHabarBtn найден в bosses_fight.js');
    if (m) {
        const body = m[1];
        assert(/habarPurchased\s*=\s*parseInt\(udata && udata\['habar_bought'\] \|\| 0\) > 0/.test(body),
            'считает habarPurchased из udata[\'habar_bought\']');
        assert(/_bossFightHabarBtn\.visible\s*=\s*!habarPurchased/.test(body),
            'кнопка "купить хабар" скрывается, когда хабар куплен');
        assert(/_bossFightSidBtn\.visible\s*=\s*habarPurchased/.test(body),
            'кнопка "Седой" показывается, когда хабар куплен');
    }
}

// ── Test 2: habar.close() вызывает iface._refreshBossFightHabarBtn() ──────
console.log('\nTest 2: habar.js close() триггерит обновление кнопки на экране боя (через iface, не bosses)');
{
    const closeMatch = habarSrc.match(/close\(\)\{([\s\S]*?)\n\s{4}\}/);
    assert(!!closeMatch, 'close() найден в habar.js');
    if (closeMatch) {
        assert(/iface\._refreshBossFightHabarBtn\(\)/.test(closeMatch[1]),
            'close() вызывает iface._refreshBossFightHabarBtn() — метод живёт на Interface.prototype');
        assert(!/bosses\._refreshBossFightHabarBtn/.test(closeMatch[1]),
            'больше НЕТ вызова bosses._refreshBossFightHabarBtn() — такого метода на bosses никогда не было (мёртвый вызов)');
    }
}

// ── Test 3: _updateBossFightStats больше не путает XP-прогресс с очками ───
console.log('\nTest 3: _updateBossFightStats — ОЧКИ/НОВЫЕ используют spentPoints/availablePoints');
{
    const m = bossFightSrc.match(/proto\._updateBossFightStats = function\(\)\{([\s\S]*?)\n\s*\};/);
    assert(!!m, '_updateBossFightStats найден в bosses_fight.js');
    if (m) {
        const body = m[1];
        assert(/_bossFightPtsTxt\.text\s*=\s*window\.skills \? String\(skills\.spentPoints \|\| 0\)/.test(body),
            'ОЧКИ (_bossFightPtsTxt) читает skills.spentPoints (уже вложенные)');
        // 20.09.2026: промежуточная переменная newText убрана вместе с ручным сдвигом x по числу
        // цифр (текст теперь центрируется подложкой-фоном, см. boss-fight-points-badges-centered-text.test.js) —
        // значение присваивается напрямую одной строкой.
        assert(/_bossFightNewTxt\.text = window\.skills \? String\(skills\.availablePoints \|\| 0\) : '—';/.test(body),
            'НОВЫЕ (_bossFightNewTxt) читает skills.availablePoints (доступные, не вложенные)');
        assert(!/_bossFightPtsTxt\.text\s*=\s*window\.skills \? String\(skills\._xp/.test(body),
            'ОЧКИ больше НЕ переиспользует skills._xp (прогресс-бар урона)');
        assert(!/_bossFightNewTxt\.text\s*=\s*window\.skills \? String\(skills\._xpNext/.test(body),
            'НОВЫЕ больше НЕ переиспользует skills._xpNext (прогресс-бар урона)');
        // Прогресс-бар снизу — отдельная сущность, она ДОЛЖНА остаться на _xp/_xpNext
        assert(/const cur = skills\._xp \|\| 0; const next = skills\._xpNext \|\| 100;/.test(body),
            'полоска прогресса урона (cur/next) по-прежнему использует _xp/_xpNext — это не трогали');
    }
}

// ── Test 4: семантика spentPoints/availablePoints на реальной формуле skills.js ──
console.log('\nTest 4: spentPoints = вложенные, availablePoints = заработанные минус вложенные');
{
    // Мини-копия геттеров из skills.js (levels[0] — бесплатный скилл, не считается в spentPoints)
    function calcPoints(totalDmg, totalDmgForPoints) {
        if (totalDmg <= 0) return 0;
        let lo = 0, hi = 460;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (totalDmgForPoints(mid) <= totalDmg) lo = mid; else hi = mid - 1;
        }
        return lo;
    }
    const totalDmgForPoints = n => n <= 0 ? 0 : n * 1000 + Math.floor(185 * n * (n - 1) / 2);

    const levels = new Array(20).fill(0);
    levels[0] = 3;  // бесплатный скилл — не считается в spentPoints
    levels[5] = 2;
    levels[9] = 1;
    const spentPoints = levels.reduce((s, v, i) => i === 0 ? s : s + v, 0); // = 3

    const skillsDmgSpent = totalDmgForPoints(5); // ровно 5 заработанных очков
    const earnedPoints = calcPoints(skillsDmgSpent, totalDmgForPoints);
    const availablePoints = Math.max(0, earnedPoints - spentPoints);

    assert(spentPoints === 3, `spentPoints игнорирует levels[0] и суммирует остальные, получили ${spentPoints}`);
    assert(earnedPoints === 5, `earnedPoints рассчитан из урона, получили ${earnedPoints}`);
    assert(availablePoints === 2, `availablePoints = earned(5) - spent(3) = 2, получили ${availablePoints}`);
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
