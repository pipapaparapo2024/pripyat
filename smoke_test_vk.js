#!/usr/bin/env node
/**
 * Smoke-тест по ЖИВОМУ test-pripyat-game.ru (пункт 3 плана тестирования, 04.10.2026, по прямому
 * указанию — "лёгкий smoke-тест по живому тестовому серверу после каждого деплой").
 *
 * В отличие от ВСЕХ файлов в tests/*.test.js (статический анализ исходников — grep/regex или
 * исполнение кода в изоляции с моками), этот скрипт бьёт НАСТОЯЩИЕ HTTP-эндпоинты реально
 * задеплоенного test-pripyat-game.ru — единственная проверка в проекте, которая видит то же
 * самое, что видел бы живой игрок в VK: реальный роутинг (universal.php), реальную БД
 * (stalker_test), реальный php8.5-fpm. Statика может быть зелёной (код "выглядит правильно"), а
 * задеплоенная версия — всё равно сломана (не тот файл уехал, забыли рестартнуть php-fpm,
 * миграция не накатилась) — это НЕ ловит никакой из существующих тестов, только живой запрос.
 *
 * НЕ является частью tests/*.test.js и НЕ подхватывается циклом `for f in tests/*.test.js`
 * (другое имя, другая папка) — запускается ТОЛЬКО вручную, после деплоя на тест, по явной
 * команде пользователя. Никогда не трогает прод (pripyat-game.ru) — URL захардкожен на тест,
 * прод-вариант сознательно не реализован в этом скрипте.
 *
 * Протокол повторяет modules/server.js (клиентское кодирование запроса к universal.php):
 * JSON.stringify → UTF-8-safe base64 (дважды) → spec_encode (подстановочный шифр) → POST
 * application/x-www-form-urlencoded. Подпись (sign) — та же HMAC-SHA256 схема, что проверяет
 * security.php.getToken() (api_secret публично лежит в server/core/models/registry.php — тот же
 * файл, что уже закоммичен в репозиторий, здесь не новый секрет, просто переиспользуется).
 *
 * Тестовый аккаунт — СИНТЕТИЧЕСКИЙ uid (см. TEST_UID ниже), не реальный VK-пользователь. Живёт
 * только в БД stalker_test, прод не затрагивает ни при каких обстоятельствах.
 *
 * Run: node smoke_test_vk.js
 */
const crypto = require('crypto');
const https = require('https');
const { URLSearchParams } = require('url');

const HOST = 'test-pripyat-game.ru';
const API_ID = 54574178; // registry.php: 'api_id'
const API_SECRET = 'NbEEnoAYijdh9yQACIHL'; // registry.php: 'api_secret' — уже публично в репозитории
const TEST_UID = 999000001; // синтетический smoke-test аккаунт, НЕ реальный VK-игрок
// 04.10.2026: второй синтетический аккаунт — для живой проверки "друг реально попадает в
// rating/friendsDamage" (прямая живая защита бага 04.10.2026, см. AGENTS.md — друзьям сюда
// передавался сырой $friendIds вместо карты $friendsSince). Тоже НЕ реальный VK-игрок.
const TEST_FRIEND_UID = 999000002;

// ── spec_encode — побуквенная подстановка, 1-в-1 копия modules/server.js (НЕ инверсия,
// реализация самого encode, сверено построчно с клиентом) ──
const SPEC_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
const SPEC_ENCODE_MAP = {"0":"2","1":"6","2":"0","3":"7","4":"5","5":"1","6":"4","7":"8","8":"3","9":"9","a":"b","b":"h","c":"k","d":"d","e":"u","f":"g","g":"t","h":"i","i":"l","j":"a","k":"e","l":"w","m":"r","n":"p","o":"x","p":"y","q":"m","r":"z","s":"c","t":"v","u":"j","v":"s","w":"f","x":"o","y":"q","z":"n","A":"E","B":"G","C":"J","D":"P","E":"L","F":"U","G":"W","H":"S","I":"V","J":"A","K":"N","L":"R","M":"C","N":"Z","O":"X","P":"M","Q":"Y","R":"B","S":"I","T":"H","U":"F","V":"K","W":"Q","X":"O","Y":"D","Z":"T"};
function specEncode(text){
    let out = '';
    for(const ch of text) out += SPEC_ALPHABET.includes(ch) ? SPEC_ENCODE_MAP[ch] : ch;
    return out;
}

function encodeParams(obj){
    const json = JSON.stringify(obj);
    const b64safe = Buffer.from(json, 'utf8').toString('base64'); // аналог btoa(unescape(encodeURIComponent(json)))
    const doubleB64 = Buffer.from(b64safe, 'utf8').toString('base64');
    return specEncode(doubleB64);
}

