/**
 * Test: батч 23.09.2026 (по прямому указанию, репорт "рейтинг показывает 5К урона при maxHP
 * босса 1К, босс появляется сразу без HP" + console-лог, скриншот двух аккаунтов).
 *
 * Аудит показал: server/core/controllers/bosses.php._damageSumSince() (СВОЙ урон игрока)
 * суммировала `boss_damage_log` по uid+diff_idx+`time >= sinceMs`, но НЕ фильтровала по
 * boss_id вообще — хотя колонка boss_id есть в таблице с самого её создания (migrate23.php).
 * Из-за этого СВОЙ урон, нанесённый другому боссу той же сложности после старта bossStartMs
 * ТЕКУЩЕГО боя, подмешивался в _derivedHp()/_ratingTop()/attack() текущего боя.
 *
 * ВАЖНО (уточнено пользователем в этой же сессии, AskUserQuestion): фильтр по boss_id
 * добавлен ТОЛЬКО для своего урона (_damageSumSince). Функции урона ДРУЗЕЙ
 * (_friendsDamageSumSince/_friendsDamagePerUserSince) — сознательно НЕ трогали: пользователь
 * подтвердил, что хочет сохранить фичу 22.09.2026 "друг помогает, даже если бьёт СВОЕГО
 * (другого) босса", со старым окном (вся длительность моего боя, до MAX_FIGHT_WINDOW_MS).
 * Т.е. если рейтинг снова покажет "урон друга больше maxHP" — это ИЗВЕСТНЫЙ, принятый trade-off,
 * не регресс. См. большой комментарий над _friendsDamageSumSince() в bosses.php.
 *
 * ⚠️ 30.09.2026: тесты 2/3 ниже матчили сигнатуры ДО рефакторинга 29.09.2026, который поменял
 * $friendIds (плоский список) на $friendsSince (карту uid=>effectiveSinceMs) в
 * _friendsDamageSumSince()/_friendsDamagePerUserSince() — регексы обновлены под текущий код.
 * Сам вывод теста ("друзья не скоуплены по boss_id — сознательно") не изменился.
 *
 * Run: node tests/boss-rating-hp-scoped-by-boss-id.test.js
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

console.log('\nTest 1: _damageSumSince() (СВОЙ урон) принимает boss_id и фильтрует по нему в SQL');
{
    // 29.09.2026: добавлен $excludeSedoy = false (см. tests/boss-sedoy-excluded-from-friend-
    // rating.test.js) — сигнатура выросла с 4 до 5 параметров, regex обновлён под это.
    const m = bossesPhp.match(/private function _damageSumSince\(\$link, \$uid, \$bossId, \$sinceMs, \$excludeSedoy = false\)\{([\s\S]*?)\n        \}/);
    assert(!!m, '_damageSumSince($link, $uid, $bossId, $sinceMs, $excludeSedoy) найдена с новой сигнатурой');
    const body = m ? m[1] : '';
    assert(/`boss_id`=".*intval\(\$bossId\)/.test(body), 'SQL содержит фильтр по boss_id');
}

console.log('\nTest 2: _friendsDamageSumSince()/_friendsDamagePerUserSince() (урон ДРУЗЕЙ) НЕ фильтруют по boss_id — сознательно, по прямому указанию');
{
    // 30.09.2026: сигнатура сократилась до ($link, $friendsSince) — $sinceMs больше не отдельный
    // параметр, он уже "внутри" карты (per-uid effectiveSinceMs, см. _friendsSinceMap()).
    const m1 = bossesPhp.match(/private function _friendsDamageSumSince\(\$link, \$friendsSince\)\{([\s\S]*?)\n        \}/);
    assert(!!m1, '_friendsDamageSumSince($link, $friendsSince) — сигнатура без boss_id (30.09.2026: карта вместо списка+sinceMs)');
    assert(!/`boss_id`/.test(m1 ? m1[1] : ''), 'friendsDamageSumSince SQL НЕ содержит фильтр по boss_id (кросс-боссовая помощь друга сохранена)');
    assert(/`is_sedoy`=0/.test(m1 ? m1[1] : ''), '30.09.2026: SQL исключает is_sedoy=1 — отдельный фикс, см. tests/boss-sedoy-damage-not-shared-with-friends.test.js, не связан с boss_id');

    // 29.09.2026: получила $excludeSedoy = false (см. tests/boss-sedoy-excluded-from-
    // friend-rating.test.js) — boss_id по-прежнему не участвует, параметр $sinceMs (30.09.2026)
    // слился в карту $friendsSince, как и у _friendsDamageSumSince() выше.
    const m2 = bossesPhp.match(/private function _friendsDamagePerUserSince\(\$link, \$friendsSince, \$excludeSedoy = false\)\{([\s\S]*?)\n        \}/);
    assert(!!m2, '_friendsDamagePerUserSince($link, $friendsSince, $excludeSedoy) — сигнатура без boss_id, карта вместо списка+sinceMs');
    assert(!/`boss_id`/.test(m2 ? m2[1] : ''), 'friendsDamagePerUserSince SQL НЕ содержит фильтр по boss_id');
}

console.log('\nTest 3: все точки вызова передают $bossId только в _damageSumSince(), НЕ в friends-функции (_syncFightSession, _ratingTop)');
{
    // 24.09.2026: _derivedHp() (чистый пересчёт на каждый запрос, включая attack()) заменена
    // на _syncFightSession() (личный кэш + курсор) — единственное место, где ещё выполняется
    // полный SUM()-пересчёт (backfill "кэша нет/устарел"), attack() сам по себе больше не
    // считает $myDmgSoFar/$friendDmg отдельно, см. boss-fight-session-cache-and-friend-cursor.test.js.
    assert(/\$mine = \$this->_damageSumSince\(\$link, \$uid, \$bossId, \$bossStartMs\);/.test(bossesPhp),
        '_syncFightSession() передаёт $bossId в _damageSumSince() (свой урон, только при бэкфилле)');
    // 30.09.2026: вызов сократился до 2 аргументов ($link, $friendsSince) — карта уже несёт
    // per-uid границу времени, отдельного $bossStartMs-аргумента больше нет.
    assert(/\$friends = \(\$diffIdx !== 3 && !empty\(\$friendsSince\)\) \? \$this->_friendsDamageSumSince\(\$link, \$friendsSince\) : 0;/.test(bossesPhp),
        '_syncFightSession() НЕ передаёт $bossId в _friendsDamageSumSince() (друзья кросс-боссово, как раньше; карта $friendsSince, не список)');
    // 29.09.2026: оба вызова теперь передают ещё и excludeSedoy=true (см. tests/boss-sedoy-
    // excluded-from-friend-rating.test.js) — $bossId-часть сигнатуры не изменилась.
    assert(/\$myDmg = \$this->_damageSumSince\(\$link, \$uid, \$bossId, \$startMs, true\);/.test(bossesPhp),
        '_ratingTop() передаёт $bossId в _damageSumSince() (свой урон)');
    assert(/\$perUser = \$this->_friendsDamagePerUserSince\(\$link, \$friendsSince, true\);/.test(bossesPhp),
        '_ratingTop() НЕ передаёт $bossId в _friendsDamagePerUserSince() (карта $friendsSince, $startMs больше не передаётся отдельно)');
}

console.log('\nTest 4: регресс-гвард — старая (без boss_id) сигнатура у _damageSumSince() (своего урона) нигде не осталась');
{
    assert(!/_damageSumSince\(\$link, \$uid, \$startMs\)/.test(bossesPhp), 'нет вызовов _damageSumSince() со старой 3-аргументной сигнатурой');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
