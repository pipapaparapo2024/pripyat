/**
 * Test: «РЕЙТИНГ УРОНА» в боёвке с боссом (bosses_fight.js) раньше дёргал серверный метод
 * bosses.rating, которого физически не существовало на сервере (был только friendsDamage) —
 * поэтому панель ВСЕГДА показывала пустые «---» / «× —», сколько бы её ни трогали визуально.
 *
 * Фикс — три части:
 *  1) Клиент копит урон ИМЕННО ПО ЭТОМУ боссу (bossDamage[idx], пожизненно, как killsTotal) —
 *     bosses-combat.js._attack(). Раньше писался только personalDamageTotal — общий по всем
 *     боссам сразу, для конкретно "рейтинга урона ПО ЭТОМУ боссу" не годится.
 *  2) Серверный метод bosses.rating (server/core/controllers/bosses.php) отдаёт глобальный
 *     top-3 среди всех игроков по пожизненной сумме bossDamage[boss_id].
 *  3) Клиент резолвит id → имя/фото через bosses._resolveVkUsers (свой id — из закэшированного
 *     vk_user_info, друзья — один батч-запрос VK API users.get) и подставляет в панель.
 *
 * Run: node tests/boss-damage-rating.test.js
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
const phpSrc = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'core', 'controllers', 'bosses.php'), 'utf-8'
);

// ── Test 1: bosses.php.attack() копит bossDamage[bossId] (пожизненно, по конкретному боссу) ──
// 22.09.2026 (по прямому указанию — "перенеси весь бой на сервер"): расчёт и накопление урона
// переехали из bosses-combat.js._attack() в bosses.php.attack() целиком, см.
// boss-attack-server-authoritative-and-timing-friend-rule.test.js за полным покрытием.
console.log('\nTest 1: bosses.php.attack() — накопление урона по конкретному боссу (bossDamage[$bossId])');
{
    const start = phpSrc.indexOf('function attack(){');
    const end   = phpSrc.indexOf('\n        }', start);
    const body  = phpSrc.slice(start, end);
    // 26.09.2026: personalDamageTotal перевёден с $dealt (обрезанный остатком HP) на полный
    // $damage — тот же реверс, что и у остальных пожизненных метрик (см. большой коммент в
    // bosses.php у этого блока).
    assert(/\$data\['personalDamageTotal'\] = intval\(\$data\['personalDamageTotal'\]\) \+ \$damage;/.test(body),
        'общий personalDamageTotal считается по полному $damage (не обрезанному остатком HP)');
    assert(/if\(!isset\(\$data\['bossDamage'\]\) \|\| !is_array\(\$data\['bossDamage'\]\)\) \$data\['bossDamage'\] = array_fill\(0, 8, 0\);/.test(body),
        'массив bossDamage инициализируется (8 боссов), если его ещё нет');
    assert(/\$data\['bossDamage'\]\[\$bossId\] = intval\(\$data\['bossDamage'\]\[\$bossId\]\) \+ \$damage;/.test(body),
        'bossDamage[$bossId] пожизненно суммирует полный $damage');
    assert(!/Math\.max/.test(body), 'старое ограничение максимумом одного цикла отсутствует');
}

console.log('\nTest 1b: HP кэшируется в boss_fight_session (24.09.2026), но кэш "обнуляется" сам собой для новой попытки через несовпадение bossId/diffIdx — не нужен отдельный curCycleDmg=0 на сервере');
{
    // 24.09.2026: HP переехал с "чистого пересчёта на каждый запрос" (_derivedHp(), убран) на
    // мутируемый личный кэш (boss_fight_session, см. _syncFightSession()) — но ключевое свойство
    // из 22.09.2026 сохранилось: новая попытка не требует отдельного явного шага "обнулить
    // прошлый урон", потому что _syncFightSession() сама распознаёт "кэш от другой попытки"
    // (bossId/diffIdx не совпадают) и пересобирает HP с нуля.
    // 30.09.2026 (прогон перед деплоем): 7-й параметр — $friendsSince (карта), не $friendIds
    // (плоский список) — см. фикс retroactive-урона друга 29.09.2026, _friendsSinceMap().
    assert(phpSrc.indexOf('private function _syncFightSession($link, $uid, $session, $diffIdx, $bossId, $bossStartMs, $friendsSince){') !== -1,
        '_syncFightSession() определена — единственная точка входа для чтения/обновления кэша HP');
    assert(/\$matches = isset\(\$session\['bossId'\], \$session\['diffIdx'\], \$session\['hp'\], \$session\['cursorId'\]\)/.test(phpSrc),
        'несовпадение bossId/diffIdx с прошлым кэшем распознаётся автоматически — явный сброс не нужен');
}

// ── Test 2: _resolveVkUsers резолвит себя из кэша, друзей — батч-запросом ────
console.log('\nTest 2: bosses-combat.js._resolveVkUsers — свой id из vk_user_info, друзья — один VK API запрос');
{
    const m = combatSrc.match(/proto\._resolveVkUsers = function\(ids, callback\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_resolveVkUsers найден');
    if (m) {
        const body = m[1];
        assert(/sid === myId/.test(body), 'сравнивает id с собственным vk_params.vk_user_id');
        assert(/window\.vk_user_info/.test(body), 'для себя использует уже закэшированный vk_user_info (без лишнего запроса)');
        assert(/method: 'users\.get'/.test(body), 'для остальных — VK API users.get');
        assert(/user_ids: rest\.join\(','\)/.test(body), 'один батч-запрос со всеми недостающими id сразу, а не по одному');
    }
}

// ── Test 3: _loadBossFightRating флашит свой урон на сервер ПЕРЕД запросом рейтинга ──
// Баг: bosses.rating() на сервере читает bossDamage из уже СОХРАНЁННОЙ строки в БД, а свой
// урон никогда явно не отправлялся перед запросом (только раз в 60с автосейвом) — рейтинг
// почти всегда показывал "---" даже когда игрок уже реально нанёс урон в этой сессии.
console.log('\nTest 3: bosses_fight.js._loadBossFightRating — предварительный флаш убран (22.09.2026, данные в boss_damage_log уже свежие)');
{
    const m = fightSrc.match(/proto\._loadBossFightRating = function\(bossIdx\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_loadBossFightRating найден');
    if (m) {
        const body = m[1];
        assert(!/TS\.php\('users\.save'/.test(body), 'предварительный флаш users.save убран — bosses.rating() читает boss_damage_log, пишет его сам сервер синхронно внутри attack()');
        assert(/this\._fetchBossFightRating\(bossIdx\)/.test(body), 'сразу запрашивает рейтинг');
    }
}

console.log('\nTest 3b: _fetchBossFightRating использует новый формат ответа {top:[{id,damage}]}');
{
    const m = fightSrc.match(/proto\._fetchBossFightRating = function\(bossIdx\)\{([\s\S]*?)\n    \};\s*proto\._showBossFightRating[\s\S]*?\n    \};/);
    assert(!!m, '_fetchBossFightRating найден');
    if (m) {
        const body = m[0];
        assert(/TS\.php\('bosses\.rating', \{boss_id:bossIdx, diff_idx:diffIdx\}/.test(body),
            'запрос идёт на bosses.rating (метод теперь реально существует на сервере) — с diff_idx (нужен серверу для соло-режима)');
        assert(/bosses\._resolveVkUsers\(top\.map\(e=>e\.id\)/.test(body), 'id из ответа резолвятся в имя/фото через bosses._resolveVkUsers');
        assert(/if\(!top\.length\)\{/.test(body), 'пустой ответ (никто ещё не нанёс урона) — откат на плейсхолдер, не падает');
    }
}

// ── Test 4: серверный bosses.php — rating() и killers() ──────────────────────
// 17.09.2026 (позже этого батча, по прямому уточнению пользователя): рейтинг УРОНА
// переопределён — не глобальный пожизненный bossDamage, а ПО ДРУЗЬЯМ и по урону ТЕКУЩЕГО БОЯ
// (curCycleDmg, обнуляется вместе с боем) — подробно проверено в run_tests.js
// ("Рейтинг босса — по друзьям, по урону ТЕКУЩЕГО боя, в соло без друзей, топ-3") и
// tests/boss-friends-damage-auto-sync-and-rating-scope.test.js. killers() (кто последним
// убил) остался ГЛОБАЛЬНЫМ — другая метрика, другой охват, см. Test 5.
console.log('\nTest 4: server/bosses.php — rating() (по друзьям, урон текущего боя) зарегистрирован и считает верно');
{
    // 26.09.2026: permits дополнен ещё тремя методами (useSedoy/rushFreeWeapon/buyKey),
    // добавленными позже этого батча — проверяем сам факт наличия нужных нам permits через
    // includes(), не хрупкое точное совпадение всего массива целиком (иначе тест ломается
    // каждый раз, когда в permits добавляется НЕ относящийся к рейтингу метод).
    assert(/\$this->permits = \[[^\]]*'friendsDamage'[^\]]*\];/.test(phpSrc) &&
        ['friendsDamage', 'rating', 'killers', 'recordKill', 'claimKill', 'startFight', 'attack', 'endFightSession'].every(
            m => new RegExp(`\\$this->permits = \\[[^\\]]*'${m}'[^\\]]*\\];`).test(phpSrc)
        ),
        'rating, killers, recordKill, claimKill, startFight, attack и т.д. присутствуют в permits — иначе роутер их отклонит как недоступные');
    assert(/function rating\(\)\{/.test(phpSrc), 'метод rating() существует');
    // 22.09.2026 (второй раз, отдельный батч — попап победы над боссом): rating() дальше
    // разбит на общий _ratingTop(), переиспользуемый claimKill() (см.
    // boss-victory-popup-top-and-double-kill-count-fix.test.js). _ratingTop() определена ПЕРЕД
    // rating() в файле — окно расширено, чтобы захватить обе функции разом.
    const ratingStart = phpSrc.indexOf('private function _ratingTop(');
    const ratingEnd   = phpSrc.indexOf('function killers(){');
    const rating = [null, phpSrc.slice(ratingStart, ratingEnd)];
    assert(!!rating, 'тело rating()/_ratingTop() найдено');
    // 22.09.2026 (по прямому указанию, финальный заход — механика уточнена: боссы не обязаны
    // совпадать): rating() считает урон через _myFightStart()/_damageSumSince()/
    // _friendsDamagePerUserSince(), читающие boss_damage_log — не пожизненный bossDamage, не
    // client-writable curCycleDmg. См. большой комментарий в bosses.php над _derivedHp().
    assert(rating && /\$startMs = \$this->_myFightStart\(\$myData, \$diffIdx, \$bossId\);/.test(rating[1]),
        'rating() считает урон текущего цикла из boss_damage_log (не пожизненный bossDamage, не client-writable curCycleDmg)');
    assert(rating && /\$me = \$this->registry\['udb'\]->getData/.test(rating[1]), 'rating() читает свою строку (bosses_data/friends/nick)');
    assert(rating && /_friendIds\(\$me\)/.test(rating[1]), 'rating() ограничен друзьями ВК (и собой) — не глобальный топ');
    assert(rating && /\$diffIdx !== 3/.test(rating[1]), 'в соло (diff_idx=3) друзья НЕ подмешиваются — только сам игрок');
    assert(/usort\(\$entries/.test(phpSrc), 'сортирует по убыванию урона');
    // 18.09.2026: расширено до топ-9 — новый попап результата боя показывает места 1-3
    // фото-аватарками и 4-9 текстовым списком, см. boss-result-popup-new-design.test.js.
    assert(/array_slice\(\$entries, 0, 9\)/.test(phpSrc), 'отдаёт top-9 (места 1-3 — аватарки, 4-9 — текстовый список)');
}

// ── Test 5: killers()/recordKill() — ГЛОБАЛЬНЫЙ последний убивший, не friends/killsTotal ──
// Уточнение пользователя: «в рейтинге урона — друзья, а убивший — тот, кто последний убил
// босса в игре, среди вообще всех игроков» — другая метрика (последний, не больше всего) и
// другой охват (все игроки, не только друзья), поэтому отдельная таблица boss_last_kill,
// а не killsTotal внутри bosses_data (который виден только себе+друзьям через getData).
console.log('\nTest 5: server/bosses.php — killers()/recordKill() используют глобальную таблицу boss_last_kill');
{
    assert(/function _rawLink\(\)\{/.test(phpSrc), '_rawLink() — отдельное прямое подключение к БД (не через udb/utb, которые работают только в контексте текущего игрока)');
    assert(/function killers\(\)\{/.test(phpSrc), 'метод killers() существует');
    // Позже этого батча в запрос добавлен JOIN на nick (игровой ник, не VK-имя) — сам факт
    // выборки ИЗ глобальной таблицы (не ограниченной друзьями) не изменился.
    assert(/FROM `boss_last_kill` bl LEFT JOIN `\{\$utb\}` u ON u\.`id` = bl\.`user_id`/.test(phpSrc),
        'killers() читает ВСЕХ игроков из глобальной таблицы (+ JOIN на nick), не только друзей текущего');
    assert(!/killers\(\)\{[\s\S]{0,50}_friendIds/.test(phpSrc), 'killers() больше не ограничивается друзьями текущего игрока');
    assert(/function recordKill\(\)\{/.test(phpSrc), 'метод recordKill() существует — вызывается при каждой победе над боссом');
    // 30.09.2026 (прогон перед деплоем): 29.09.2026 безусловный UPSERT заменили на условный
    // (IF($now >= killed_at, ...)) — защита от гонки, когда более старый запрос "последний
    // вышел с попапа" долетает до сервера ПОСЛЕ более нового и не должен его перезаписывать.
    assert(/ON DUPLICATE KEY UPDATE\s*\n\s*`user_id` = IF\(\$now >= `killed_at`, \$uid, `user_id`\),\s*\n\s*`killed_at` = IF\(\$now >= `killed_at`, \$now, `killed_at`\)/.test(phpSrc),
        'recordKill() перезаписывает last-killer при каждой новой победе, с защитой от гонки по времени (условный UPSERT по boss_id)');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
