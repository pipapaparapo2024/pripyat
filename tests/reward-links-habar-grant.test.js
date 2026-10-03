/**
 * Test: 27.09.2026, по прямому указанию — "сделай на сайте где выдают награды выдачу хабаров
 * по ссылке, чтобы когда игрок перейдёт по ссылке у него будет доступен один из выбранных
 * хабаров и он может его собирать как обычно хабар собирают 30 дней".
 *
 * Механика хабара (см. server/core/controllers/habar.php): игрок покупает ОДИН контейнер за
 * игру целиком (habar_bought = containerId+1, "один хабар в одни руки", код=56 при повторной
 * попытке) — именно это поле разблокирует 30-дневный ежедневный сбор через habar.collectDay()
 * (server/json/habar_daily_config.json: total_days=30). Новый тип награды 'habar' в наградных
 * ссылках выдаёт ТО ЖЕ САМОЕ поле бесплатно, минуя оплату — без начисления собственно наград
 * дня (те по-прежнему выдаются только через collectDay(), день за днём, как обычно).
 *
 * Run: node tests/reward-links-habar-grant.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root     = path.join(__dirname, '..');
const siteRoot = path.join(__dirname, '..', '..', '..', 'сайт');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const rewardlinksSrc = read('server/core/controllers/rewardlinks.php');
const habarSrc        = read('server/core/controllers/habar.php');
const dailyConfig      = JSON.parse(read('server/json/habar_daily_config.json'));
const configSrc = fs.readFileSync(path.join(siteRoot, 'config.php'), 'utf-8');
const indexSrc  = fs.readFileSync(path.join(siteRoot, 'index.php'), 'utf-8');
const logsSrc   = fs.readFileSync(path.join(siteRoot, 'logs.php'), 'utf-8');

console.log('\nTest 1: server/core/controllers/rewardlinks.php — kind:"habar" выдаёт habar_bought=containerId+1, "один хабар в одни руки"');
{
    const start = rewardlinksSrc.indexOf("} else if(\$kind === 'habar'){");
    assert(start !== -1, 'ветка kind==="habar" найдена в claim()');
    const body = rewardlinksSrc.slice(start, rewardlinksSrc.indexOf('\n            }', start));

    assert(/\$containerId = intval\(\$entry\['containerId'\] \?\? -1\);/.test(body), 'читает containerId из награды');
    assert(/if\(\$containerId < 0 \|\| \$containerId > 3\) continue;/.test(body), 'валидирует диапазон 0-3 (4 тира хабара, как в habar_daily_config.json)');
    assert(/if\(\$this->ops->i\(\$user, 'habar_bought'\) > 0\) continue;/.test(body),
        '"один хабар в одни руки" — если у игрока УЖЕ есть хабар (куплен или получен раньше), строка молча пропускается, не перезаписывает');
    assert(/\$user\['habar_bought'\] = \$containerId \+ 1;/.test(body),
        'выдаёт ТО ЖЕ поле, что и покупка (habar.php.buy(): habar_bought = idx + 1) — единственный переключатель для collectDay()');
    assert(/\$summary\[\] = \['kind' => 'habar', 'containerId' => \$containerId\];/.test(body), 'попадает в summary для клиентского попапа наград');
}

console.log('\nTest 2: patch включает habar_bought — клиент узнаёт о выданном хабаре сразу, без перезахода');
{
    assert(/patchCurrencies\(\$user, array_merge\(self::CURRENCY_FIELDS, \['shmot', 'bosses_data', 'habar_bought'/.test(rewardlinksSrc),
        "'habar_bought' добавлен в список ключей patch");
}

console.log('\nTest 3: habar_bought НЕ добавлен в client-writable whitelist users.php (server-only поле, как и раньше)');
{
    const usersSrc = read('server/core/controllers/users.php');
    const allowedStart = usersSrc.indexOf("\$allowed = [");
    const allowedEnd   = usersSrc.indexOf('\n            ];', allowedStart);
    const allowedBlock = usersSrc.slice(allowedStart, allowedEnd);
    assert(!/'habar_bought'/.test(allowedBlock),
        'habar_bought остаётся server-only (пишут только Gameops::loadUser/saveUser в habar.php и rewardlinks.php, не generic users.save)');
}

console.log('\nTest 4: server/core/controllers/habar.php — collectDay() читает ИМЕННО habar_bought, значит выданный по ссылке хабар реально открывает 30-дневный сбор');
{
    assert(/\$boughtIdx = \$this->ops->i\(\$user, 'habar_bought'\) - 1;/.test(habarSrc),
        'collectDay() определяет купленный/выданный контейнер по habar_bought (тому же полю, что выставляет rewardlinks.php)');
    assert(/if\(\$boughtIdx < 0\) return \$this->ops->fail\(57\);/.test(habarSrc), 'без habar_bought>0 collectDay() отклоняет запрос (код 57)');
}

console.log('\nTest 5: server/json/habar_daily_config.json — 4 контейнера (0-3), 30 дней сбора, совпадает с диапазоном валидации выше');
{
    assert(Array.isArray(dailyConfig.containers) && dailyConfig.containers.length === 4,
        'ровно 4 контейнера (id 0-3) — совпадает с "containerId 0-3" в rewardlinks.php');
    assert(dailyConfig.total_days === 30, 'total_days === 30 — "собирать 30 дней", как в репорте');
    dailyConfig.containers.forEach((c, i) => assert(c.id === i, `container[${i}].id === ${i}`));
}

console.log('\nTest 6: сайт/config.php — habar_catalog() содержит все 4 тира теми же именами, что в habar_daily_config.json');
{
    assert(/function habar_catalog\(\)\{/.test(configSrc), 'habar_catalog() определена');
    const namesFromConfig = dailyConfig.containers.map(c => c.name);
    namesFromConfig.forEach(name => {
        assert(new RegExp("'" + name + "'").test(configSrc), `habar_catalog() содержит имя тира "${name}" (совпадает с habar_daily_config.json)`);
    });
}

console.log('\nTest 7: сайт/index.php — форма умеет создавать награду kind:"habar" (select + POST-парсинг + рендер сводки)');
{
    assert(/<option value="habar">Хабар/.test(indexSrc), 'в select kind_N есть опция "habar"');
    assert(/name="habar_id_<\?= \$i \?>"/.test(indexSrc), 'есть select habar_id_N для выбора тира контейнера');
    assert(/foreach\(habar_catalog\(\) as \$id => \$name\)/.test(indexSrc), 'select habar_id_N заполняется из habar_catalog()');

    const postStart = indexSrc.indexOf("} else if(\$kind === 'habar'){");
    assert(postStart !== -1, 'POST-обработчик action=create умеет парсить kind="habar"');
    const postBody = indexSrc.slice(postStart, indexSrc.indexOf('\n        }', postStart));
    assert(/\$habarId = intval\(\$_POST\["habar_id_\$i"\] \?\? -1\);/.test(postBody), 'читает habar_id_N из POST');
    assert(/\$habarId >= 0 && \$habarId <= 3/.test(postBody), 'валидирует диапазон 0-3 на стороне формы тоже (defense-in-depth, финальная проверка всё равно на сервере в rewardlinks.php)');
    assert(/\['kind' => 'habar', 'containerId' => \$habarId\]/.test(postBody), 'кладёт в $reward запись kind:habar,containerId');

    assert(/if\(\$kind === 'habar'\)\{[\s\S]{0,200}Хабар: ' \. \$name \. ' \(30 дней\)/.test(indexSrc),
        'render_reward_summary() показывает админу человекочитаемую сводку для habar-строки ("Хабар: <тир> (30 дней)")');

    assert(/document\.querySelector\(\'\[name="habar_id_\' \+ i \+ \'"\]\'\)\.style\.display\s*=\s*\(kind === 'habar'\) \? '' : 'none';/.test(indexSrc),
        'JS syncRow() показывает/скрывает habar_id_N вместе с остальными полями по выбранному kind');
}

console.log('\nTest 8: сайт/logs.php — та же человекочитаемая сводка для habar (независимая копия render_reward_summary, как и у остальных kind)');
{
    assert(/if\(\$kind === 'habar'\)\{[\s\S]{0,200}Хабар: ' \. \$name \. ' \(30 дней\)/.test(logsSrc),
        'render_reward_summary() в logs.php тоже понимает kind:"habar" (не разошлась с index.php)');
}

console.log('\nTest 9: клиент — _client/src/modules/reward-link.js и .../shell/popups/reward.js понимают kind/type "habar"');
{
    const rewardLinkSrc = read('_client/src/modules/reward-link.js');
    assert(/if\(s\.kind === 'habar'\)\s*return \{ type: 'habar', amount: 1 \};/.test(rewardLinkSrc),
        'checkRewardLink() маппит summary kind:"habar" в item {type:"habar"} для попапа наград');

    const popupSrc = read('_client/src/game/shell/popups/reward.js');
    assert(/habar:\s*'попап награда заначки\.png',/.test(popupSrc),
        'ICON_MAP в попапе наград знает иконку для type "habar" (переиспользует иконку "заначки" — та же тема "хабар/заначка", без нового ассета)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
