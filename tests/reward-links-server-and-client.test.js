/**
 * Test: батч 25.09.2026 (по прямому указанию) — сайт-генератор наградных ссылок
 * (vk_game/сайт/, отдельный проект вне этого репозитория, деплоится на тот же сервер как
 * /rewards-admin/). Здесь проверяется ТОЛЬКО игровая сторона: серверный приём кода
 * (rewardlinks.claim) и клиентский попап при заходе по ссылке.
 *
 * Ключевые решения (по ответам на уточняющие вопросы):
 *  - Ссылка многоразовая, но каждый игрок получает конкретную ссылку только ОДИН раз —
 *    reward_link_claims с уникальным индексом (link_id, user_id).
 *  - Опциональный срок действия (1 минута — 1 неделя) — expires_at, при просрочке клиент
 *    получает reason:'expired' и показывает попап "Ты опоздал, братиш!".
 *  - Какую награду и сколько выдать — решает ТОЛЬКО сервер по содержимому reward_links.reward
 *    в БД, клиент передаёт лишь code (тот же принцип, что и вся остальная server-authoritative
 *    экономика проекта — см. CLAUDE.md).
 *
 * Run: node tests/reward-links-server-and-client.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\n1) server/core/controllers/rewardlinks.php — контроллер по стандартному паттерну проекта');
{
    const src = read('server/core/controllers/rewardlinks.php');
    assert(/Class Rewardlinks \{/.test(src), 'класс Rewardlinks объявлен');
    assert(/\$this->ops = new Gameops\(\$registry\);/.test(src), 'использует Gameops (паттерн проекта)');
    assert(/\$this->permits = \['claim'\];/.test(src), 'единственный публичный метод — claim');
    assert(/function claim\(\)\{/.test(src), 'метод claim() определён');

    assert(/SELECT id, reward, expires_at, active FROM reward_links WHERE code = \? LIMIT 1/.test(src),
        'читает ссылку из БД по коду (не доверяет клиенту содержимое награды)');
    assert(/if\(\$row\['expires_at'\] !== null && intval\(\$row\['expires_at'\]\) > 0 && \$now > intval\(\$row\['expires_at'\]\)\)/.test(src),
        'проверяет истечение срока действия');
    assert(/'reason' => 'expired'/.test(src), 'просроченная ссылка возвращает reason:expired');
    // 27.09.2026 (по прямому указанию — "проверь чтобы за одну ссылку не давали награду
    // дважды", найдена и закрыта TOCTOU-гонка): раньше проверка "уже получено?" была отдельным
    // SELECT ДО начисления, а сама отметка INSERT писалась в самом конце, ПОСЛЕ начисления —
    // два одновременных claim() могли оба пройти SELECT (ни один ещё не записан) и оба
    // начислить награду, прежде чем второй INSERT упал бы на UNIQUE-constraint. Теперь claim
    // резервируется через INSERT IGNORE ПЕРВЫМ (атомарно, той же UNIQUE-constraint в БД) —
    // affected_rows определяет "уже получено", реакция на дубликат уже ДО начисления.
    assert(/INSERT IGNORE INTO reward_link_claims \(link_id, user_id, claimed_at\) VALUES \(\?, \?, \?\)/.test(src),
        'claim резервируется атомарно (INSERT IGNORE) ДО начисления награды, не после');
    assert(/\$reserved = \$link->affected_rows === 1;/.test(src), 'affected_rows определяет, реально ли резервация досталась этому запросу (0 — уже был claim от другого параллельного запроса или раньше)');
    assert(/'reason' => 'already'/.test(src), 'повторное/параллельное получение той же ссылки тем же игроком отклоняется');
    // Резервация выше должна идти РАНЬШЕ, чем json_decode/loadUser/начисление — иначе гонка
    // никуда не делась, просто переехала на другую пару операций.
    const reserveIdx = src.indexOf('$reserved = $link->affected_rows === 1;');
    const rewardDecodeIdx = src.indexOf("json_decode(\$row['reward'], true);");
    assert(reserveIdx !== -1 && rewardDecodeIdx !== -1 && reserveIdx < rewardDecodeIdx,
        'резервация claim происходит РАНЬШЕ, чем чтение/начисление содержимого награды (порядок — сама суть фикса гонки)');

    assert(/if\(\$kind === 'currency'\)/.test(src) && /in_array\(\$field, self::CURRENCY_FIELDS, true\)/.test(src),
        'валюта — только по вайтлисту полей (нельзя записать произвольное поле БД через reward)');
    // 08.10.2026 (рефакторинг при фиксе бага "посылки оружия не используются" — см.
    // tests/rewardlinks-weapon-ammo-sync.test.js): разбор ОДНОЙ строки награды вынесен из
    // claim() в отдельный приватный _applyRewardEntry() (ради тестируемости через Reflection
    // без мока $link) — state теперь хранится в массиве $state['shmot']/['bosses_data'], не в
    // отдельных переменных $shmotState/$bossesData.
    assert(/function _applyRewardEntry\(&\$user, \$entry, &\$state\)\{/.test(src),
        'разбор строки награды вынесен в отдельный чистый метод (без $link) — тестируем через Reflection');
    assert(/if\(\$kind === 'shmot'\)/.test(src) && /\$state\['shmot'\]\[\$itemId\]\['owned'\] = true;/.test(src),
        'шмотка — выдаётся владение конкретным id из каталога');
    assert(/if\(\$kind === 'key'\)/.test(src) && /\$state\['bosses_data'\]\['keys'\]\[\$bossId\] = intval\(\$state\['bosses_data'\]\['keys'\]\[\$bossId\]\) \+ \$amount;/.test(src),
        'ключ босса — инкремент bosses_data.keys[bossId] (то же поле, что тратит bosses.php.startFight())');

    // Резервация проверена выше (Test 1) — здесь дополнительно проверяем откат резервации,
    // если награда в итоге НЕ выдана (битый JSON/не удалось загрузить или сохранить юзера/
    // пустой summary) — иначе игрок навсегда теряет право получить ссылку, хотя ничего не получил.
    assert(/DELETE FROM reward_link_claims WHERE link_id = \? AND user_id = \?/.test(src),
        'есть откат резервации (rollback) на путях, где награда не выдаётся после резервации claim');
    const rollbackCount = (src.match(/\$_rollbackClaim\(\);/g) || []).length;
    assert(rollbackCount >= 3, `откат вызывается на всех путях "награда не выдана после резервации" (найдено вызовов: ${rollbackCount}, ожидалось минимум 3 — битый JSON, ошибка loadUser/saveUser, пустой summary)`);
    assert(/\$this->ops->saveUser\(\$user\)/.test(src), 'изменения игрока сохраняются через Gameops::saveUser (полная строка)');
    // 27.09.2026 (добавлен kind:'habar' — см. tests/reward-links-habar-grant.test.js для полной
    // проверки этого типа награды): habar_bought добавлен в список ключей patch, иначе клиент
    // узнает о выданном хабаре только при следующей полной загрузке udata, а не сразу.
    assert(/patchCurrencies\(\$user, array_merge\(self::CURRENCY_FIELDS, \['shmot', 'bosses_data', 'habar_bought'/.test(src),
        'ответ возвращает patch (включая habar_bought) — клиент обязан применить его через applyPatch()');
}

console.log('\n2) registry.php — новый класс rewardlinks добавлен в вайтлист роутера');
{
    const src = read('server/core/models/registry.php');
    assert(/'classes'=>array\([^)]*'rewardlinks'/.test(src), "'rewardlinks' есть в списке разрешённых классов (иначе universal.php отклонит любой запрос rewardlinks.*)");
}

console.log('\n3) server/migrate22.php — миграция создаёт обе таблицы с уникальными индексами');
{
    const src = read('server/migrate22.php');
    assert(/CREATE TABLE IF NOT EXISTS `reward_links`/.test(src), 'таблица reward_links');
    assert(/UNIQUE KEY `uniq_code` \(`code`\)/.test(src), 'код ссылки уникален');
    assert(/CREATE TABLE IF NOT EXISTS `reward_link_claims`/.test(src), 'таблица reward_link_claims');
    assert(/UNIQUE KEY `uniq_link_user` \(`link_id`, `user_id`\)/.test(src),
        'уникальный индекс (link_id,user_id) — гарантия "один игрок — один раз на ссылку" на уровне БД, а не только в PHP-логике');
}

console.log('\n4) _client/src/modules/reward-link.js — читает код через _getRewardCode(), вызывает rewardlinks.claim, показывает попап');
{
    const src = read('_client/src/modules/reward-link.js');
    assert(/export function checkRewardLink\(\)\{/.test(src), 'checkRewardLink() экспортирован');
    // 26.09.2026 (найден root cause — VK Mini Apps режет чужие query-параметры до того, как
    // они долетают до index.html): чтение переведено на _getRewardCode() — hash-фрагмент
    // ПЕРВЫМ, vk_params как fallback. Полная проверка — tests/reward-link-hash-fallback.test.js.
    assert(/const code = _getRewardCode\(\);/.test(src),
        'читает код через _getRewardCode() (hash-фрагмент первым, vk_params — fallback)');
    assert(/if\(!code\) return;/.test(src), 'ничего не делает, если игрок пришёл без параметра reward (обычный заход)');
    assert(/TS\.php\('rewardlinks\.claim', \{ code: code \}/.test(src), 'шлёт код на сервер, не решает сам что выдавать');
    assert(/if\(res\.patch\) applyPatch\(res\.patch\);/.test(src), 'применяет patch от сервера через applyPatch (не мёржит поля вручную)');
    assert(/iface\._showRewardPopup\(items\);/.test(src), 'успешная выдача — попап наград (переиспользует существующий iface._showRewardPopup)');
    assert(/res\.reason === 'expired'/.test(src) && /Ты опоздал, братиш!/.test(src),
        'просроченная ссылка — попап с текстом по прямому указанию пользователя');
}

console.log('\n5) game-boot.js — checkRewardLink() вызывается в момент появления главного экрана');
{
    const src = read('_client/src/game/game-boot.js');
    assert(/import \{ checkRewardLink \} from '\.\.\/modules\/reward-link\.js';/.test(src), 'модуль импортирован');
    const idx = src.indexOf('const _finishLoading');
    const chunk = src.slice(idx, idx + 1500);
    assert(/checkRewardLink\(\);/.test(chunk), 'вызывается внутри _finishLoading (тот же момент, что запуск фоновой музыки — главный экран уже реально виден)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
