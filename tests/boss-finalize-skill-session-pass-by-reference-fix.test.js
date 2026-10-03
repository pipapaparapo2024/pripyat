/**
 * Test: батч 23.09.2026 (по прямому указанию, повторный репорт после вчерашнего фикса крестика
 * — "опыт скиллов всё равно сохраняется после победы над боссом, независимо от того, как
 * закончился бой").
 *
 * НАСТОЯЩАЯ причина (найдена только сейчас, вчерашний фикс крестика был правильным, но не мог
 * сработать без этого): `_finalizeSkillSession($user)` в server/core/controllers/bosses.php
 * была объявлена БЕЗ `&$user` — PHP-массивы передаются по значению, значит функция все это
 * время мутировала только СВОЮ ЛОКАЛЬНУЮ КОПИЮ параметра. Комментарий над функцией прямо
 * утверждал "Мутирует $user['skills_levels'] НА МЕСТЕ" — это было неправдой с первого дня.
 * И claimKill() (победа), и endFightSession() (таймаут/форфейт/крестик) вызывали её как
 * `$this->_finalizeSkillSession($user);` (без переприсвоения результата) и сразу
 * `$this->ops->saveUser($user)` — сохраняя АБСОЛЮТНО НЕТРОНУТЫЙ оригинал. Обнуление прогресса
 * до следующего очка скилла было no-op для ВСЕХ 4 путей выхода из боя с самого начала.
 *
 * Run: node tests/boss-finalize-skill-session-pass-by-reference-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bossesPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');

console.log('\nTest 1: _finalizeSkillSession() принимает $user ПО ССЫЛКЕ (критично — без этого функция no-op)');
{
    assert(/private function _finalizeSkillSession\(&\$user\)\{/.test(bossesPhp),
        'КРИТИЧНО: сигнатура — private function _finalizeSkillSession(&$user){ — с амперсандом');
    assert(!/private function _finalizeSkillSession\(\$user\)\{/.test(bossesPhp),
        'старая сигнатура без & отсутствует (регресс-гвард — легко случайно вернуть при рефакторинге)');
}

console.log('\nTest 2: регресс-гвард — сама логика финализации (обнуление до пола earned-очков) не задета этим фиксом');
{
    const m = bossesPhp.match(/private function _finalizeSkillSession\(&\$user\)\{([\s\S]*?)\n        \}/);
    assert(!!m, '_finalizeSkillSession найдена');
    const body = m ? m[1] : '';
    assert(/\$earned = \$this->_skillEarnedPoints\(\$sCatalog, intval\(\$state\['dmgSpent'\]\)\);/.test(body),
        'считает earned-очки из ТЕКУЩЕГО dmgSpent (как и раньше)');
    assert(/\$state\['dmgSpent'\] = \$this->_skillTotalDmgForPoints\(\$sCatalog, \$earned\);/.test(body),
        'откатывает dmgSpent до точного пола earned-очков (как и раньше)');
    assert(/\$user\['skills_levels'\] = json_encode\(\$state\);/.test(body),
        'записывает результат в $user[\'skills_levels\'] — теперь это реально видно вызывающему коду');
}

console.log('\nTest 3: регресс-гвард — оба вызывающих места (claimKill/endFightSession) вызывают её без переприсвоения результата (и теперь это корректно благодаря &)');
{
    const claimMatch = bossesPhp.match(/function claimKill\(\)\{([\s\S]*?)\n        \}/);
    assert(!!claimMatch, 'claimKill() найдена');
    assert(/\$this->_finalizeSkillSession\(\$user\);/.test(claimMatch[1]), 'claimKill() вызывает _finalizeSkillSession($user) без переприсвоения (корректно — теперь по ссылке)');
    assert(/if\(!\$this->ops->saveUser\(\$user\)\) return \$this->ops->fail\(99\);/.test(claimMatch[1]), 'claimKill() сохраняет $user сразу после финализации');

    const endMatch = bossesPhp.match(/function endFightSession\(\)\{([\s\S]*?)\n        \}/);
    assert(!!endMatch, 'endFightSession() найдена');
    assert(/\$this->_finalizeSkillSession\(\$user\);/.test(endMatch[1]), 'endFightSession() вызывает _finalizeSkillSession($user) без переприсвоения');
}

console.log('\nTest 4: регресс-гвард — ни у одной другой private-функции этого файла нет той же ложной заявки "мутирует на месте" без &$user (проверено при аудите этого фикса, фиксируем найденное состояние)');
{
    const otherPrivateFns = [...bossesPhp.matchAll(/private function (\w+)\(([^)]*)\)\{/g)]
        .filter(m => m[1] !== '_finalizeSkillSession' && /\$user\b/.test(m[2]) && !/&\$user/.test(m[2]));
    // Эти функции корректно pass-by-value — они только ЧИТАЮТ $user, не заявляют мутацию.
    // 24.09.2026: _loadFightSession($user) добавлена (кэш HP боя, см. большой комментарий над
    // _syncFightSession()) — тоже чисто читающая ($this->ops->j($user, 'boss_fight_session', ...)),
    // безопасно добавлена в тот же список.
    const readOnlyOk = ['_gangBonus', '_friendIds', '_isLocCleared', '_loadWeaponsLocal', '_loadSkillsState', '_loadFightSession'];
    const unexpected = otherPrivateFns.filter(m => !readOnlyOk.includes(m[1]));
    assert(unexpected.length === 0,
        'нет НЕОЖИДАННЫХ private-функций с $user по значению (' + unexpected.map(m=>m[1]).join(',') + ') — если новая появится и должна мутировать $user, не забыть &');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
