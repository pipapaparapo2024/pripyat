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

function postToServer(method, yourParameters, token, reqKey){
    return new Promise((resolve, reject) => {
        const body = new URLSearchParams();
        body.append('method', method);
        body.append('api_id', String(API_ID));
        body.append('params', encodeParams(yourParameters));
        body.append('token', token || '');
        body.append('uid', String(TEST_UID));
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

async function main(){
    console.log(`Smoke-тест: https://${HOST} | TEST_UID=${TEST_UID}\n`);

    console.log('Шаг 1: security.getToken — реальная VK-подпись (HMAC-SHA256, тот же api_secret, что проверяет сервер)');
    const vkParams = {
        vk_user_id: String(TEST_UID), vk_app_id: String(API_ID),
        vk_platform: 'desktop_web', vk_language: 'ru', vk_is_app_user: '1',
    };
    vkParams.sign = vkSign(vkParams);
    let reqKey = 'srUjnhko'; // стартовое значение — ровно как в конструкторе Server() на клиенте
    const tokenRes = await postToServer('security.getToken', vkParams, '', reqKey);
    check(!!tokenRes.token, 'getToken вернул token — HMAC-подпись прошла проверку сервера');
    if(tokenRes.req_key) reqKey = tokenRes.req_key;
    const token = tokenRes.token;
    if(!token){ console.error('Нет token — дальнейшие шаги невозможны, прерываю.'); process.exit(1); }

    console.log('\nШаг 2: users.get — аккаунт создаётся/читается, стартовые значения по ТЗ');
    const userRes = await postToServer('users.get', {}, token, reqKey);
    if(userRes.req_key) reqKey = userRes.req_key;
    check(userRes.status !== 'error', 'users.get не вернул ошибку: ' + JSON.stringify(userRes).slice(0, 200));
    check(userRes.udata && userRes.udata.id == TEST_UID, 'udata.id совпадает с TEST_UID');

    // Охотник (boss_id=0) требует зачищенную локацию 0 (boss_loc:0 в bosses.js) — свежий
    // синтетический аккаунт её не проходил. Это smoke-тест БОЁВКИ, не прогон полной воронки
    // онбординга — зачищаем локацию напрямую через users.save (whitelist-поле 'zone'), а не
    // симулируем реальный сбор локации через zone.php (отдельная, более тяжёлая механика, не
    // то, что проверяет этот smoke-тест).
    console.log('\nШаг 3: users.save — зачистка локации 0 (предусловие для боя с Охотником)');
    const zoneRes = await postToServer('users.save', { udata_json: JSON.stringify({ zone: { '0': { cleared: 1 } } }) }, token, reqKey);
    if(zoneRes.req_key) reqKey = zoneRes.req_key;
    check(zoneRes.status !== 'error', 'users.save (zone) не вернул ошибку: ' + JSON.stringify(zoneRes).slice(0, 200));

    console.log('\nШаг 4: bosses.startFight (Охотник, соло) — старт боя на сервере');
    const startRes = await postToServer('bosses.startFight', { boss_id: 0, diff_idx: 3 }, token, reqKey);
    if(startRes.req_key) reqKey = startRes.req_key;
    check(startRes.status !== 'error', 'startFight не вернул ошибку: ' + JSON.stringify(startRes).slice(0, 200));
    check(typeof startRes.hp === 'number' && startRes.hp > 0, 'startFight вернул hp > 0, получено ' + JSON.stringify(startRes.hp));

    console.log('\nШаг 5: bosses.attack (нож, бесплатное оружие) — реальный удар, HP уменьшается');
    const beforeHp = startRes.hp;
    const attackRes = await postToServer('bosses.attack', { boss_id: 0, diff_idx: 3, weapon_id: 0, mult: 1 }, token, reqKey);
    if(attackRes.req_key) reqKey = attackRes.req_key;
    check(attackRes.status !== 'error', 'attack не вернул ошибку: ' + JSON.stringify(attackRes).slice(0, 200));
    check(typeof attackRes.hp === 'number' && attackRes.hp < beforeHp, `HP реально уменьшилось после удара (было ${beforeHp}, стало ${attackRes.hp})`);
    check(typeof attackRes.damage === 'number' && attackRes.damage > 0, 'attack вернул damage > 0, получено ' + JSON.stringify(attackRes.damage));

    console.log('\nШаг 6: bosses.rating — СОБСТВЕННЫЙ урон реально попадает в топ (прямой smoke-тест сегодняшнего фикса)');
    const ratingRes = await postToServer('bosses.rating', { boss_id: 0, diff_idx: 3 }, token, reqKey);
    if(ratingRes.req_key) reqKey = ratingRes.req_key;
    const myEntry = Array.isArray(ratingRes.top) ? ratingRes.top.find(e => String(e.id) === String(TEST_UID)) : null;
    check(!!myEntry, 'rating.top содержит мою собственную запись после реального удара (живой прогон бага с рейтингом урона): ' + JSON.stringify(ratingRes.top));
    check(myEntry && myEntry.damage === attackRes.damage, `rating.top damage (${myEntry && myEntry.damage}) совпадает с уроном удара (${attackRes.damage})`);

    console.log(`\n${'─'.repeat(60)}`);
    if(failed === 0) console.log(`✅ SMOKE OK — ${passed} проверок прошли на живом ${HOST}`);
    else { console.log(`❌ SMOKE FAILED — ${failed} провалились, ${passed} прошли`); process.exit(1); }
}

main().catch(e => { console.error('❌ Smoke-тест упал с ошибкой:', e.message); process.exit(1); });
