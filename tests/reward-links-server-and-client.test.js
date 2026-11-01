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

console.log('\n1) Серверный контракт атомарной выдачи');
{
 const src=read('server/core/controllers/rewardlinks.php');
 assert(src.includes("$this->permits = ['claim'];"),'единственный публичный метод claim');
 assert(src.includes('WHERE code = ? LIMIT 1 LOCK IN SHARE MODE'),'содержимое ссылки берётся из БД под блокировкой');
 assert(src.includes('FOR UPDATE'),'строка игрока блокируется до начисления');
 assert(src.includes('INSERT IGNORE INTO reward_link_claims'),'уникальная резервация до награды');
 assert(src.includes('in_array($field, self::CURRENCY_FIELDS, true)'),'валюты ограничены whitelist');
 assert(!src.includes('$this->ops->saveUser('),'нет отдельного сохранения после коммита');
 assert(src.includes('$link->rollback()'),'ошибки откатывают общую транзакцию');
 assert(src.includes('patchCurrencies'),'ответ содержит серверный patch');
 // Границы срока, повторы, свежий inventory и сбои записи реально исполняются в
 // rewardlinks-claim-weapons-race-lock.test.js / _php_fixtures/rewardlinks750.php.
}

console.log('\n2) registry.php — новый класс rewardlinks добавлен в вайтлист роутера');
{
    const src = read('server/core/models/registry.example.php');
    assert(/'classes'=>array\([^)]*'rewardlinks'/.test(src), "'rewardlinks' есть в списке разрешённых классов (иначе universal.php отклонит любой запрос rewardlinks.*)");
}

console.log('\n3) tests/_fixtures/schema-history/migrate22.php.txt — миграция создаёт обе таблицы с уникальными индексами');
{
    const src = read('tests/_fixtures/schema-history/migrate22.php.txt');
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
