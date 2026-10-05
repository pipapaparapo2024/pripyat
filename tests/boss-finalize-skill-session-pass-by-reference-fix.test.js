/**
 * Test: батч 23.09.2026 (по прямому указанию, повторный репорт после вчерашнего фикса крестика
 * — "опыт скиллов всё равно сохраняется после победы над боссом, независимо от того, как
 * закончился бой").
 *
 * НАСТОЯЩАЯ причина (найдена только тогда, вчерашний фикс крестика был правильным, но не мог
 * сработать без этого): `_finalizeSkillSession($user)` в server/core/controllers/bosses.php
 * была объявлена БЕЗ `&$user` — PHP-массивы передаются по значению, значит функция всё это
 * время мутировала только СВОЮ ЛОКАЛЬНУЮ КОПИЮ параметра. Комментарий над функцией прямо
 * утверждал "Мутирует $user['skills_levels'] НА МЕСТЕ" — это было неправдой с первого дня.
 * Фикс тогда — добавить `&$user`, мутировать по ссылке.
 *
 * 04.10.2026 (КОНТРАКТ ИЗМЕНИЛСЯ ЕЩЁ РАЗ — аудит гонок состояний, НЕ регресс сегодняшнего
 * фикса): функция снова принимает $user ПО ЗНАЧЕНИЮ, но теперь ПОТОМУ ЧТО она больше не
 * мутирует $user вообще — она сама лочит строку (SELECT...FOR UPDATE на skills_levels),
 * пишет результат ОТДЕЛЬНЫМ UPDATE, и возвращает вызывающему коду массив {json, locked}.
 * Это НЕ возврат к старому багу 23.09.2026 (там функция ТИХО теряла результат, никак не
 * сигнализируя об этом) — теперь контракт явный: вызывающий код (claimKill()/
 * endFightSession()) ОБЯЗАН присвоить $user['skills_levels'] = $skillsResult['json'] САМ,
 * причём ДО своего saveUser(), если locked:false (лока не было — иначе результат потеряется),
 * и может отложить это ПОСЛЕ saveUser(), если locked:true (уже записано отдельным UPDATE).
 * Причина смены контракта — без собственного лока функция была бы той же гонкой, что уже
 * чинили для weapons/ryukzak_points в этом же батче (параллельный attack()/skills.upgrade()
 * мог затереть результат друг друга).
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

console.log('\nTest 1: _finalizeSkillSession() принимает $user ПО ЗНАЧЕНИЮ (04.10.2026 — больше не мутирует его, лочит и возвращает {json,locked})');
{
    assert(/private function _finalizeSkillSession\(\$user\)\{/.test(bossesPhp),
        'сигнатура — private function _finalizeSkillSession($user){ — БЕЗ амперсанда (сознательно, см. докблок)');
    assert(!/private function _finalizeSkillSession\(&\$user\)\{/.test(bossesPhp),
        'старая (23.09.2026) сигнатура по ссылке отсутствует — контракт сменился на возврат значения');
}

console.log('\nTest 2: регресс-гвард — сама логика финализации (обнуление до пола earned-очков) не задета фиксом 04.10.2026');
{
    const start = bossesPhp.indexOf('private function _finalizeSkillSession($user){');
    assert(start > -1, '_finalizeSkillSession найдена');
    const body = bossesPhp.slice(start, bossesPhp.indexOf('\n        }\n', start));
    assert(/\$earned = \$this->_skillEarnedPoints\(\$sCatalog, intval\(\$state\['dmgSpent'\]\)\);/.test(body),
        'считает earned-очки из ТЕКУЩЕГО dmgSpent (как и раньше) — встречается в обеих ветках (лок/фолбэк)');
    assert(/\$state\['dmgSpent'\] = \$this->_skillTotalDmgForPoints\(\$sCatalog, \$earned\);/.test(body),
        'откатывает dmgSpent до точного пола earned-очков (как и раньше)');
    assert(/return \['json' => \$json, 'locked' => true\];/.test(body), 'залоченная ветка возвращает locked:true');
    assert(/return \['json' => json_encode\(\$state\), 'locked' => false\];/.test(body), 'фолбэк-ветка возвращает locked:false');
}

console.log('\nTest 3: регресс-гвард — оба вызывающих места (claimKill/endFightSession) явно обрабатывают {json,locked}, не полагаются на мутацию по ссылке');
{
    const claimStart = bossesPhp.indexOf('function claimKill(){');
    const claimEnd = bossesPhp.indexOf('function endFightSession', claimStart);
    const claimBody = bossesPhp.slice(claimStart, claimEnd);
    assert(/\$skillsResult = \$this->_finalizeSkillSession\(\$user\);/.test(claimBody), 'claimKill() сохраняет возврат в $skillsResult (НЕ игнорирует его, как было бы при pass-by-reference)');
    assert(/if\(!\$skillsResult\['locked'\]\) \$user\['skills_levels'\] = \$skillsResult\['json'\];/.test(claimBody), 'claimKill() присваивает ДО save ТОЛЬКО если не залочено');
    assert(/if\(!\$this->ops->saveUser\(\$user\)\) return \$this->ops->fail\(99\);/.test(claimBody), 'claimKill() сохраняет $user сразу после финализации');

    const endStart = bossesPhp.indexOf('function endFightSession(){');
    const endBody = bossesPhp.slice(endStart, bossesPhp.indexOf('function attack(', endStart));
    assert(/\$skillsResult = \$this->_finalizeSkillSession\(\$user\);/.test(endBody), 'endFightSession() тоже сохраняет возврат в $skillsResult');
    assert(/if\(!\$skillsResult\['locked'\]\) \$user\['skills_levels'\] = \$skillsResult\['json'\];/.test(endBody), 'endFightSession() присваивает ДО save ТОЛЬКО если не залочено');
}

console.log('\nTest 4: регресс-гвард — ни у одной ДРУГОЙ private-функции этого файла нет ложной заявки "мутирует $user на месте" без &$user');
{
    const otherPrivateFns = [...bossesPhp.matchAll(/private function (\w+)\(([^)]*)\)\{/g)]
        .filter(m => m[1] !== '_finalizeSkillSession' && /\$user\b/.test(m[2]) && !/&\$user/.test(m[2]));
    // Эти функции корректно pass-by-value — они только ЧИТАЮТ $user, не заявляют мутацию.
    // 24.09.2026: _loadFightSession($user) добавлена (кэш HP боя, см. большой комментарий над
    // _syncFightSession()) — тоже чисто читающая ($this->ops->j($user, 'boss_fight_session', ...)),
    // безопасно добавлена в тот же список.
    // 04.10.2026: _finalizeSkillSession сама теперь в этом списке (исключена явно через filter
    // выше — её контракт описан отдельно в Test 1-3, а не тут, где проверяются ОСТАЛЬНЫЕ функции).
    const readOnlyOk = ['_gangBonus', '_friendIds', '_isLocCleared', '_loadWeaponsLocal', '_loadSkillsState', '_loadFightSession'];
    const unexpected = otherPrivateFns.filter(m => !readOnlyOk.includes(m[1]));
    assert(unexpected.length === 0,
        'нет НЕОЖИДАННЫХ private-функций с $user по значению (' + unexpected.map(m=>m[1]).join(',') + ') — если новая появится и должна мутировать $user, не забыть &');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
