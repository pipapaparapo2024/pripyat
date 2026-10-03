/**
 * Test: перенос "Ежедневных заданий" на сервер (23.09.2026, по прямому указанию).
 *
 * Раньше генерация набора заданий, прогресс и выдача награды считались ЦЕЛИКОМ на клиенте
 * (zadaniya.js) — udata['zadaniya'] был client-writable (уже удалён из whitelist users.php
 * аудитом безопасности 18.09.2026, см. security-audit-weapons-shmot-bp-tasks-nick.test.js),
 * а старый server-side tasks.claim() ждал от этого поля reward_type/reward_val/prog/need,
 * которые клиент по факту НИКОГДА туда не сохранял (_saveToUdata() писал только
 * {id,type,claimed}) — эндпоинт молча всегда проваливался, вся "выдача" шла мимо сервера
 * через оптимистичное client-side применение награды.
 *
 * Теперь: набор заданий на сегодня, прогресс (честно считается из полей $user) и выдача
 * награды — только на сервере (tasks.getTasks/tasks.claim), в новом server-only поле
 * zadaniya_session (НЕ в whitelist users.php, как dice_session/poker_session). Раздел временно
 * заблокирован (BETA_LOCKED в tasks.php) — UI-кнопка уже убрана из HUD 22.09.2026, но и прямой
 * вызов из консоли теперь тоже ничего не даёт.
 *
 * Run: node tests/zadaniya-server-authoritative-migration.test.js
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

const tasksPhp   = readSrc('server/core/controllers/tasks.php');
const usersPhp   = readSrc('server/core/controllers/users.php');
const gameopsPhp = readSrc('server/core/models/gameops.php');
const configRaw  = readSrc('server/json/zadaniya_config.json');
const migratePhp = readSrc('server/migrate28.php');
const clientJs   = readSrc('_client/src/game/zadaniya.js');

console.log('\nTest 1: tasks.php — BETA_LOCKED включён на обоих permit\'ах');
{
    assert(/private \$BETA_LOCKED = true;/.test(tasksPhp), 'BETA_LOCKED = true объявлен');
    const getStart = tasksPhp.indexOf('function getTasks(){');
    const getEnd   = tasksPhp.indexOf('\n        }', getStart);
    const claimStart = tasksPhp.indexOf('function claim(){');
    const claimEnd   = tasksPhp.indexOf('\n        }', claimStart);
    assert(/if\(\$this->BETA_LOCKED\) return \$this->ops->fail\(56\);/.test(tasksPhp.slice(getStart, getEnd)), 'getTasks() проверяет BETA_LOCKED первой строкой');
    assert(/if\(\$this->BETA_LOCKED\) return \$this->ops->fail\(56\);/.test(tasksPhp.slice(claimStart, claimEnd)), 'claim() проверяет BETA_LOCKED первой строкой');
    assert(/this->permits = \['getTasks', 'claim'\];/.test(tasksPhp), 'оба permit\'а зарегистрированы');
}

console.log('\nTest 2: tasks.php — прогресс считается честно из полей $user, не из клиентских данных');
{
    assert(/private function _statValue\(\$user, \$key\)\{/.test(tasksPhp), '_statValue() читает напрямую из $user (через Gameops::i)');
    assert(/return \$this->ops->i\(\$user, \$key, 0\);/.test(tasksPhp), '_statValue() не принимает никаких клиентских данных — только имя поля');
    assert(/\$prog = min\(intval\(\$def\['need'\]\), \$this->_statValue\(\$user, \$def\['key'\]\)\);/.test(tasksPhp),
        'getTasks() считает prog так же честно, как claim() (не доверяет клиенту)');
}

console.log('\nTest 3: tasks.php — генерация/хранение набора заданий в zadaniya_session, не в client-writable zadaniya');
{
    assert(/\$user\['zadaniya_session'\] \?\? null/.test(tasksPhp), 'сессия читается из zadaniya_session');
    assert(!/\$user\['zadaniya'\]/.test(tasksPhp), 'старое client-writable поле zadaniya больше нигде не используется');
    assert(/\(\$data\['day'\] \?\? null\) !== \$today \|\| empty\(\$data\['tasks'\]\)/.test(tasksPhp),
        'набор заданий перегенерируется при смене календарного дня (или если сессии ещё не было)');
}

console.log('\nTest 4: tasks.php — награда выдаётся из каталога (server-side $def), не из клиентского payload');
{
    const claimStart = tasksPhp.indexOf('function claim(){');
    const claimEnd   = tasksPhp.indexOf('\n        }', claimStart);
    const body = tasksPhp.slice(claimStart, claimEnd);
    assert(/\$rtype = \$def\['reward_type'\] \?\? 'coins';/.test(body), 'reward_type берётся из каталога (найденного по id задания)');
    assert(/\$rval\s*=\s*\$def\['reward_val'\]\s*\?\?\s*0;/.test(body), 'reward_val берётся из каталога, не из $_POST/user_params');
    assert(!/user_params.*reward/i.test(body), 'нет чтения суммы/типа награды из клиентских параметров запроса');
}

console.log('\nTest 5: users.php — zadaniya_session НЕ в whitelist $allowed, добавлен в resetSession()');
{
    const allowedBlock = usersPhp.slice(usersPhp.indexOf('$allowed = ['), usersPhp.indexOf('\n            ];'));
    assert(!allowedBlock.includes("'zadaniya_session'"), 'zadaniya_session отсутствует в $allowed');
    assert(/'zadaniya_session'\s*=>\s*null,/.test(usersPhp), 'resetSession() обнуляет zadaniya_session при полном сбросе аккаунта');
}

console.log('\nTest 6: Gameops::patchCurrencies() дефолтный список не включает zadaniya_session (server-only, не для патча клиенту)');
{
    const m = gameopsPhp.match(/\$keys = \[([\s\S]*?)\];/);
    assert(!!m && !/'zadaniya_session'/.test(m[1]), 'zadaniya_session не патчится клиенту (клиент получает задания через tasks.getTasks, не через patch)');
}

console.log('\nTest 7: server/json/zadaniya_config.json — валидный JSON, есть все 3 категории, id уникальны');
{
    let config = null;
    assert((() => { try { config = JSON.parse(configRaw); return true; } catch(e){ return false; } })(), 'файл — валидный JSON');
    if(config){
        assert(Array.isArray(config.daily) && config.daily.length >= 3, 'daily — массив, минимум 3 задания (нужно выбрать ровно 3)');
        assert(Array.isArray(config.weekly) && config.weekly.length >= 1, 'weekly — массив, минимум 1 задание');
        assert(Array.isArray(config.special) && config.special.length >= 1, 'special — массив, минимум 1 задание');

        const allIds = [...config.daily, ...config.weekly, ...config.special].map(t => t.id);
        const uniqueIds = new Set(allIds);
        assert(uniqueIds.size === allIds.length, 'все id заданий уникальны (нужны для поиска в _findDef)');

        const REQUIRED = ['id','icon','name','desc','key','need','reward_type','reward_val','reward_lbl'];
        const allTasks = [...config.daily, ...config.weekly, ...config.special];
        const missing = allTasks.filter(t => REQUIRED.some(k => !(k in t)));
        assert(missing.length === 0, 'у каждого задания есть все обязательные поля (' + REQUIRED.join(', ') + ')');
    }
}

console.log('\nTest 8: migrate28.php — добавляет колонку zadaniya_session, требует ключ доступа');
{
    assert(/stalker_migrate28_2026/.test(migratePhp), 'миграция защищена секретным ключом в URL');
    assert(/\$col = 'zadaniya_session';/.test(migratePhp), 'миграция добавляет именно zadaniya_session');
    assert(/TEXT DEFAULT NULL/.test(migratePhp), 'тип колонки — TEXT (JSON-блоб)');
}

console.log('\nTest 9: zadaniya.js — клиент стал тонким прокси (нет локальной генерации/RNG/оптимистичной награды)');
{
    assert(!/_generateTasks/.test(clientJs), '_generateTasks() (клиентский RNG выбора заданий) удалён целиком');
    assert(!/_pool\s*=/.test(clientJs), 'клиентский _pool (таблица наград) удалён — единственный источник теперь zadaniya_config.json на сервере');
    assert(!/_syncProgress/.test(clientJs), '_syncProgress() (чтение прогресса из udata напрямую) удалён');
    assert(!/task\.claimed = true;\s*\n\s*if\(task\.reward_type/.test(clientJs), 'оптимистичное применение награды ДО ответа сервера удалено');
    assert(/TS\.php\('tasks\.getTasks', \{\}/.test(clientJs), 'open() запрашивает задания у сервера');
    assert(/TS\.php\('tasks\.claim', \{task_idx: idx\}/.test(clientJs), 'claim() отправляет запрос на сервер, не применяет награду локально');
}

console.log('\nTest 10: zadaniya.js — graceful-обработка BETA_LOCKED (код 56) на обоих запросах');
{
    const n = (clientJs.match(/err && err\.code === 56/g) || []).length;
    assert(n === 2, 'обе точки входа (open/claim) проверяют код 56 и показывают понятное сообщение, а не падают (найдено ' + n + ')');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
