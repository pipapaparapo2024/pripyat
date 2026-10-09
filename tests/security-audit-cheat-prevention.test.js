/**
 * Test: 17.09.2026 (восьмой/девятый батч) — аудит безопасности по прямой просьбе пользователя:
 * "боюсь, что игроки смогут через консоль разработчика докинуть себе миллион всего/уровней".
 *
 * Найдены и исправлены 5 конкретных векторов (по убыванию серьёзности):
 *
 *  1) security.getToken() (server/core/controllers/security.php) — проверка VK-подписи была
 *     закомментирована ("включить когда опубликуют VK-приложение"). Без неё любой мог выдать
 *     себе токен на ЧУЖОЙ uid и им читать/перезаписывать данные другого игрока через users.save.
 *     Проверено: preloader.js.initGame() уже сейчас шлёт ИМЕННО те vk_*-параметры + sign, что
 *     реально приходят от VK при открытии через vk.com/app54574178_438953352 (стандартная схема
 *     VK Mini Apps, есть у любого app_id независимо от статуса публикации), api_id/api_secret в
 *     registry.php — настоящие. Включено по прямому указанию пользователя.
 *
 *  2) svod.claim() — reward_type/reward_val/key/need читались НАПРЯМУЮ из запроса клиента,
 *     позволяя выдать себе любое количество любой валюты (включая донат-тушёнку) одним вызовом.
 *     Метод не вызывался НИ ОДНИМ экраном клиента (задания идут через tasks.claim) — по прямому
 *     указанию пользователя весь мёртвый код удалён целиком: server/core/controllers/svod.php,
 *     server/json/svod_achievements.json, запись 'svod' из registry.php.classes.
 *
 *  3) users.save() (server/core/controllers/users.php) — целиком доверял клиенту значения
 *     ЛЮБОГО из ~90 полей из белого списка $allowed, без проверки диапазона/типа. Один вызов
 *     TS.php('users.save', {udata_json: JSON.stringify({coins:'999999999', exp:'999999999'})})
 *     писал это напрямую в БД. Добавлена строгая проверка (неотрицательное целое, потолок
 *     100 000 000) для основных денежных/прогрессовых полей — именно тех, которыми реально
 *     можно накрутить себе преимущество за один запрос.
 *
 *  4) window.debug_mode = true (_client/src/index.js) — было ЖЁСТКО закодировано в проде,
 *     из-за чего setupDebugTools() (game/debug-tools.js) выполнялся для КАЖДОГО игрока,
 *     выставляя window.GIVE_MILLION() (1 000 000 монет/сигарет/опыта/тушёнки и т.д. + авто-save
 *     на сервер) прямо в консоли браузера — именно то, чего опасался пользователь буквально
 *     дословно. Теперь false по умолчанию.
 *
 *  5) zone.recordRespect() (server/core/controllers/zone.php) — amount с клиента не имел
 *     верхней границы: один вызов с amount=999999999 мгновенно делал игрока «рекордсменом по
 *     уважению» любой локации без единой игры. Добавлен потолок 100 000 000.
 *
 * ВАЖНО: пункты 2-5 закрывают самый грубый и прямой вектор («выставить себе конкретное число
 * за один запрос»). Они НЕ делают экономику полностью server-authoritative — награды (боссы,
 * зона, казино, ящики) по-прежнему СЧИТАЮТСЯ на клиенте и только ПРИСЫЛАЮТСЯ на сохранение;
 * это отдельный, значительно больший фронт работы (см. итоговый анализ в чате).
 *
 * Run: node tests/security-audit-cheat-prevention.test.js
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

console.log('\nTest 1: security.getToken() снова проверяет VK-подпись (защита от чужого uid)');
{
    const src = readSrc('server/core/controllers/security.php');
    assert(/if\(\$sign !== \$generate_sign\)return \$this->registry\['tools'\]->error\(0\);/.test(src),
        'проверка подписи включена (раньше строка была закомментирована)');
    assert(!/\/\/\s*if\(\$sign !== \$generate_sign\)/.test(src),
        'закомментированной версии проверки не осталось');
}

console.log('\nTest 2: svod.claim() и его каталог полностью удалены как неиспользуемый код');
{
    const svodPhpPath     = path.join(root, 'server', 'core', 'controllers', 'svod.php');
    const svodCatalogPath = path.join(root, 'server', 'json', 'svod_achievements.json');
    assert(!fs.existsSync(svodPhpPath), 'server/core/controllers/svod.php удалён');
    assert(!fs.existsSync(svodCatalogPath), 'server/json/svod_achievements.json удалён');

    const registrySrc = readSrc('server/core/models/registry.php');
    assert(!/'classes'=>array\([^)]*'svod'/.test(registrySrc),
        "'svod' убран из списка разрешённых классов роутера (иначе вызов svod.claim падал бы в PHP fatal error вместо чистого отказа)");
}

console.log('\nTest 3: users.save() отклоняет неправдоподобные значения основных валют/прогресса');
{
    const src = readSrc('server/core/controllers/users.php');
    const start = src.indexOf('function save(){');
    const end   = src.indexOf('function setFriends');
    const body  = src.slice(start, end);

    assert(/\$MAX_NUMERIC = 100000000;/.test(body), 'задан числовой потолок для строгих полей');
    // 18.09.2026 (аудит безопасности): ammo_auto/ammo_gun/ammo_machete переехали из
    // $strictNumericFields (простой диапазон 0..MAX) в $monotonicFields (строго не больше
    // текущего значения в БД — иначе users.save({ammo_auto:'99999999'}) давал бы "всего лишь
    // ограниченные", но всё равно дармовые патроны). bp_level/bp_xp/bp_xp_next убраны из
    // $allowed целиком (не client-writable вовсе) — числовой потолок для них больше не нужен.
    // Полная проверка обоих классов — tests/security-audit-weapons-shmot-bp-tasks-nick.test.js.
    // 23.09.2026: 'ach_score' убран отсюда вместе с удалением из $allowed целиком (перенос
    // достижений/патронов ящика на сервер, см. achievements.php) — числовой потолок для
    // client-writable поля больше не нужен, раз поле больше не client-writable вовсе.
    const strictFields = ['coins','stew','cigarettes','exp','respect','skill_points',
        'dice_points','blue_points','poker_chips','boss_keys','energy','max_energy'];
    strictFields.forEach(f => {
        assert(new RegExp("'" + f + "'").test(body.match(/\$strictNumericFields = \[[\s\S]*?\];/)[0]),
            'поле "' + f + '" входит в список строгой числовой проверки');
    });
    const monotonicFields = ['ammo_auto','ammo_gun','ammo_machete'];
    monotonicFields.forEach(f => {
        assert(!new RegExp("'" + f + "'").test(body.match(/\$strictNumericFields = \[[\s\S]*?\];/)[0]),
            'поле "' + f + '" НЕ в $strictNumericFields — оно в $monotonicFields (строже: только снижение)');
        assert(new RegExp("'" + f + "'").test(body.match(/\$monotonicFields = \[[\s\S]*?\];/)[0]),
            'поле "' + f + '" входит в список монотонно-снижающихся полей');
    });
    ['bp_level','bp_xp','bp_xp_next'].forEach(f => {
        assert(!new RegExp("'" + f + "'").test(body.match(/\$allowed = \[[\s\S]*?\n            \];/)[0]),
            'поле "' + f + '" отсутствует в $allowed вовсе (не client-writable, не нужен числовой потолок)');
    });
    assert(/if\(!is_numeric\(\$val\)\)\{/.test(body), 'нечисловые значения строгих полей отклоняются');
    assert(/\$num < 0 \|\| \$num > \$MAX_NUMERIC/.test(body),
        'отрицательные и превышающие потолок значения отклоняются (не пишутся в БД)');
    assert(/continue;/.test(body), 'отклонённое поле пропускается (не валит весь запрос, остальные поля сохраняются)');
}

console.log('\nTest 4: window.debug_mode по умолчанию false для реальных игроков (прод), не захардкожено true');
{
    const src = readSrc('_client/src/index.js');
    // 08.10.2026: debug_mode больше не константа false — self-gating по hostname (true только на
    // test-pripyat-game.ru, для диагностики "бесконечная загрузка" через [game-boot...] логи,
    // правило №8). Ключевое свойство для безопасности прода не изменилось — на любом hostname,
    // кроме тестового (в т.ч. pripyat-game.ru), выражение false, GIVE_MILLION() не включается.
    assert(/window\.debug_mode = \(typeof location !== 'undefined' && location\.hostname === 'test-pripyat-game\.ru'\);/.test(src),
        'debug_mode — выражение от hostname, не захардкожен true; на проде (другой hostname) вычисляется в false');
    assert(!/window\.debug_mode = true;\s*\n\s*window\.session_hash/.test(src),
        'старое безусловное true перед session_hash не вернулось');
    assert(!/window\.debug_mode = true;/.test(src),
        'debug_mode нигде не захардкожен безусловным true — GIVE_MILLION()/RUN_TESTS() не включаются для обычных игроков на проде');
    assert(/if\(window\.debug_mode\) setupDebugTools\(\);/.test(src),
        'сами dev-инструменты не удалены из сборки — включаются только явным флагом (для разработчика/теста)');
}

console.log('\nTest 5: zone.recordRespect() ограничивает amount сверху');
{
    const src = readSrc('server/core/controllers/zone.php');
    const start = src.indexOf('function recordRespect(){');
    const end   = src.indexOf('$link = $this->_rawLink();', start);
    const body  = src.slice(start, end);
    assert(/\$amount > 100000000/.test(body), 'amount свыше 100 000 000 отклоняется');
    assert(/\$amount < 0/.test(body), 'отрицательный amount по-прежнему отклоняется (проверка не регрессировала)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
