/**
 * Test: баг найден по прямому указанию — "когда босс убивается седым, боевка с боссом
 * вылетает с ошибкой".
 *
 * Причина: урон "Седого" (bosses_fight.js._useSedoyDamage) был чисто client-only механикой —
 * HP уменьшался ТОЛЬКО локально (bosses._setHp()), а bosses._onDefeat(idx) звался сразу же.
 * Но реальный HP босса на сервере — производное значение из boss_damage_log (см. большой
 * комментарий в bosses.php над _syncFightSession()), которое про удар седого ничего не знало.
 * Итог: клиент видел свой локальный HP=0 и запускал claimKill(), а сервер честно пересчитывал
 * HP заново из лога, видел его ещё > 0 и отвечал fail(67) ("HP ещё не дошло до 0") — экран боя
 * вылетал с ошибкой вместо победного попапа.
 *
 * Фикс: новый server-authoritative эндпоинт bosses.useSedoy() пишет удар седого в тот же
 * boss_damage_log, что и обычная атака (bosses.attack()) — HP на клиенте и сервере остаются
 * согласованы. Требования пользователя:
 *   - урон седого НЕ засчитывается в скиллы (skills_levels.dmgSpent растёт только внутри attack());
 *   - урон седого ЗАСЧИТЫВАЕТСЯ во внутрибоевой рейтинг урона друзей (boss_damage_log — источник
 *     _ratingTop(), иначе HP босса не сойдётся с фактически нанесённым уроном друзей);
 *   - 28.09.2026 (по прямому указанию — "урон седого не должен засчитываться в топ по урону,
 *     аналогично скиллам"): урон седого НЕ засчитывается в total_damage — lifetime-счётчик,
 *     который кормит ГЛОБАЛЬНЫЙ топ игроков по урону (top.php) и задания на суммарный урон
 *     (zadaniya_config.json/tasks_pool.json). Это отдельное поле от boss_damage_log выше —
 *     удар всё ещё убивает босса и виден друзьям внутри боя, просто не идёт в личный/топовый
 *     счётчик урона за всё время.
 *
 * Run: node tests/boss-sedoy-damage-server-authoritative.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const bossesPhp = readSrc('server/core/controllers/bosses.php');
const fightJs   = readSrc('_client/src/game/shell/overlays/bosses_fight.js');

function sliceFn(src, needle) {
    const start = src.indexOf(needle);
    if (start < 0) return null;
    const end = src.indexOf('\n        }', start);
    return src.slice(start, end);
}

console.log('\nTest 1: Bosses::$permits разрешает новый метод useSedoy');
{
    const ctor = sliceFn(bossesPhp, 'function __construct($registry){');
    assert(!!ctor, '__construct найден в bosses.php');
    assert(!!ctor && /\$this->permits = \[[^\]]*'useSedoy'[^\]]*\];/.test(ctor),
        "'useSedoy' добавлен в whitelist permits (иначе Registry::validateClass() молча отклонит вызов)");
}

console.log('\nTest 2: bosses.php.useSedoy() — валидация входа и обязательный активный бой (та же дисциплина, что attack())');
{
    const body = sliceFn(bossesPhp, 'function useSedoy(){');
    assert(!!body, 'useSedoy() найден в bosses.php');
    if (body) {
        assert(/if\(\$bossId < 0 \|\| \$bossId > 7 \|\| \$diffIdx < 0 \|\| \$diffIdx > 3\) return \$this->ops->fail\(54\);/.test(body),
            'валидирует диапазон boss_id/diff_idx');
        assert(/if\(\$bossStartMs <= 0\) return \$this->ops->fail\(65\);/.test(body),
            'требует реально начатый бой (bossStartMs > 0) — нельзя ударить седым без активного боя');
        assert(/if\(\(\$now - \$bossStartMs\) >= \$this->MAX_FIGHT_WINDOW_MS\) return \$this->ops->fail\(66\);/.test(body),
            'отклоняет удар седым по уже "протухшему" бою');
        assert(/if\(\$sedoyLeft <= 0\) return \$this->ops->fail\(68\);/.test(body),
            'отклоняет удар, если серверный остаток sedoy_dmg_left исчерпан (не доверяет только клиентской проверке)');
    }
}

console.log('\nTest 3: bosses.php.useSedoy() — урон реально пишется в boss_damage_log (HP и топ становятся server-authoritative)');
{
    const body = sliceFn(bossesPhp, 'function useSedoy(){');
    assert(!!body && /_syncFightSession\(/.test(body),
        'подтягивает тот же личный производный HP-кэш, что и attack() (учитывает уже нанесённый урон/помощь друзей)');
    assert(!!body && /\$dealt = min\(\$sedoyLeft, \$hpBefore\);/.test(body),
        'dealt = min(остаток седого, текущее HP) — не расходует больше, чем нужно для добивания');
    assert(!!body && /INSERT INTO `boss_damage_log`/.test(body),
        'пишет удар седого в boss_damage_log — тот же источник правды, что читают _syncFightSession()/_ratingTop() для HP и топа урона');
    assert(!!body && /'boss_fight_session'\] = json_encode\(\$session\);/.test(body),
        'сохраняет обновлённый HP-кэш сразу — следующий claimKill()/attack() увидит актуальный HP');
}

console.log('\nTest 4: bosses.php.useSedoy() — НЕ засчитывается ни в скиллы, ни в total_damage (топ/задания), но пишется в boss_damage_log (HP/внутрибоевой рейтинг)');
{
    const body = sliceFn(bossesPhp, 'function useSedoy(){');
    // 28.09.2026: раньше здесь стоял `$this->ops->add($user, 'total_damage', $dealt);` — убран
    // по прямому указанию, урон седого больше не должен расти в глобальном топе по урону.
    assert(!!body && !/\$this->ops->add\(\$user, 'total_damage'/.test(body),
        'НЕ увеличивает total_damage — иначе удар седого попадал бы в глобальный топ игроков по урону (top.php) и задания на суммарный урон');
    assert(!!body && /INSERT INTO `boss_damage_log`/.test(body),
        'но всё ещё пишет удар в boss_damage_log — HP босса и внутрибоевой рейтинг друзей (_ratingTop()) должны остаться согласованными');
    assert(!!body && /patchCurrencies\(\$user, \['sedoy_dmg_left'\]\);/.test(body),
        "patch отдаёт только sedoy_dmg_left — 'total_damage' убран из явного списка ключей, потому что эта функция больше его не меняет");
    // Пояснение (тест был слишком буквальным): useSedoy() содержит комментарий, который САМ
    // упоминает слова "skills_levels.dmgSpent" (по-русски объясняя, почему их тут нет) — голый
    // regex по слову ложно матчил этот легитимный комментарий и валил тест на верном коде.
    // Проверяем реальный КОД (запись в $skillsState['dmgSpent'] / $user['skills_levels']), а не
    // голое слово — тот же паттерн, что уже применяется в этом наборе тестов для hallBonus (см.
    // boss-attack-server-authoritative-and-timing-friend-rule.test.js).
    assert(!!body && !/\$skillsState\['dmgSpent'\]/.test(body),
        'НЕ трогает skillsState[\'dmgSpent\'] — прогресс скиллов растёт только внутри attack(), седой в него не идёт');
    assert(!!body && !/\$user\['skills_levels'\]/.test(body),
        'НЕ пишет $user[\'skills_levels\'] — урон седого не может дать очки скиллов');
}

console.log('\nTest 5: bosses_fight.js._useSedoyDamage — больше не решает исход боя локально, ждёт сервер');
{
    const m = fightJs.match(/proto\._useSedoyDamage = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_useSedoyDamage найден в bosses_fight.js');
    if (m) {
        const body = m[1];
        assert(/TS\.php\('bosses\.useSedoy', \{boss_id: idx, diff_idx: bosses\._diffIdx\}/.test(body),
            'запрашивает урон седого у сервера (bosses.useSedoy), а не считает HP локально');
        assert(!/bosses\._setHp\(idx, newHp\)/.test(body),
            'больше НЕ выставляет HP по локально вычисленному newHp до ответа сервера (это и вызывало рассинхрон с server-side HP)');
        assert(/bosses\._setHp\(idx, res\.hp\)/.test(body),
            'HP выставляется из ответа сервера (res.hp) — согласовано с boss_fight_session на сервере');
        assert(/if\(res\.hp <= 0\) bosses\._onDefeat\(idx\);/.test(body),
            '_onDefeat() вызывается только ПОСЛЕ подтверждения сервером, что HP<=0 — claimKill() дальше не увидит рассинхрон и не упадёт в fail(67)');
        assert(/applyPatch\(res\.patch\)/.test(body),
            'применяет patch ответа сервера (total_damage/sedoy_dmg_left) через общий applyPatch(), а не мёржит поля вручную');
    }
}

console.log('\nTest 6: bosses_fight.js._useSedoyDamage — не даёт накопить параллельные запросы и уважает серверные коды ошибок');
{
    const m = fightJs.match(/proto\._useSedoyDamage = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_useSedoyDamage найден в bosses_fight.js');
    if (m) {
        const body = m[1];
        assert(/if\(this\._sedoyInFlight\) return;/.test(body),
            'игнорирует повторный клик, пока предыдущий запрос ещё летит (тот же паттерн, что _attackInFlight в bosses-combat.js)');
        assert(/if\(left <= 0\)\{/.test(body),
            'сохранена мгновенная клиентская UX-проверка (остаток по udata) — экономит round-trip на заведомо неудачный клик');
        assert(/65:\s*'Бой не начат/.test(body) && /66:\s*'Бой уже протух/.test(body) && /68:\s*'Седой достаточно помог/.test(body),
            'обрабатывает те же коды ошибок, что и bosses.useSedoy() отдаёт (65/66/68)');
    }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