function vkSign(paramsNoSign){
    const sorted = {};
    Object.keys(paramsNoSign).sort().forEach(k => { sorted[k] = paramsNoSign[k]; });
    const query = Object.entries(sorted).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%20/g, '+')}`).join('&');
    const hmac = crypto.createHmac('sha256', API_SECRET).update(query).digest();
    return hmac.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 04.10.2026: добавлен параметр uid (раньше был захардкожен на TEST_UID) — нужен, чтобы вести
// ВТОРОЙ синтетический аккаунт (TEST_FRIEND_UID) тем же протоколом в параллельном потоке шагов.
function postToServer(method, yourParameters, token, reqKey, uid){
    return new Promise((resolve, reject) => {
        const body = new URLSearchParams();
        body.append('method', method);
        body.append('api_id', String(API_ID));
        body.append('params', encodeParams(yourParameters));
        body.append('token', token || '');
        body.append('uid', String(uid || TEST_UID));
        body.append('req_key', reqKey);
        body.append('platform', 'vk');
        const bodyStr = body.toString();

        const req = https.request({
            hostname: HOST, path: '/server/universal.php?h=' + Date.now(), method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(bodyStr) },
        }, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch(e){ reject(new Error(`[${method}] ответ не JSON (HTTP ${res.statusCode}): ${data.slice(0, 300)}`)); }
            });
        });
        req.on('error', reject);
        req.write(bodyStr);
        req.end();
    });
}

let passed = 0, failed = 0;
function check(cond, msg){
    if(cond){ console.log('  ✅', msg); passed++; }
    else     { console.error('  ❌ FAIL:', msg); failed++; }
}

// 04.10.2026: вынесено из main() — нужно дважды, по разу на каждый синтетический аккаунт
// (TEST_UID и TEST_FRIEND_UID), чтобы проверить живой друг-рейтинг (шаги ниже).
async function login(uid, label){
    console.log(`\n[${label}] security.getToken — реальная VK-подпись (HMAC-SHA256, тот же api_secret, что проверяет сервер)`);
    const vkParams = {
        vk_user_id: String(uid), vk_app_id: String(API_ID),
        vk_platform: 'desktop_web', vk_language: 'ru', vk_is_app_user: '1',
    };
    vkParams.sign = vkSign(vkParams);
    let reqKey = 'srUjnhko'; // стартовое значение — ровно как в конструкторе Server() на клиенте
    const tokenRes = await postToServer('security.getToken', vkParams, '', reqKey, uid);
    check(!!tokenRes.token, `[${label}] getToken вернул token — HMAC-подпись прошла проверку сервера`);
    if(tokenRes.req_key) reqKey = tokenRes.req_key;
    const token = tokenRes.token;
    if(!token){ console.error(`[${label}] Нет token — дальнейшие шаги для этого аккаунта невозможны, прерываю.`); process.exit(1); }

    const userRes = await postToServer('users.get', {}, token, reqKey, uid);
    if(userRes.req_key) reqKey = userRes.req_key;
    check(userRes.status !== 'error', `[${label}] users.get не вернул ошибку: ` + JSON.stringify(userRes).slice(0, 200));
    check(userRes.udata && userRes.udata.id == uid, `[${label}] udata.id совпадает с uid`);

    return { token, reqKey: reqKey };
}

// Обёртка, прокидывающая uid и обновляющая session.reqKey по ответу — сокращает повторение
// `if(res.req_key) reqKey = res.req_key` на каждом шаге для обоих аккаунтов ниже.
async function call(session, uid, method, params){
    const res = await postToServer(method, params, session.token, session.reqKey, uid);
    if(res.req_key) session.reqKey = res.req_key;
    return res;
}

async function main(){
    console.log(`Smoke-тест: https://${HOST} | TEST_UID=${TEST_UID} | TEST_FRIEND_UID=${TEST_FRIEND_UID}\n`);

    console.log('Шаг 1-2: логин обоих синтетических аккаунтов (security.getToken + users.get)');
    const me = await login(TEST_UID, 'me');
    const friend = await login(TEST_FRIEND_UID, 'friend');

    // 04.10.2026: делает повторные ручные прогоны этого скрипта идемпотентными. Синтетические
    // аккаунты — персистентные (та же БД между запусками), а бесплатное оружие (нож/цепь/бита)
    // имеет ОБЩИЙ 6-часовой кулдаун (см. $FREE_WPN_CD_MS в bosses.php) — повторный прогон в
    // пределах 6ч после предыдущего падал бы на Ошибка 88, даже если весь остальной код здоров.
    // endFightSession() безусловно обнуляет freeWpnCdMs при ЛЮБОМ вызове с валидными
    // boss_id/diff_idx (не только при реально активном бое, см. комментарий в bosses.php) —
    // используем это как единственный легитимный (не dev-эндпоинт) способ сбросить кулдаун.
    console.log('\nШаг 2.5: bosses.endFightSession — сброс общего КД бесплатного оружия (идемпотентность повторных прогонов)');
    await call(me, TEST_UID, 'bosses.endFightSession', { boss_id: 0, diff_idx: 0 });
    await call(friend, TEST_FRIEND_UID, 'bosses.endFightSession', { boss_id: 0, diff_idx: 3 });

    // Охотник (boss_id=0) требует зачищенную локацию 0 (boss_loc:0 в bosses.js) — свежий
    // синтетический аккаунт её не проходил. Это smoke-тест БОЁВКИ, не прогон полной воронки
    // онбординга — зачищаем локацию напрямую через users.save (whitelist-поле 'zone'), а не
    // симулируем реальный сбор локации через zone.php (отдельная, более тяжёлая механика, не
    // то, что проверяет этот smoke-тест). Зачищаем ОБОИМ — друг тоже должен бить Охотника.
    console.log('\nШаг 3: users.save — зачистка локации 0 для обоих аккаунтов (предусловие для боя с Охотником)');
    const zoneRes = await call(me, TEST_UID, 'users.save', { udata_json: JSON.stringify({ zone: { '0': { cleared: 1 } } }) });
    check(zoneRes.status !== 'error', '[me] users.save (zone) не вернул ошибку: ' + JSON.stringify(zoneRes).slice(0, 200));
    const zoneResFriend = await call(friend, TEST_FRIEND_UID, 'users.save', { udata_json: JSON.stringify({ zone: { '0': { cleared: 1 } } }) });
    check(zoneResFriend.status !== 'error', '[friend] users.save (zone) не вернул ошибку: ' + JSON.stringify(zoneResFriend).slice(0, 200));

    // 04.10.2026: взаимная дружба ВК — _friendIds() (bosses.php) требует, чтобы КАЖДЫЙ считал
    // другого другом в своём собственном 'friends' поле (не одностороннее добавление). Реальный
    // путь записи этого поля — setFriendsScopeGranted (согласие) + setFriendsCache (сам список),
    // тот же путь, что проходит настоящий клиент после VKWebAppGetAuthToken (modules/server.js).
    console.log('\nШаг 4: setFriendsScopeGranted + setFriendsCache — взаимная дружба ВК между me и friend');
    const scopeMe = await call(me, TEST_UID, 'users.setFriendsScopeGranted', {});
    check(scopeMe.status !== 'error', '[me] setFriendsScopeGranted не вернул ошибку: ' + JSON.stringify(scopeMe).slice(0, 200));
    const scopeFriend = await call(friend, TEST_FRIEND_UID, 'users.setFriendsScopeGranted', {});
    check(scopeFriend.status !== 'error', '[friend] setFriendsScopeGranted не вернул ошибку: ' + JSON.stringify(scopeFriend).slice(0, 200));
    const friendsCacheMe = await call(me, TEST_UID, 'users.setFriendsCache', { friends: String(TEST_FRIEND_UID) });
    check(friendsCacheMe.status !== 'error', '[me] setFriendsCache не вернул ошибку: ' + JSON.stringify(friendsCacheMe).slice(0, 200));
    const friendsCacheFriend = await call(friend, TEST_FRIEND_UID, 'users.setFriendsCache', { friends: String(TEST_UID) });
    check(friendsCacheFriend.status !== 'error', '[friend] setFriendsCache не вернул ошибку: ' + JSON.stringify(friendsCacheFriend).slice(0, 200));

    console.log('\nШаг 5: bosses.startFight (Охотник, ГРУППОВОЙ режим diff_idx=0 — друг помогает ТОЛЬКО не в соло) — я');
    const startRes = await call(me, TEST_UID, 'bosses.startFight', { boss_id: 0, diff_idx: 0 });
    check(startRes.status !== 'error', '[me] startFight не вернул ошибку: ' + JSON.stringify(startRes).slice(0, 200));
    check(typeof startRes.hp === 'number' && startRes.hp > 0, '[me] startFight вернул hp > 0, получено ' + JSON.stringify(startRes.hp));

    console.log('\nШаг 6: bosses.attack (мой собственный удар ножом) — HP уменьшается');
    const beforeHp = startRes.hp;
    const attackRes = await call(me, TEST_UID, 'bosses.attack', { boss_id: 0, diff_idx: 0, weapon_id: 0, mult: 1 });
    check(attackRes.status !== 'error', '[me] attack не вернул ошибку: ' + JSON.stringify(attackRes).slice(0, 200));
    check(typeof attackRes.hp === 'number' && attackRes.hp < beforeHp, `[me] HP реально уменьшилось после удара (было ${beforeHp}, стало ${attackRes.hp})`);
    check(typeof attackRes.damage === 'number' && attackRes.damage > 0, '[me] attack вернул damage > 0, получено ' + JSON.stringify(attackRes.damage));

    // Друг бьёт того же босса СВОИМ соло-боем (асимметричное правило — см. _friendsDamageSumSince()
    // в bosses.php: диффа/босс друга не важны, важно только что ОН дружит со мной и Я не в соло).
    console.log('\nШаг 7: друг начинает СВОЙ бой (соло) и бьёт того же Охотника — это и есть "помощь друга"');
    const friendStartRes = await call(friend, TEST_FRIEND_UID, 'bosses.startFight', { boss_id: 0, diff_idx: 3 });
    check(friendStartRes.status !== 'error', '[friend] startFight не вернул ошибку: ' + JSON.stringify(friendStartRes).slice(0, 200));
    const friendAttackRes = await call(friend, TEST_FRIEND_UID, 'bosses.attack', { boss_id: 0, diff_idx: 3, weapon_id: 0, mult: 1 });
    check(friendAttackRes.status !== 'error', '[friend] attack не вернул ошибку: ' + JSON.stringify(friendAttackRes).slice(0, 200));
    check(typeof friendAttackRes.damage === 'number' && friendAttackRes.damage > 0, '[friend] attack вернул damage > 0, получено ' + JSON.stringify(friendAttackRes.damage));

    console.log('\nШаг 8: bosses.rating (я, групповой режим) — СОБСТВЕННЫЙ урон И урон ДРУГА оба реально в топе (прямой smoke-тест фикса 04.10.2026)');
    const ratingRes = await call(me, TEST_UID, 'bosses.rating', { boss_id: 0, diff_idx: 0 });
    const myEntry = Array.isArray(ratingRes.top) ? ratingRes.top.find(e => String(e.id) === String(TEST_UID)) : null;
    const friendEntry = Array.isArray(ratingRes.top) ? ratingRes.top.find(e => String(e.id) === String(TEST_FRIEND_UID)) : null;
    check(!!myEntry, 'rating.top содержит мою собственную запись после реального удара: ' + JSON.stringify(ratingRes.top));
    check(myEntry && myEntry.damage === attackRes.damage, `rating.top мой damage (${myEntry && myEntry.damage}) совпадает с уроном моего удара (${attackRes.damage})`);
    check(!!friendEntry, 'РЕГРЕСС-ПРУФ — rating.top содержит запись ДРУГА (баг 04.10.2026 — друг бил, но не появлялся в рейтинге): ' + JSON.stringify(ratingRes.top));
    check(friendEntry && friendEntry.damage === friendAttackRes.damage, `rating.top damage друга (${friendEntry && friendEntry.damage}) совпадает с уроном его удара (${friendAttackRes.damage})`);

    // Тот же живой прогон для friendsDamage() (периодический опрос экрана боя) — другой путь
    // кода (кэш HP + курсор), тоже должен честно вычесть урон друга из моего производного HP.
    console.log('\nШаг 9: bosses.friendsDamage (я) — производный HP учёл урон друга (другой путь кода, тот же баг-класс)');
    const fdRes = await call(me, TEST_UID, 'bosses.friendsDamage', { boss_id: 0, diff_idx: 0 });
    check(fdRes.status !== 'error', 'friendsDamage не вернул ошибку: ' + JSON.stringify(fdRes).slice(0, 200));
    const expectedHp = Math.max(0, attackRes.hp - friendAttackRes.damage);
    check(typeof fdRes.hp === 'number' && fdRes.hp === expectedHp,
        `friendsDamage учёл урон друга в производном HP (ожидалось ${expectedHp} = ${attackRes.hp} - ${friendAttackRes.damage}, получено ${fdRes.hp})`);

    console.log(`\n${'─'.repeat(60)}`);
    if(failed === 0) console.log(`✅ SMOKE OK — ${passed} проверок прошли на живом ${HOST}`);
    else { console.log(`❌ SMOKE FAILED — ${failed} провалились, ${passed} прошли`); process.exit(1); }
}

main().catch(e => { console.error('❌ Smoke-тест упал с ошибкой:', e.message); process.exit(1); });
