/**
 * Test: три фикса боя с боссом, связанные со скиллами/энергией.
 *
 * Баг 1 — шрифт числа "cur/next" внутри оранжевой полоски прогресса скиллов был мелкий
 *   (fontSize 13). По просьбе — увеличить на 3px.
 *
 * Баг 2 — когда все 460 очков скиллов заработаны (~20кк урона), skills._xp/_xpNext
 *   специально обнуляются в getter'ах (_xp=0, _xpNext=1) — из-за этого полоска в бою
 *   рисовалась ПУСТОЙ и показывала "0/1" вместо явного "МАКС" с полной полосой.
 *   Также addFightDamage() бесконечно копил skillsDmgSpent сверх кап-порога без всякого
 *   смысла (дальше урон "бьётся в пустую" — не должен ничего копить).
 *
 * Баг 3 — атака босса тратила 5 энергии за удар (TIMERS.spendEnergy) и блокировала
 *   атаку при нехватке энергии. По требованию — нанесение урона энергию не тратит.
 *
 * Run: node tests/bossfight-skillcap-and-energy.test.js
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
const skillsSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'skills.js'), 'utf-8'
);
const combatSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8'
);

// ── Test 1: шрифт "cur/next" внутри полоски увеличен на 3px (13 → 16), затем ──
// 08.10.2026 (фикс пикселизации текста): 16×scale(1.186) заменены на итоговый fontSize:19
// без scale — та же видимая величина, что раньше давали 16+scale, но не размытая.
console.log('\nTest 1: progTxt (число внутри оранжевой полоски) — fontSize 19 (16×1.186, без scale)');
{
    const m = bossFightSrc.match(/const progTxt = new PIXI\.Text\('0\/0', \{([\s\S]*?)\}\);/);
    assert(!!m, 'progTxt найден');
    if (m) {
        assert(/fontSize:19/.test(m[1]), 'fontSize увеличен до 19 (16×1.186), не через scale');
    }
    assert(!/progTxt\.scale\.set\(/.test(bossFightSrc), 'scale.set() для progTxt больше не вызывается');
}

// ── Test 2: при заполненных 460 очках полоска показывает МАКС и полностью залита ──
console.log('\nTest 2: _updateBossFightStats — maxed-состояние (460/460 очков) рисует полную полосу');
{
    const m = bossFightSrc.match(/proto\._updateBossFightStats = function\(\)\{([\s\S]*?)\n\s*\};/);
    assert(!!m, '_updateBossFightStats найден');
    if (m) {
        const body = m[1];
        assert(/const maxed = skills\.earnedPoints >= 460;/.test(body),
            'вычисляется maxed = earnedPoints >= 460');
        assert(/this\._bossFightProgTxt\.text = maxed \? 'МАКС' : \(cur \+ '\/' \+ next\);/.test(body),
            'текст — "МАКС" вместо "0/1" когда всё заработано');
        assert(/const pct = maxed \? 1 : \(next > 0 \? Math\.min\(1, cur \/ next\) : 0\);/.test(body),
            'pct принудительно = 1 (полная полоса) в maxed-состоянии');
    }
}

// ── Test 3: addFightDamage() не копит урон сверх 460 очков ───────────────────
console.log('\nTest 3: skills.addFightDamage() останавливает накопление после 460 очков');
{
    const m = skillsSrc.match(/addFightDamage\(dmg\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'addFightDamage найден');
    if (m) {
        const body = m[1];
        assert(/if\(this\.earnedPoints >= 460\) return;/.test(body),
            'ранний return при earnedPoints >= 460 — доп.урон дальше не копится');
    }
}

// ── Test 4: атака босса больше не тратит и не проверяет энергию ──────────────
console.log('\nTest 4: bosses-combat.js._attack() не расходует энергию на удар');
{
    assert(!/TIMERS\.spendEnergy/.test(combatSrc), 'TIMERS.spendEnergy не вызывается в bosses-combat.js');
    assert(!/achievements\.onEnergySpent/.test(combatSrc), 'achievements.onEnergySpent не вызывается (энергия не тратится)');
    assert(!/Недостаточно энергии! Нужно/.test(combatSrc), 'попап "Недостаточно энергии" для атаки босса удалён');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
