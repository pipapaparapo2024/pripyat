/**
 * Test: 08.10.2026, найдено по прямому репорту "игра снова не загружается" (реальная консоль
 * из теста через vk.com/app54679940, настоящий VK-iframe — не прямой ввод ссылки в браузер,
 * как раньше подозревали):
 *
 *   Access to XMLHttpRequest at 'https://pripyat-game.ru/server/json/links.json' from origin
 *   'https://test-pripyat-game.ru' has been blocked by CORS policy: No
 *   'Access-Control-Allow-Origin' header is present on the requested resource.
 *
 * Корень: window.my_server (_client/src/index.js) был ЖЁСТКО захардкожен на прод
 * ('https://pripyat-game.ru/server') НЕЗАВИСИМО от домена, с которого реально загружена
 * страница. Один и тот же бандл (index.js) деплоится байтово идентичным и на
 * test-pripyat-game.ru, и на pripyat-game.ru (см. AGENTS.md, "супер деплой") — поэтому клиент,
 * открытый с тестового домена, всё равно слал КАЖДЫЙ запрос (TS.php/helper.getJSON, включая
 * самый первый — security.getToken) на прод. У прод-сервера нет Access-Control-Allow-Origin для
 * чужого домена → браузер блокировал запрос до того, как он вообще дошёл до сервера → игра
 * "бесконечно грузилась", ни разу не получив ответ ни на один XHR.
 *
 * Это ВТОРАЯ, отдельная причина "бесконечной загрузки" в этой же сессии — первая (открытие
 * ссылки напрямую в браузере, а не через vk.com/app54679940, из-за чего VKWebAppCallAPIMethod
 * вообще не мог получить ответ) была устранена переходом на настоящий VK-iframe; эта же
 * проявилась уже ПОСЛЕ перехода, потому что находится внутри самого кода, а не в способе
 * открытия страницы.
 *
 * Фикс — тот же hostname-паттерн, что уже применили для window.debug_mode (self-gating: один
 * файл одинаково ведёт себя на обоих доменах после супер деплоя, ничего руками не переключать
 * между тестом и продом).
 *
 * Run: node tests/my-server-hostname-gated-no-cross-origin-cors.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'index.js'), 'utf-8');

console.log('\nTest 1: window.my_server — выражение от hostname, не захардкожен на прод безусловно');
{
    assert(/window\.my_server = \(typeof location !== 'undefined' && location\.hostname === 'test-pripyat-game\.ru'\)/.test(src),
        'my_server читает location.hostname — тот же паттерн, что debug_mode');
    assert(!/window\.my_server = 'https:\/\/pripyat-game\.ru\/server';/.test(src),
        'старое безусловное присвоение прод-URL убрано целиком');
}

console.log('\nTest 2: на test-pripyat-game.ru my_server указывает на СВОЙ домен (не на прод — без этого кросс-домен и CORS)');
{
    assert(/\? 'https:\/\/test-pripyat-game\.ru\/server'/.test(src),
        'ветка true (hostname===test) ведёт на test-pripyat-game.ru/server — свой origin, CORS не нужен');
}

console.log('\nTest 3: на любом другом hostname (в т.ч. проде) my_server указывает на прод, как и раньше — поведение для реальных игроков не изменилось');
{
    assert(/: 'https:\/\/pripyat-game\.ru\/server';/.test(src),
        'ветка false (любой hostname, кроме test) — прежний прод-URL сохранён');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
