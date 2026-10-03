/**
 * Test: батч 23.09.2026 — история вопроса (см. git-историю файла): крестик сначала НЕ финализировал
 * серверную сессию скиллов (баг "опыт скиллов переносится в следующий бой"), затем 23.09.2026 его
 * сделали ещё одним триггером endFightSession()/skills.resetSession(), наравне с форфейтом/таймаутом.
 *
 * 24.09.2026 — РЕВЕРТ этого решения (по прямому указанию, повторный репорт с конкретными числами):
 * "нанёс 200 урона боссу, полоска опыта восполнилась на 200, скрыл бой крестиком, главное меню,
 * снова зашёл к ТОМУ ЖЕ боссу — опыта не 200, а 0". Прогресс должен оставаться в рамках одной
 * сессии с боссом (бой физически не завершён, bossStartMs на сервере не сброшен — можно
 * продолжить) и сбрасываться ТОЛЬКО при истинном окончании боя, независимо от способа: таймаут,
 * победа, поражение (форфейт). Крестик = просто скрыть экран, а не закончить бой.
 *
 * Корень бага: crestik вызывал И skills.resetSession() (клиент, обнуляет skillsDmgSpent сразу),
 * И TS.php('bosses.endFightSession', {}) (сервер, _finalizeSkillSession() обнуляет
 * skills_levels.dmgSpent) — оба обнуляли прогресс ПОСРЕДИ ещё не оконченного боя. Раз
 * _openBossesFight() не вызывает skills.beginSession() повторно для уже идущего боя (bossStartMs
 * уже проставлен), после обнуления взяться прогрессу было неоткуда — 0 так и оставался виден.
 *
 * Run: node tests/boss-close-fight-finalizes-skill-session.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const fightSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');
const combatSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');
const bossesPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');

function block(src, startMarker, endMarker){
    const s = src.indexOf(startMarker);
    if (s === -1) return null;
    const e = src.indexOf(endMarker, s);
    return e === -1 ? null : src.slice(s, e);
}

console.log('\nTest 1: клиент — _leaveBossesFight() (обработчик крестика) НЕ финализирует сессию скиллов');
{
    const m = fightSrc.match(/proto\._leaveBossesFight = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_leaveBossesFight найден');
    const body = m ? m[1] : '';
    assert(!/skills\.resetSession\(\);/.test(body), 'крестик НЕ вызывает skills.resetSession() (не обнуляет клиентский прогресс)');
    assert(!/TS\.php\('bosses\.endFightSession'/.test(body), 'крестик НЕ вызывает bosses.endFightSession() (не обнуляет серверный skills_levels.dmgSpent)');
    assert(/bosses\._saveToUdata\(\);/.test(body), 'крестик по-прежнему сохраняет текущее состояние боя (HP/урон) как есть');
    assert(/skills\._flushSaveToUdata\(\);/.test(body), 'крестик сохраняет накопленный (НЕ обнулённый) прогресс скиллов');
}

console.log('\nTest 2: крестик НЕ ведёт себя как форфейт — HP/ключи/бой по-прежнему не сбрасываются (можно продолжить позже)');
{
    const m = fightSrc.match(/proto\._leaveBossesFight = function\(\)\{([\s\S]*?)\n    \};/);
    const body = m ? m[1] : '';
    assert(!/bosses\._setHp\(/.test(body), 'крестик не сбрасывает HP босса (в отличие от форфейта)');
    assert(!/isWin: false/.test(body), 'крестик не открывает попап поражения (в отличие от форфейта)');
}

console.log('\nTest 3: регресс-гвард — форфейт и таймаут по-прежнему зовут endFightSession() с boss_id/diff_idx (это ИСТИННЫЕ концы боя, их эта правка не трогает)');
{
    const forfeitMatch = fightSrc.match(/proto\._forfeitBossFight = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!forfeitMatch, '_forfeitBossFight найден');
    assert(/TS\.php\('bosses\.endFightSession', \{boss_id: idx, diff_idx: diffIdx\}, \(res\) => \{/.test(forfeitMatch ? forfeitMatch[1] : ''),
        'форфейт по-прежнему зовёт bosses.endFightSession()');
    assert(/skills\.forfeitSession\(\);/.test(forfeitMatch ? forfeitMatch[1] : ''), 'форфейт по-прежнему зовёт skills.forfeitSession()');

    assert(/TS\.php\('bosses\.endFightSession', \{boss_id: idx, diff_idx: diffIdxAtLoss\}, \(res\) => \{/.test(combatSrc),
        'таймаут (_onFightTimeout, bosses-combat.js) по-прежнему зовёт bosses.endFightSession()');
}

console.log('\nTest 4: регресс-гвард — победа (claimKill) по-прежнему финализирует сессию скиллов на сервере (эта правка касается только крестика)');
{
    assert(/function claimKill\(\)\{/.test(bossesPhp), 'claimKill найден');
    const claimStart = bossesPhp.indexOf('function claimKill(){');
    const claimBody  = bossesPhp.slice(claimStart, bossesPhp.indexOf('\n\t}', claimStart));
    assert(/\$this->_finalizeSkillSession\(\$user\);/.test(claimBody), 'claimKill() (победа) по-прежнему финализирует сессию скиллов');
}

console.log('\nTest 5: сервер — endFightSession() по-прежнему финализирует сессию скиллов, когда её реально вызывают (форфейт/таймаут)');
{
    const endStart = bossesPhp.indexOf('function endFightSession(){');
    const endEnd   = bossesPhp.indexOf('\n        }', endStart);
    const endBody  = bossesPhp.slice(endStart, endEnd);
    assert(/\$this->_finalizeSkillSession\(\$user\);/.test(endBody), 'endFightSession() по-прежнему финализирует сессию скиллов (для тех путей, что её реально зовут)');
    // Комментарий у функции обновлён под новую реальность — крестик её больше не вызывает.
    assert(/крестик БОЛЬШЕ не вызывает этот эндпоинт/.test(bossesPhp),
        'комментарий у endFightSession() отражает, что крестик её больше не вызывает (регресс-гвард на будущее)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
