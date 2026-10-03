/**
 * Test: 26.09.2026 (аудит перед модерацией VK) — два независимых фикса в preloader.js:
 *
 * 1) Рассинхрон цен доната. Клиент читал донат-цены/количества из server/json/_bigger.json —
 *    отдельного агрегатора, собираемого вручную скриптом _bigger.php и НИКОГДА не
 *    обновляемого автоматически при деплое. Живая копия этого файла в репозитории оказалась
 *    датирована июлем 2025 и содержит структуру СОВЕРШЕННО ДРУГОЙ игры-шаблона (ключи gold/
 *    semki/t_coin вместо stew/coins/cigarettes) — рассинхрон был не гипотетическим, а
 *    подтверждённым фактом. universal_pay.php (серверный вебхук оплаты) всегда читал
 *    donuts.json напрямую через Jsonloader. Фикс: клиент теперь тоже читает donuts.json
 *    напрямую (тот же файл, что и вебхук) — один файл, один источник правды.
 *
 * 2) Избыточный VK-scope. VKWebAppGetAuthToken запрашивал scope 'friends,wall,photos,groups',
 *    хотя по всему клиенту реально вызываются только utils.getServerTime/friends.get/
 *    friends.getAppUsers/users.get — ни одного wall/photos/groups метода. Модератор
 *    может отклонить приложение за запрос неиспользуемых доступов. Фикс: scope сужен до
 *    'friends'.
 *
 * Run: node tests/moderation-preloader-donuts-and-scope-fix.test.js
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

const preloaderJs = read('_client/src/game/preloader.js');

console.log('\nTest 1: клиент запрашивает donuts.json напрямую, _bigger.json больше не используется как источник донат-цен');
{
    assert(/helper\.getJSON\(my_server\+'\/json\/donuts\.json', \(e\)=>\{this\.initJSON\(e\)\}, \(e\)=>\{this\.onError\(e\)\}\);/.test(preloaderJs),
        "onGetToken() запрашивает my_server+'/json/donuts.json'");
    // 27.09.2026 (плановая чистка тестов): проверка ловила ложное срабатывание — комментарии
    // 26.09.2026 рядом с onGetToken()/initJSON() ОБЪЯСНЯЮТ, ЧТО РАНЬШЕ читался _bigger.json
    // (история бага), упоминание живёт только в тексте пояснений, не в исполняемом коде.
    // Убираем строки-комментарии перед проверкой на реальное использование файла.
    const preloaderCode = preloaderJs.replace(/^\s*\/\/.*$/gm, '');
    assert(!/_bigger\.json/.test(preloaderCode), '_bigger.json больше нигде не используется в исполняемом коде preloader.js (упоминания остались только в комментариях-пояснениях истории фикса)');
}

console.log('\nTest 2: initJSON() присваивает donuts_info из ответа НАПРЯМУЮ (без обёртки data[\'donuts\'] — donuts.json не имеет такой обёртки, в отличие от прежнего _bigger.json)');
{
    const start = preloaderJs.indexOf('initJSON(data){');
    const end   = preloaderJs.indexOf('\n\t}', start);
    const body  = preloaderJs.slice(start, end);
    assert(/window\.donuts_info = data;/.test(body), "window.donuts_info = data (без ['donuts'])");
    assert(!/data\['donuts'\]/.test(body), "старое обращение к data['donuts'] удалено");
}

console.log('\nTest 3: VK-scope сужен до \'friends\' — wall/photos/groups убраны');
{
    assert(/scope\s*:\s*['"]friends['"]/.test(preloaderJs), 'VKWebAppGetAuthToken запрашивает только scope friends');
    assert(!/wall,photos,groups/.test(preloaderJs), 'wall,photos,groups больше не запрашиваются');
    assert(!/"friends,wall,photos,groups"/.test(preloaderJs), 'старая широкая строка scope удалена целиком');
}

console.log('\nTest 4: sanity — donuts.json реально существует и имеет структуру, которую initJSON()/bank.js ожидают (stew/coins/cigarettes с price/default)');
{
    const donutsJson = JSON.parse(read('server/json/donuts.json'));
    ['stew', 'coins', 'cigarettes'].forEach(key => {
        assert(Array.isArray(donutsJson[key] && donutsJson[key].price), `donuts.json['${key}'].price — массив`);
        assert(Array.isArray(donutsJson[key] && donutsJson[key].default), `donuts.json['${key}'].default — массив`);
        assert(donutsJson[key].price.length === donutsJson[key].default.length, `donuts.json['${key}'] — price и default одной длины`);
    });
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
