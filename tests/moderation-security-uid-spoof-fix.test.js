/**
 * Test: 26.09.2026 (аудит перед модерацией VK, пункт "захват чужого аккаунта / подмена uid") —
 * security.php.getToken() проверял ТОЛЬКО HMAC-подпись $params_sign (внутри которой настоящий,
 * подписанный VK vk_user_id) — но $registry['uid'], который ниже пишется как id в таблицу
 * secure и с этого момента управляет ЧЬИМ токеном это будет, берётся из СОВЕРШЕННО ОТДЕЛЬНОГО
 * поля $_POST['uid'] (universal.php:29, никак не защищённого подписью). Игрок мог открыть игру
 * честно (получить подлинную подпись на СВОЙ vk_user_id), но отправить security.getToken с
 * ЧУЖИМ значением uid в отдельном POST-поле — сервер записал бы токен, который атакующий знает,
 * на чужой id, открывая полный доступ к чужому аккаунту (users.save и т.д.).
 *
 * Фикс: после проверки подписи сверяем $registry['uid'] с подписанным
 * user_params['vk_user_id'] — при несовпадении отклоняем запрос (error code 7) и НЕ пишем
 * токен в secure. У честного клиента оба значения всегда совпадают (TS.php шлёт
 * uid=vk_params['vk_user_id'], см. modules/server.js), так что легитимный вход не затронут.
 *
 * Run: node tests/moderation-security-uid-spoof-fix.test.js
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

const securityPhp = read('server/core/controllers/security.php');
const errorsJson   = JSON.parse(read('server/json/errors.json'));

console.log('\nTest 1: getToken() сверяет $registry[\'uid\'] с подписанным vk_user_id ПОСЛЕ проверки подписи, ДО записи токена в secure');
{
    const signCheckIdx  = securityPhp.indexOf("if($sign !== $generate_sign)return $this->registry['tools']->error(0);");
    const uidCheckIdx   = securityPhp.indexOf('$signedVkUserId = intval(');
    const saveDataIdx   = securityPhp.indexOf("saveData('secure', \$sec_array)");

    assert(signCheckIdx !== -1, 'проверка подписи (error(0)) присутствует');
    assert(uidCheckIdx !== -1, 'проверка signedVkUserId добавлена');
    assert(saveDataIdx !== -1, 'запись токена в secure присутствует');
    assert(signCheckIdx < uidCheckIdx, 'сверка uid идёт ПОСЛЕ проверки подписи (подпись уже подтверждена, когда сверяем uid)');
    assert(uidCheckIdx < saveDataIdx, 'сверка uid идёт ДО записи токена в secure — подделанный uid не долетает до БД');
}

console.log('\nTest 2: сверка читает vk_user_id именно из user_params (подписанного набора), а не из отдельного uid-поля');
{
    assert(/\$signedVkUserId = intval\(\$this->registry\['user_params'\]\['vk_user_id'\] \?\? 0\);/.test(securityPhp),
        'signedVkUserId берётся из $this->registry[\'user_params\'][\'vk_user_id\'] (подписанное значение)');
    assert(/\$postedUid = intval\(\$this->registry\['uid'\]\);/.test(securityPhp),
        'postedUid берётся из $this->registry[\'uid\'] (отдельное, НЕ подписанное поле $_POST[\'uid\'])');
}

console.log('\nTest 3: несовпадение (или отсутствие подписанного vk_user_id) — отказ, error(7), НЕ error(0)/error(1) (различимый код в логах/для клиента)');
{
    const start = securityPhp.indexOf('$signedVkUserId = intval(');
    const end   = securityPhp.indexOf('$my_token = md5(', start);
    const body  = securityPhp.slice(start, end);

    assert(/if\(\$signedVkUserId <= 0 \|\| \$signedVkUserId !== \$postedUid\)\{/.test(body),
        'условие отказа: подписанный id отсутствует/некорректен ИЛИ не совпадает с posted uid');
    assert(/return \$this->registry\['tools'\]->error\(7\);/.test(body), 'отказ возвращает error(7) — отдельный код, не пере-используется error(0)/error(1)');
    assert(!/\$this->registry\['udb'\]->saveData\('secure'/.test(body), 'в ветке отказа НЕТ вызова saveData(\'secure\', ...) — токен на чужой id не пишется');
}

console.log('\nTest 4: код ошибки 7 зарегистрирован в errors.json с осмысленным текстом (иначе клиент увидит "Ошибка 7" без объяснения)');
{
    const entry = errorsJson.find(e => e.code === 7);
    assert(!!entry, 'errors.json содержит запись с code:7');
    assert(!!(entry && entry.text && entry.text.length > 5), 'у записи есть непустой понятный текст');
}

console.log('\nTest 5: легитимный клиент не затронут — honest-случай (совпадающие значения) не проходит через ветку отказа');
{
    // Симулируем логику: у честного клиента TS.php шлёт uid=vk_params['vk_user_id'] (см.
    // modules/server.js), значит signedVkUserId и postedUid ВСЕГДА совпадают для реального
    // запроса — это не тест исполнения PHP (интерпретатора нет в окружении), а sanity-проверка
    // самого условия отказа на honest-входных данных.
    const signedVkUserId = 123456789;
    const postedUid = 123456789;
    const rejects = (signedVkUserId <= 0 || signedVkUserId !== postedUid);
    assert(rejects === false, 'при совпадающих uid/vk_user_id условие отказа НЕ срабатывает (легитимный вход проходит)');

    const forgedUid = 987654321;
    const rejectsForged = (signedVkUserId <= 0 || signedVkUserId !== forgedUid);
    assert(rejectsForged === true, 'при подделанном (несовпадающем) uid условие отказа СРАБАТЫВАЕТ');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
