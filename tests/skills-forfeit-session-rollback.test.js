/**
 * Test: полоска опыта скиллов (напр. «1000/1185») и выход из боя с боссом.
 *
 * ИСТОРИЯ: раньше здесь тестировался частичный откат — при форфейте («ВЫЙТИ ИЗ БОЯ»)
 * откатывался только урон ИМЕННО этой попытки (this._sessionDmgSpent), а обычный выход
 * (крестик) и победа засчитывали прогресс насовсем, даже если новый уровень скилла так
 * и не был получен.
 *
 * НОВАЯ ЛОГИКА (по явной просьбе пользователя): независимо от причины выхода из боя
 * (победа / поражение-форфейт / крестик / истёк таймер боя) — если за эту попытку НЕ
 * был получен ни один новый уровень скилла, прогресс до следующего уровня полностью
 * ОБНУЛЯЕТСЯ (а не просто откатывается урон именно этой попытки — раньше могло остаться,
 * например, 400/1185 от предыдущих незавершённых попыток). Если левелап случился —
 * прогресс остаётся как есть.
 *
 * Run: node tests/skills-forfeit-session-rollback.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const skillsSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'skills.js'), 'utf-8'
);
const fightSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8'
);
const combatSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8'
);

console.log('\nTest 1: skills.js — addFightDamage копит _sessionDmgSpent параллельно skillsDmgSpent');
{
    assert(/this\._sessionDmgSpent = 0;/.test(skillsSrc), '_sessionDmgSpent инициализирован в конструкторе');
    const m = skillsSrc.match(/addFightDamage\(dmg\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'addFightDamage найден');
    if (m) assert(/this\._sessionDmgSpent = \(this\._sessionDmgSpent \|\| 0\) \+ dmg;/.test(m[1]),
        'урон текущей попытки копится отдельно');
}

console.log('\nTest 2: skills.js — beginSession() фиксирует стартовые очки попытки');
{
    const m = skillsSrc.match(/beginSession\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'beginSession найден');
    if (m) {
        assert(/this\._sessionDmgSpent = 0;/.test(m[1]), 'счётчик урона попытки обнуляется на старте');
        assert(/this\._sessionStartPoints = this\.earnedPoints;/.test(m[1]), 'запоминаются очки скиллов на момент старта попытки');
    }
}

console.log('\nTest 3: skills.js — _endSession() обнуляет прогресс до следующего уровня БЕЗУСЛОВНО (22.09.2026: было "только если левелапа не было", убрано по прямому указанию)');
{
    const m = skillsSrc.match(/_endSession\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, '_endSession найден');
    if (m) {
        const body = m[1];
        assert(!/const leveled = this\.earnedPoints > \(this\._sessionStartPoints \|\| 0\);/.test(body),
            'условная проверка левелапа убрана');
        assert(/this\.skillsDmgSpent = this\._totalDmgForPoints\(this\.earnedPoints\);/.test(body),
            'skillsDmgSpent безусловно откатывается до пола ТЕКУЩЕГО уровня после каждой попытки (полное обнуление прогресса, не частичный откат, даже если очко получено)');
        assert(/this\._sessionDmgSpent = 0;/.test(body), 'счётчик попытки обнуляется в любом случае');
        assert(/this\._flushSaveToUdata\(\);/.test(body), 'результат сохраняется немедленно (не ждёт debounce)');
    }
}

console.log('\nTest 4: skills.js — resetSession() и forfeitSession() оба используют _endSession() (одинаковая логика)');
{
    assert(/resetSession\(\)\{\s*\n\s*this\._endSession\(\);\s*\n\s*\}/.test(skillsSrc),
        'resetSession() (победа/крестик/таймаут) делегирует в _endSession()');
    assert(/forfeitSession\(\)\{\s*\n\s*this\._endSession\(\);\s*\n\s*\}/.test(skillsSrc),
        'forfeitSession() (поражение) тоже делегирует в _endSession() — одинаковое поведение независимо от причины выхода');
}

console.log('\nTest 5: bosses_fight.js — форфейт вызывает forfeitSession(), крестик НЕ сбрасывает сессию скиллов вообще');
{
    const forfeitBlock = fightSrc.match(/proto\._forfeitBossFight = function\(\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!forfeitBlock, '_forfeitBossFight найден');
    if (forfeitBlock) assert(/skills\.forfeitSession\(\);/.test(forfeitBlock[1]), 'форфейт проверяет левелап через forfeitSession()');

    // 24.09.2026 (РЕВЕРТ, репорт "нанёс 200 урона, скрыл бой крестиком, зашёл заново — опыт 0
    // вместо 200"): крестик закрывает только экран, бой не окончен — resetSession()/
    // endFightSession() отсюда убраны, см. boss-close-fight-finalizes-skill-session.test.js.
    const leaveBlock = fightSrc.match(/proto\._leaveBossesFight = function\(\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!leaveBlock, '_leaveBossesFight найден');
    if (leaveBlock) {
        assert(!/skills\.resetSession\(\);/.test(leaveBlock[1]), 'крестик БОЛЬШЕ не вызывает resetSession() — прогресс скиллов не обнуляется при простом скрытии экрана');
        assert(/skills\._flushSaveToUdata\(\);/.test(leaveBlock[1]), 'крестик просто сохраняет текущий (не обнулённый) прогресс');
    }
}

console.log('\nTest 6: старт попытки использует beginSession() (bosses_fight.js), победа/таймаут — resetSession() (bosses-combat.js)');
{
    // 22.09.2026: реальный старт попытки переехал целиком в bosses_fight._openBossesFight()
    // (см. hunter-habar-skills-energy-round.test.js за подробностями) — bosses-combat.js
    // больше не содержит своей копии beginSession().
    assert(/if\(window\.skills\) skills\.beginSession\(\);/.test(fightSrc),
        'начало новой попытки (bosses_fight._openBossesFight, колбэк успеха bosses.startFight) вызывает beginSession() (фиксирует стартовые очки)');
    const defeatBlock = combatSrc.match(/if\(window\.skills\)\{ skills\.endFight\(\); skills\.resetSession\(\); \}/);
    assert(!!defeatBlock, '_onDefeat (победа) вызывает endFight() и resetSession() — прогресс обнулится, только если левелапа не было');
    // Инлайн-обработка истечения таймера прямо внутри _attack() убрана — теперь и
    // _attack() (подстраховка), и оба тика таймера (_updateFightTimer здесь,
    // _tickBossFightTimer в bosses_fight.js) вызывают общий proto._onFightTimeout(idx),
    // который сам решает левелап через resetSession() — см. boss-fight-auto-timeout.test.js.
    assert(/this\._onFightTimeout\(idx\);\s*\n\s*return;/.test(combatSrc),
        '_attack() при истечении таймера делегирует в общий _onFightTimeout (тот сам вызывает resetSession)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
