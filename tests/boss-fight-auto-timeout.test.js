/**
 * Test: истечение таймера боя с боссом раньше НЕ приводило ни к чему само по себе — экран
 * оставался открытым как ни в чём не бывало (репорт: "время истекло, но по итогу ничего не
 * произошло"), тихий сброс HP происходил только при следующем клике АТАКОВАТЬ внутри _attack().
 *
 * Теперь: общий proto._onFightTimeout(idx) в bosses-combat.js — сбрасывает HP/таймер/сессию
 * скиллов, показывает попап "Поражение! Бой окончен, ключи потрачены." (тот же текст, что и у
 * ручного форфейта) и автоматически выводит из боя. Вызывается из ТРЁХ мест:
 *   1) _updateFightTimer (bosses-combat.js) — тик раз в секунду для легаси-экрана (this.win).
 *   2) _tickBossFightTimer (bosses_fight.js) — тик раз в секунду для активного экрана боя
 *      (заодно чинит расхождение: раньше не учитывал skills.getTimeBonus()).
 *   3) _attack() — подстраховка, если игрок кликнул АТАКОВАТЬ раньше тика таймера.
 * Идемпотентен: первый вызов сбрасывает _bossStartMs[...] в 0, повторный вызов сразу видит
 * это и ничего не делает — не важно, из какого из трёх мест он придёт.
 *
 * Run: node tests/boss-fight-auto-timeout.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const combatSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8'
);
const fightSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8'
);

console.log('\nTest 1: proto._onFightTimeout существует и делает всё необходимое');
{
    const m = combatSrc.match(/proto\._onFightTimeout = function\(idx\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_onFightTimeout найден');
    if(m){
        const body = m[1];
        assert(/if\(this\._bossStartMs\[this\._diffIdx\]\[idx\] === 0\) return;/.test(body),
            'идемпотентен — повторный вызов после первого ничего не делает');
        assert(/this\._setHp\(idx, this\._maxHp\(idx\)\);/.test(body), 'восстанавливает HP босса');
        assert(/this\._bossStartMs\[this\._diffIdx\]\[idx\] = 0;/.test(body), 'сбрасывает таймер попытки');
        assert(/if\(window\.skills\) skills\.resetSession\(\);/.test(body), 'обнуляет прогресс скиллов без левелапа (та же логика, что и победа/крестик)');
        assert(/notify\.showResult\(\{text:'Поражение! Бой окончен, ключи потрачены\.'\}, 0\);/.test(body),
            'показывает попап поражения (тот же текст, что у ручного форфейта)');
        assert(/iface\._closeBossesFight\(\);/.test(body), 'закрывает экран боя');
        assert(/iface\._openBossesPopup\(\);/.test(body), 'возвращает к выбору боссов');
    }
}

console.log('\nTest 2: _updateFightTimer (легаси-экран) вызывает _onFightTimeout при rem===0');
{
    const m = combatSrc.match(/proto\._updateFightTimer = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_updateFightTimer найден');
    if(m){
        assert(/if\(rem === 0\)\{\s*\n\s*this\._timerTxt\.text = 'Время боя вышло!';\s*\n\s*this\._onFightTimeout\(idx\);/.test(m[1]),
            'при истечении таймера вызывает _onFightTimeout (не просто меняет текст)');
    }
}

console.log('\nTest 3: _attack() делегирует истечение таймера в общий _onFightTimeout (не дублирует логику)');
{
    assert(/this\._onFightTimeout\(idx\);\s*\n\s*return;/.test(combatSrc),
        '_attack() вызывает _onFightTimeout вместо инлайн-сброса HP/сессии');
    assert(!/notify\.showResult\(\{text:'Время боя с '\+d\.name\+' вышло! HP восстановлен\.'\}/.test(combatSrc),
        'старый инлайн-текст про истечение таймера убран из _attack() (перенесён в _onFightTimeout)');
}

console.log('\nTest 4: _tickBossFightTimer (активный экран боя, bosses_fight.js) тоже вызывает _onFightTimeout');
{
    const m = fightSrc.match(/proto\._tickBossFightTimer = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_tickBossFightTimer найден');
    if(m){
        const body = m[1];
        assert(/const bonus\s*=\s*\(bosses\._fightTimeBonusMs && bosses\._fightTimeBonusMs\[di\]\) \? \(bosses\._fightTimeBonusMs\[di\]\[idx\] \|\| 0\) : 0;/.test(body),
            'учитывает ЗАМОРОЖЕННЫЙ бонус времени от скиллов (20.09.2026: живое чтение убрано — см. boss-time-skill-frozen-bonus-and-energy-check.test.js)');
        assert(/bosses\._onFightTimeout\(idx\);/.test(body), 'при remain===0 вызывает bosses._onFightTimeout');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
