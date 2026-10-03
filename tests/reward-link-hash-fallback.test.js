/**
 * Test: 25.09.2026, по прямому указанию (живой репорт — "перешёл по наградной ссылке, у меня
 * открылась обычная игра, никакой награды не выдалось") —
 *
 * Расследование через логи ЖИВОГО сервера дало однозначный, проверенный ответ (не догадка):
 *  - nginx access.log: 0 (ноль) запросов за ВСЮ историю с "reward=" в query-строке.
 *  - php_errors.log: ни одной записи "[Rewardlinks.claim]" (ни успех, ни expired, ни пустой
 *    summary — вообще ни одной).
 *  - Сама ссылка (код 7baab9f0f35584ff) при этом реально существует в БД, активна, ещё не
 *    истекла, и НИ РАЗУ не была получена (reward_link_claims пуст).
 *
 * Вывод: запрос rewardlinks.claim никогда не отправлялся с клиента — потому что запрос на
 * index.html с query-параметром ?reward=CODE никогда не долетает до сервера ВООБЩЕ. Причина —
 * платформенное ограничение VK Mini Apps: VK сам строит iframe-адрес приложения из своих
 * стандартных vk_*, sign параметров и отбрасывает произвольные query-параметры из публичной
 * ссылки vk.com/app<id>?... ДО того, как дойти до index.html.
 *
 * Фикс — hash-фрагмент вместо query:
 *  1) сайт/index.php (генератор ссылок, отдельный проект C:\...\vk_game\сайт\) строит ссылку
 *     как vk.com/app<id>#reward=CODE вместо ?reward=CODE — фрагмент после # никогда не уходит
 *     на сервер (чисто клиентская часть URL), VK его не режет.
 *  2) _client/src/modules/reward-link.js читает location.hash ПЕРВЫМ (основной рабочий путь),
 *     старый query-параметр (vk_params.reward) — как fallback, на случай уже разосланных ссылок
 *     в старом формате или изменения поведения VK в будущем.
 *
 * Run: node tests/reward-link-hash-fallback.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const linkSrc = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'reward-link.js'), 'utf-8');
const siteIndexPath = path.join(root, '..', '..', 'сайт', 'index.php');

console.log('\nTest 1: reward-link.js — _getRewardCode() проверяет location.hash ПЕРВЫМ, до query-параметра');
{
    const start = linkSrc.indexOf('function _getRewardCode(){');
    assert(start !== -1, '_getRewardCode() существует');
    const end = linkSrc.indexOf('\n}', start);
    const body = linkSrc.slice(start, end);

    const hashIdx = body.indexOf('window.location.hash');
    const queryIdx = body.indexOf("vk_params['reward']");
    assert(hashIdx !== -1 && queryIdx !== -1 && hashIdx < queryIdx,
        'location.hash проверяется РАНЬШЕ vk_params.reward (hash — основной путь, query — fallback)');

    assert(/const m = hash\.match\(\/reward=\(\[\^&\]\+\)\/\);/.test(body), 'regex корректно вычленяет значение reward= из hash (до следующего & или конца строки)');
    assert(/if\(m\) return decodeURIComponent\(m\[1\]\);/.test(body), 'значение из hash декодируется через decodeURIComponent (код мог быть URL-закодирован)');
}

console.log('\nTest 2: checkRewardLink() использует _getRewardCode(), а не напрямую vk_params (регресс-гвард — старый путь чтения убран)');
{
    assert(/const code = _getRewardCode\(\);/.test(linkSrc), 'checkRewardLink() вызывает _getRewardCode()');
    assert(!/const code = window\.vk_params && vk_params\['reward'\];/.test(linkSrc),
        'старая прямая строка чтения из vk_params (единственный путь) убрана — заменена на _getRewardCode()');
}

console.log('\nTest 3: реальный сценарий из репорта — hash содержит #reward=CODE, функция извлекает CODE верно');
{
    // Мини-симуляция самой регулярки без загрузки всего браузерного окружения — то же выражение,
    // что реально используется в коде (см. Test 1), на реальных примерах хэшей.
    const extract = (hash) => {
        const m = hash.match(/reward=([^&]+)/);
        return m ? decodeURIComponent(m[1]) : null;
    };
    assert(extract('#reward=7baab9f0f35584ff') === '7baab9f0f35584ff', 'простой hash без доп. параметров');
    assert(extract('#reward=7baab9f0f35584ff&other=1') === '7baab9f0f35584ff', 'hash с ДОПОЛНИТЕЛЬНЫМИ параметрами после reward (регресс на будущее расширение)');
    assert(extract('#other=1&reward=abc123') === 'abc123', 'hash где reward НЕ первый параметр');
    assert(extract('') === null, 'пустой hash — код не найден, не падает');
    assert(extract('#somethingelse') === null, 'hash без reward= — код не найден');
}

console.log('\nTest 4: сайт/index.php — ОБА места генерации ссылки используют hash (#reward=), не query (?reward=)');
{
    if(!fs.existsSync(siteIndexPath)){
        console.log('  ⚠️  сайт/index.php не найден по ожидаемому пути (' + siteIndexPath + ') — пропускаю (отдельный проект вне git pripat)');
    } else {
        const siteSrc = fs.readFileSync(siteIndexPath, 'utf-8');
        const hashCount = (siteSrc.match(/VK_APP_LINK \. '#reward=' \. urlencode/g) || []).length;
        assert(hashCount === 2, 'обе точки генерации ссылки (создание новой + список последних) используют #reward= (найдено: ' + hashCount + ')');
        assert(!/VK_APP_LINK \. '\?reward='/.test(siteSrc), 'старый формат ?reward= нигде не остался');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
