/**
 * Test: аудит по прямому указанию — "ачивки трат (spend_coins/spend_stew) иногда откатываются
 * назад/не засчитываются".
 *
 * Причина (тот же класс гонки, что уже чинили 26.09.2026 для sedoy_dmg_total/sedoy_dmg_left,
 * см. tests/habar-sedoy-server-authoritative-whitelist-and-race.test.js): 'coins_spent' и
 * 'stew_spent' были ОДНОВРЕМЕННО:
 *   1) server-authoritative полями, которые пишут habar.php.buy()/vassilich.php.buy()/
 *      base.php.upgrade() напрямую через Gameops::saveUser() (в обход обычного дебаунса
 *      автосейва), И
 *   2) client-writable полями в whitelist users.php $allowed.
 * Из-за (2) ЛЮБОЙ параллельный debounce/periodic автосейв (queuePlayerSave триггерится ЛЮБОЙ
 * мутацией udata, не обязательно связанной с тратой), запланированный ровно в окне полёта
 * одного из этих запросов, уходил со СТАРЫМ udata (снятым ДО applyPatch()) и, придя позже,
 * тихо затирал свежий счётчик обратно на старое значение.
 *
 * Дополнительно найдено при расследовании (шаг 1 из ТЗ): hapuga.js._buy() и gangs.js._donate()
 * ДО этой правки тоже локально писали udata['coins_spent']/udata['stew_spent'] — то есть просто
 * убрать поля из whitelist было нельзя, пока эти два клиентских писателя не переехали на сервер
 * (hapuga.php.buy()/gangs.php.donate() сейчас не считали эту статистику вовсе). Оба метода на
 * момент фикса физически недостижимы (BETA_LOCKED и на клиенте, и на сервере), но код остаётся в
 * файле и должен быть исправлен на будущее — как только BETA_LOCKED снимут, гонка не должна
 * воскреснуть.
 *
 * Фикс — три независимых слоя:
 *   A) 'coins_spent'/'stew_spent' убраны из users.php $allowed. Whitelist влияет только на
 *      save() — get()/patch по-прежнему показывают клиенту актуальное серверное значение.
 *   B) hapuga.php.buy()/gangs.php.donate() теперь сами ведут coins_spent (deduct() уже вёл
 *      stew_spent для валюты 'stew', но не coins_spent для 'coins' — тот же нюанс, что в
 *      shmot.php/weapons.php/blackjack.php).
 *   C) hapuga.js._buy()/gangs.js._donate() больше не пишут coins_spent/stew_spent локально —
 *      значение приходит только через patch от сервера (тот же приём, что уже применён в
 *      base.js/vassilich.js).
 *   D) _defaultResetUdata() (полный сброс аккаунта) по-прежнему явно обнуляет оба поля — сброс
 *      пишет их напрямую в БД в обход whitelist, так что удаление из $allowed сброс не ломает.
 *
 * Run: node tests/coins-stew-spent-server-authoritative-whitelist-and-race.test.js
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

const usersPhp    = readSrc('server/core/controllers/users.php');
const hapugaPhp    = readSrc('server/core/controllers/hapuga.php');
const gangsPhp     = readSrc('server/core/controllers/gangs.php');
const gameopsPhp   = readSrc('server/core/models/gameops.php');
const hapugaJs     = readSrc('_client/src/game/hapuga.js');
const gangsJs      = readSrc('_client/src/game/gangs.js');

function sliceFn(src, needle, endMarker) {
    const start = src.indexOf(needle);
    if (start < 0) return null;
    // Отступ метода различается по файлам этого проекта (hapuga.php/gangs.php/gameops.php —
    // 4 пробела; users.php — 8 пробелов), поэтому маркер конца функции передаём явно там, где
    // он отличается от дефолта, а не полагаемся на один и тот же паттерн для всех файлов.
    const end = src.indexOf(endMarker || '\n    }', start);
    return src.slice(start, end);
}

console.log('\nTest 1: users.php $allowed БОЛЬШЕ НЕ содержит coins_spent/stew_spent как client-writable поля');
{
    const start = usersPhp.indexOf('$allowed = [');
    const end   = usersPhp.indexOf('\n            ];', start);
    assert(start >= 0 && end > start, '$allowed найден в users.php');
    const body = usersPhp.slice(start, end);
    // Старые записи были буквально 'coins_spent', / 'stew_spent', как отдельные элементы
    // массива — ищем именно эту форму, а не любое упоминание имени поля (оно легитимно
    // встречается в комментариях, объясняющих, почему убрано, и как часть других идентификаторов
    // вроде 'coins_earned').
    assert(!/'coins_spent',/.test(body), "'coins_spent' больше не является элементом массива \$allowed");
    assert(!/'stew_spent',/.test(body), "'stew_spent' больше не является элементом массива \$allowed");
    // 27.09.2026 (фикс собственного теста, найден при полном прогоне tests/ перед деплоем):
    // изначальный regex требовал "." между "убрано" и "whitelist" — не совпадает с переводом
    // строки без флага /s, а комментарий здесь многострочный (каждая строка — отдельный "//"),
    // реальная дистанция "убрано"→"whitelist" в комментарии stew_spent — 450 символов (окно
    // было 400, чуть-чуть не хватало). У coins_spent комментарий вообще ссылается на пояснение
    // stew_spent ("см. коммент у stew_spent"), не повторяя слово "whitelist" — проверяем для
    // coins_spent только само "убрано" рядом, без требования отдельного слова "whitelist".
    assert(/stew_spent[\s\S]{0,600}убрано[\s\S]{0,600}whitelist/i.test(body),
        'причина удаления stew_spent задокументирована рядом (упоминается whitelist)');
    assert(/'coins_spent'[\s\S]{0,200}убрано/i.test(body),
        'причина удаления coins_spent задокументирована рядом');
}

console.log('\nTest 2: users.php._defaultResetUdata() всё ещё реально обнуляет оба поля (полный сброс аккаунта не должен молча их пропускать)');
{
    const body = sliceFn(usersPhp, 'private function _defaultResetUdata(){', '\n        }');
    assert(!!body, '_defaultResetUdata() найден в users.php');
    assert(!!body && /'coins_spent'\s*=>\s*'0'/.test(body),
        "_defaultResetUdata() явно обнуляет 'coins_spent' — иначе сброс аккаунта перестал бы его трогать (whitelist на это уже не влияет)");
    assert(!!body && /'stew_spent'\s*=>\s*'0'/.test(body),
        "_defaultResetUdata() явно обнуляет 'stew_spent' — тот же довод");
}

console.log('\nTest 3: Gameops::deduct() по-прежнему ведёт stew_spent автоматически только для валюты stew, не для coins');
{
    const body = sliceFn(gameopsPhp, 'function deduct(&$user, $currency, $amount){');
    assert(!!body, 'deduct() найден в gameops.php');
    assert(!!body && /if\(\$currency === 'stew'\)\{\s*\n\s*\$user\['stew_spent'\]/.test(body),
        "deduct() увеличивает stew_spent только внутри ветки currency==='stew' — вызывающий контроллер обязан сам вести coins_spent при списании 'coins'");
}

console.log('\nTest 4: hapuga.php.buy() теперь сам ведёт coins_spent при списании монет (раньше этого не делал вовсе)');
{
    const body = sliceFn(hapugaPhp, 'function buy(){');
    assert(!!body, 'buy() найден в hapuga.php');
    assert(!!body && /\$this->ops->deduct\(\$user, 'coins', \$sale\)/.test(body),
        'buy() списывает coins через deduct()');
    assert(!!body && /\$user\['coins_spent'\]\s*=\s*\$this->ops->i\(\$user, 'coins_spent'\)\s*\+\s*\$sale;/.test(body),
        "buy() явно прибавляет sale к coins_spent сразу после deduct() — deduct() сам этого не делает для валюты 'coins'");
}

console.log('\nTest 5: gangs.php.donate() теперь сам ведёт coins_spent при списании монет (раньше этого не делал вовсе)');
{
    const body = sliceFn(gangsPhp, 'function donate(){');
    assert(!!body, 'donate() найден в gangs.php');
    assert(!!body && /if\(\$c\['coins'\]\)\s*\$user\['coins_spent'\]\s*=\s*\$this->ops->i\(\$user, 'coins_spent'\)\s*\+\s*\$c\['coins'\];/.test(body),
        "donate() явно прибавляет потраченные монеты к coins_spent — deduct() сам этого не делает для валюты 'coins'");
}

console.log('\nTest 6: patchCurrencies() по умолчанию по-прежнему отдаёт coins_spent/stew_spent — клиент видит обновление сразу, без ожидания следующей полной загрузки udata');
{
    const body = sliceFn(gameopsPhp, 'function patchCurrencies($user, $keys = null){');
    assert(!!body, 'patchCurrencies() найден в gameops.php');
    assert(!!body && /'stew_spent'/.test(body), 'дефолтный набор ключей patchCurrencies() включает stew_spent');
    assert(!!body && /'coins_spent'/.test(body), 'дефолтный набор ключей patchCurrencies() включает coins_spent');
}

console.log('\nTest 7: hapuga.js/gangs.js (клиент) больше НЕ пишут coins_spent/stew_spent локально в udata — значение приходит только через patch от сервера');
{
    assert(!/udata\['coins_spent'\]\s*=/.test(hapugaJs),
        "hapuga.js больше не присваивает udata['coins_spent'] напрямую");
    assert(!/udata\['stew_spent'\]\s*=/.test(gangsJs),
        "gangs.js больше не присваивает udata['stew_spent'] напрямую");
    assert(!/udata\['coins_spent'\]\s*=/.test(gangsJs),
        "gangs.js больше не присваивает udata['coins_spent'] напрямую");
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
