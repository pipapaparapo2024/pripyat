/**
 * Test: батч 15.09.2026 —
 *  1) bosses-combat.js — рейтинг bossDamage копит пожизненную сумму ПОЛНОГО урона
 *     (damage), а не максимум одного цикла и не dealt (обрезанный остатком HP босса).
 *  2) bosses_fight.js — при старте НОВОГО боя (_openBossesFight, ветка "ещё не начат")
 *     теперь явно вызывается skills.beginSession() — раньше это происходило только внутри
 *     bosses._attack() по условию "_bossStartMs===0", но _openBossesFight уже проставлял
 *     _bossStartMs ДО первой атаки, поэтому beginSession() никогда не срабатывал по
 *     основному игровому пути. Из-за этого skills._sessionStartPoints навсегда застревал на
 *     0, и как только игрок зарабатывал хотя бы одно очко скилла, проверка "leveled" в
 *     skills._endSession() была ВСЕГДА true — остаток опыта скиллов никогда не обнулялся
 *     между боями (репорт: "победил босса, в новом бою снова те же 415 опыта").
 *
 * Run: node tests/boss-rating-and-skill-session-reset.test.js
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

console.log('\nTest 1: рейтинг урона пожизненно суммирует полный damage (22.09.2026 — расчёт переехал на сервер)');
{
    // Копирование урона (curCycleDmg/bossDamage/personalDamageTotal) переехало из
    // bosses-combat.js в bosses.php.attack() целиком — см.
    // boss-attack-server-authoritative-and-timing-friend-rule.test.js за полным покрытием.
    // 26.09.2026 (по прямому указанию — "оверкилл не должен обрезаться нигде, кроме самого HP
    // босса"): $dealt (обрезанный остатком HP) удалён из attack() целиком — personalDamageTotal
    // теперь тоже считается через полный $damage, тот же принцип, что уже был у bossDamage.
    const bossesPhp = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
    const start = bossesPhp.indexOf('function attack(){');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/\$data\['personalDamageTotal'\] = intval\(\$data\['personalDamageTotal'\]\) \+ \$damage;/.test(body),
        'personalDamageTotal считается через полный $damage (не через обрезанный dealt)');
    assert(/\$data\['bossDamage'\]\[\$bossId\] = intval\(\$data\['bossDamage'\]\[\$bossId\]\) \+ \$damage;/.test(body),
        'bossDamage += $damage (полный урон удара, не ограниченный остатком HP — тот же принцип теперь у всех пожизненных метрик)');
}

console.log('\nTest 2: skills.beginSession() вызывается при реальном старте нового боя в bosses_fight.js');
{
    // 17.09.2026: старт нового боя теперь идёт через сервер (bosses.startFight,
    // ответ на вопрос "таймер боя тоже на клиенте?") — bossStartMs больше не пишется
    // локальным Date.now(), а приходит из ответа сервера (res.bossStartMs), и
    // skills.beginSession() вызывается уже ВНУТРИ колбэка успеха, а не синхронно.
    const startIdx = fightSrc.indexOf('if(!bosses._bossStartMs[di][bossIdx]){');
    assert(startIdx !== -1, 'блок "новый бой ещё не начат" найден в _openBossesFight');
    const endIdx = fightSrc.indexOf("return; // экран откроется в колбэке успеха", startIdx);
    assert(endIdx !== -1, 'конец блока "новый бой ещё не начат" найден');
    const block = fightSrc.slice(startIdx, endIdx);
    assert(/bosses\.startFight/.test(block), 'блок вызывает bosses.startFight (сервер сам пишет bossStartMs)');
    assert(/skills\.beginSession\(\);/.test(block), 'skills.beginSession() вызывается внутри этого блока (в колбэке успеха)');
    assert(/bosses\._bossStartMs\[di\]\[bossIdx\] = res\.bossStartMs;/.test(block),
        '_bossStartMs проставляется из СЕРВЕРНОГО ответа (res.bossStartMs), не из локального Date.now()');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
