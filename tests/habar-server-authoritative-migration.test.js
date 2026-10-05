/**
 * Test: 24.09.2026, по прямому указанию ("да, сделай") — перенос экономики ежедневного сбора
 * хабара на сервер, той же схемой, что уже применена к покеру/зарикам/боссам.
 *
 * Найденная дыра: habar.js._collectDay() (сбор наград тира на 30 дней) была ЦЕЛИКОМ клиентской —
 * начисление всех наград (рубли/сигареты/патроны/пул урона Седого), счётчик собранных дней и
 * таймер кулдауна писались напрямую в udata и уходили на сервер только общим users.save. Поля
 * habar_bought/habar_days_collected/habar_last_collect_ts были в client-writable whitelist
 * $allowed — читер мог обнулить счётчик/таймер из консоли браузера и собирать хабар бесконечно,
 * либо выставить себе валюту напрямую, минуя habar.js вообще.
 *
 * Фикс:
 *  1) server/json/habar_daily_config.json — фиксированный каталог наград на тир (перенесён
 *     1-в-1 из старого habar.js.containers), кулдаун и лимит дней.
 *  2) habar.php.collectDay() — новый server-authoritative эндпоинт: сам проверяет покупку/
 *     кулдаун/лимит 30 дней, сам начисляет награды (Gameops::add/_grantWeaponReward), сам пишет
 *     days_collected/last_collect_ts.
 *  3) users.php — habar_bought/habar_days_collected/habar_last_collect_ts убраны из $allowed
 *     (клиент больше не может их писать напрямую), добавлены в resetSession() (полный сброс
 *     аккаунта по-прежнему их обнуляет).
 *  4) habar.js — _collectDay()/_buyAndOpen() теперь реальные запросы к серверу, применяют ответ
 *     через applyPatch(), без локального начисления/RNG.
 *
 * Run: node tests/habar-server-authoritative-migration.test.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

console.log('\nНовый каталог наград — 1-в-1 с прежним хардкодом habar.js.containers');
{
    const cfg = JSON.parse(read('server/json/habar_daily_config.json'));
    assert(cfg.cooldown_ms === 86400000, 'кулдаун — 24 часа (86400000мс), как и было в HABAR_COLLECT_COOLDOWN_MS');
    assert(cfg.total_days === 30, 'лимит — 30 дней сбора');
    assert(Array.isArray(cfg.containers) && cfg.containers.length === 4, '4 тира контейнера, как и в клиентском this.containers');
    const elite = cfg.containers.find(c => c.id === 3);
    assert(!!elite && elite.price.amount === 500, 'тир "Элитный" (id3) — цена 500, как в клиенте');
    assert(elite.rewards.some(r => r.type === 'damage' && r.amount === 500000), 'тир "Элитный" — 500000 урона Седого, как в клиенте');
    assert(elite.rewards.some(r => r.type === 'poker_chips' && r.amount === 4), 'тир "Элитный" — 4 фишки покера, как в клиенте');
}

console.log('\nhabar.php — новый серверный эндпоинт collectDay()');
{
    const src = read('server/core/controllers/habar.php');
    // 28.09.2026: 'open' убран из permits вместе с самим методом Habar::open() — был
    // недостижимым мёртвым кодом (client habar.js его никогда не вызывал), см.
    // tests/habar-open-dead-code-removed.test.js.
    assert(/\$this->permits = \['buy', 'collectDay'\];/.test(src), "'collectDay' добавлен в permits");
    assert(/function collectDay\(\)\{/.test(src), 'collectDay() определён');
    assert(/\$boughtIdx = \$this->ops->i\(\$user, 'habar_bought'\) - 1;/.test(src), 'читает habar_bought из ПОЛНОЙ строки (loadUser), не из client-writable whitelist');
    assert(/if\(\$boughtIdx < 0\) return \$this->ops->fail\(57\);/.test(src), 'отклоняет сбор, если хабар не куплен');
    // 05.10.2026 (стале-пин, не регрессия — см. аудит гонок состояний 04.10.2026, параллельная
    // сессия добавила SELECT...FOR UPDATE в collectDay(): проверки/инкременты теперь идут на
    // залоченной копии $lockedUser, фейл-ветки обёрнуты в rollback/close перед return).
    assert(/if\(\$collected >= \$totalDays\)\{[\s\S]{0,120}?return \$this->ops->fail\(58\);/.test(src), 'отклоняет сбор сверх лимита дней (сервер считает сам, не доверяя клиенту)');
    assert(/if\(\$lastTs > 0 && \(\$now - \$lastTs\) < \$cooldownMs\)\{[\s\S]{0,120}?return \$this->ops->fail\(59\);/.test(src), 'отклоняет сбор до истечения кулдауна — СЕРВЕРНЫМ временем (microtime), не клиентским Date.now()');
    assert(/\$lockedUser\['habar_days_collected'\]  = \$collected \+ 1;/.test(src), 'инкремент дней пишется на сервере');
    assert(/\$lockedUser\['habar_last_collect_ts'\] = \$now;/.test(src), 'таймер кулдауна пишется на сервере, серверным временем');
    assert(/if\(!\$this->ops->saveUser\(\$user\)\) return \$this->ops->fail\(99\);/.test(src), 'реально сохраняет через Gameops::saveUser (полная строка, не whitelist)');

    console.log('\nhabar.php — buy() тоже считает stew_spent на сервере (раньше это делал клиент)');
    // 05.10.2026 (стале-пин, не регрессия — раньше buy() инкрементировал stew_spent отдельной
    // явной строкой; теперь достаточно Gameops::deduct(), которая сама инкрементит stew_spent
    // для currency==='stew' (см. gameops.php:80-82) — отдельная строка здесь задвоила бы счёт.
    // Проверяем, что явного дублирующего инкремента НЕТ и что deduct() реально вызывается на
    // валюте 'stew' внутри buy() (единственный путь, которым stew_spent теперь растёт здесь).
    assert(!/\$lockedUser\['stew_spent'\]\s*=\s*\$this->ops->i\(\$lockedUser, 'stew_spent'\)\s*\+/.test(src.slice(src.indexOf('function buy()'), src.indexOf('function collectDay()'))),
        'buy() не дублирует инкремент stew_spent отдельной строкой — доверяет Gameops::deduct()');
    assert(/if\(!\$this->ops->deduct\(\$lockedUser, \$cur, \$price\)\)/.test(src),
        'stew_spent инкрементируется на сервере при покупке через deduct(..., $cur, ...) (нужно для достижения spend_stew)');

    console.log('\nhabar.php — перенос награды урона Седого и оружия (та же семантика, что была в клиенте)');
    assert(/\$sedoyMax = max\(\$this->ops->i\(\$lockedUser, 'sedoy_dmg_total'\), \$amount\);/.test(src),
        'пул урона Седого перезаполняется до максимума (не накапливается бесконечно) — та же формула, что была в клиенте');
    assert(/private function _grantWeaponReward\(&\$user, \$type, \$amount\)\{/.test(src),
        '_grantWeaponReward портирован (тот же приём, что в poker.php) — начисляет и qty в weapons-блобе, и ammo_* поле');
}

console.log('\nusers.php — habar-поля убраны из client-writable whitelist, добавлены в resetSession()');
{
    const src = read('server/core/controllers/users.php');
    const allowedIdx = src.indexOf('$allowed = [');
    const allowedEnd = src.indexOf('\n            ];', allowedIdx);
    const allowedBody = src.slice(allowedIdx, allowedEnd);
    const allowedCode = allowedBody.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert(!/'habar_bought'/.test(allowedBody), 'habar_bought убран из $allowed — клиент больше не может его подделать через users.save');
    assert(!/'habar_days_collected'/.test(allowedBody), 'habar_days_collected убран из $allowed');
    assert(!/'habar_last_collect_ts'/.test(allowedBody), 'habar_last_collect_ts убран из $allowed');
    // 26.09.2026 (по прямому указанию, следующая сессия — баг "после повторного сбора хабара
    // урон седого откатывается на старый остаток"): sedoy_dmg_total/left ТОЖЕ убраны из
    // whitelist (users.php:205-223) — оба поля стали полностью server-authoritative (выдача —
    // habar.php.collectDay(), трата — bosses.php.useSedoy()), убирая и гонку автосейва, и
    // читерскую дыру с произвольным sedoy_dmg_left. Эта миграция была ещё не сделана на момент
    // написания этого теста (24.09.2026) — теперь актуальное поведение противоположное.
    assert(!/'sedoy_dmg_total'/.test(allowedCode), 'sedoy_dmg_total убран из $allowed — теперь server-authoritative (habar.php.collectDay()/bosses.php.useSedoy())');
    assert(!/'sedoy_dmg_left'/.test(allowedCode), 'sedoy_dmg_left убран из $allowed — та же миграция, закрывает гонку автосейва и читерскую дыру');

    const resetIdx = src.indexOf('function resetSession()');
    const resetEnd = src.indexOf('\n            ];', resetIdx);
    const resetBody = src.slice(resetIdx, resetEnd);
    assert(/'habar_bought'\s*=>\s*0,/.test(resetBody), 'resetSession() обнуляет habar_bought');
    assert(/'habar_days_collected'\s*=>\s*0,/.test(resetBody), 'resetSession() обнуляет habar_days_collected');
    assert(/'habar_last_collect_ts'\s*=>\s*0,/.test(resetBody), 'resetSession() обнуляет habar_last_collect_ts');
}

console.log('\nhabar.js — клиент больше не начисляет награды сам, только просит сервер и применяет patch');
{
    const src = read('_client/src/game/habar.js');
    assert(/TS\.php\('habar\.collectDay', \{\}, \(res\) => \{/.test(src), '_collectDay() реально зовёт новый серверный метод');
    assert(/applyPatch\(res\.patch\);/.test(src), 'применяет ответ через applyPatch (не мёржит поля вручную)');
    assert(!/udata\['coins'\]\s*=\s*String\(parseInt\(udata\['coins'\]\|\|0\)\s*\+\s*r\.amount\)/.test(src),
        'КРИТИЧНО: клиент больше не начисляет rewards.coins себе локально');
    assert(!/udata\['habar_days_collected'\]\s*=\s*String\(collected \+ 1\);/.test(src),
        'КРИТИЧНО: клиент больше не пишет habar_days_collected локально');
    assert(!/udata\['habar_last_collect_ts'\]\s*=\s*String\(now\);/.test(src),
        'КРИТИЧНО: клиент больше не пишет habar_last_collect_ts локально');
    assert(!/_addAmmoToWeapon/.test(src), '_addAmmoToWeapon удалён целиком — мёртвый код после переноса начисления оружия на сервер');
    assert(/if\(res\.patch\.weapons !== undefined && window\.weapons && typeof weapons\._loadFromUdata === 'function'\)\{/.test(src),
        'после патча с оружием обновляет window.weapons.data (тот же паттерн, что dvor-poker-game.js)');

    console.log('\nhabar.js._buyAndOpen() — collectDay() вызывается ТОЛЬКО внутри callback buy(), не параллельно (гонка)');
    const buyIdx = src.indexOf('_buyAndOpen(idx){');
    const buyEnd = src.indexOf('\n    }', src.indexOf('this._collectDay();', buyIdx));
    const buyBody = src.slice(buyIdx, buyEnd);
    assert(/TS\.php\('habar\.buy', \{container_id: idx\}, \(e\) => \{[\s\S]*this\._collectDay\(\);[\s\S]*\}, \(err\) => \{/.test(buyBody),
        '_collectDay() вызывается ВНУТРИ успешного callback habar.buy() — иначе он мог бы долететь до сервера раньше, чем покупка закоммичена, и получить fail(57)');
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);
