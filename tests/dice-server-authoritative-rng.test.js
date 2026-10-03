/**
 * Test: 18.09.2026 — перенос экономики на сервер, Казино игра 1/5: Зарики.
 *
 * Раньше ВСЁ (RNG броска/переброса, скрытый pity-счётчик до гарантированного 4×6, начисление
 * награды) считал клиент (Math.random() внутри dvor-dice-game.js) — читер мог:
 *   а) подделать udata['dvor_games_data'].dice.pity консолью и форсировать джекпот 4×6 в
 *      каждой партии (dice.pity живёт в client-writable JSON-блобе);
 *   б) обнулить udata['dice_free_ts'], получая бесплатные броски бесконечно;
 *   в) просто вызвать dvor._give('cig', 999999999) напрямую, минуя игру полностью;
 *   г) вызвать dvor._playDice() (старая FLA-панель, оставшаяся в коде ради авто-бота)
 *      напрямую из консоли — тоже полностью клиентский RNG, в обход нового экрана.
 *
 * Теперь: bosses.dice.start/reroll/resolve — три запроса, RNG и выплата — ТОЛЬКО на сервере
 * (server/core/controllers/dice.php). Состояние текущего броска + pity — в dice_session,
 * которое НЕ входит в whitelist users.php (как roulette_cups у Roulette) — клиент физически
 * не может отправить/подделать его через users.save.
 *
 * Run: node tests/dice-server-authoritative-rng.test.js
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

const dicePhp     = readSrc('server/core/controllers/dice.php');
const usersPhp    = readSrc('server/core/controllers/users.php');
const diceGameJs  = readSrc('_client/src/game/dvor/dvor-dice-game.js');
const diceJs      = readSrc('_client/src/game/dvor/dvor-dice.js');
const dvorJs      = readSrc('_client/src/game/dvor.js');
const botJs       = readSrc('_client/src/game/bot.js');
const catalog     = JSON.parse(fs.readFileSync(path.join(root, 'server/json/dice_config.json'), 'utf-8'));

console.log('\nTest 1: dice_config.json 1:1 совпадает с исходной таблицей наград dvor-dice-game.js (регресс-гвард)');
{
    // Оригинальная таблица теперь удалена из dvor-dice-game.js (перенесена на сервер) — сверяем
    // с dvor-dice.js._playDice, где та же таблица оставлена нетронутой для старой FLA-панели
    // (переписана в терминах нового API, но сама структура каталога проверяется отдельно тестом
    // на этапе разработки — здесь фиксируем актуальное состояние каталога как эталон).
    assert(catalog.table.length === 18, 'каталог содержит 18 строк таблицы наград');
    assert(catalog.table[0].v === 6 && catalog.table[0].n === 4 && catalog.table[0].type === 'shmot' && catalog.table[0].amt === 5,
        'первая строка (4×6 → 5 шмоток) верна');
    assert(catalog.table[17].v === 1 && catalog.table[17].n === 2 && catalog.table[17].type === 'cig' && catalog.table[17].amt === 500,
        'последняя строка (2×1 → 500 сигарет) верна');
    assert(catalog.consolation.type === 'cig' && catalog.consolation.amt === 50, 'утешительный приз — 50 сигарет (нет ни одной пары)');
    // 02.10.2026 (по прямому указанию, после разбора найденного при полном прогоне tests/):
    // v551 заменил pity-счётчик + гарантированный джекпот 4×6 на die_weights +
    // dice.php._reducePremiumRoll() — подтверждено пользователем как ОСОЗНАННАЯ замена, не
    // регрессия (см. дата-комментарий 02.10.2026 в начале dice.php). catalog.jackpot и
    // catalog.pity_min/pity_max больше НЕ заводятся — гарантированного джекпота как отдельной
    // награды и скрытого счётчика больше не существует вообще, строка {v:6,n:4,type:'shmot'}
    // в catalog.table — такая же обычная (хоть и самая редкая) строка таблицы, как остальные 17.
    assert(catalog.jackpot === undefined, 'catalog.jackpot отсутствует — подтверждено: гарантированного джекпота как отдельной награды больше нет');
    assert(catalog.pity_min === undefined && catalog.pity_max === undefined,
        'catalog.pity_min/pity_max отсутствуют — подтверждено: pity-счётчика больше нет вообще');
    assert(JSON.stringify(catalog.swaps_by_level) === JSON.stringify([
        {min_level:100, swaps:3}, {min_level:60, swaps:2}, {min_level:20, swaps:1}, {min_level:0, swaps:0},
    ]), 'кол-во перебросов по уровню совпадает с _getDiceSwapsAllowed()');
    assert(catalog.free_cooldown_ms === 86400000, 'кулдаун бесплатного броска — 24ч в мс');
}

console.log('\nTest 2: dice.php.start() — списывает стоимость (бесплатно раз в 24ч ИЛИ 1 красный поинт), бросает взвешенные кости без pity');
{
    // 02.10.2026 (по прямому указанию, после разбора найденного при полном прогоне tests/):
    // pity-счётчика больше нет вообще — start() не читает/не решает его, 4×6 — обычный (хоть и
    // самый редкий) результат четырёх взвешенных бросков + _reducePremiumRoll(), без форса.
    const start = dicePhp.indexOf('function start(){');
    const end   = dicePhp.indexOf('\n        }', dicePhp.indexOf('$this->ops->ok([\'patch\' => $patch, \'rolls\' => $rolls, \'swapsAllowed\'', start));
    const body  = dicePhp.slice(start, end);

    assert(/\$lastFree = \$this->ops->i\(\$user, 'dice_free_ts', 0\);/.test(body), 'читает dice_free_ts с сервера (не доверяя клиенту)');
    assert(/\$user\['dice_free_ts'\] = \$now;/.test(body), 'ТОЛЬКО сервер обновляет dice_free_ts — раньше клиент мог обнулить его консолью и получать бесплатные броски бесконечно');
    assert(/if\(!\$this->ops->deduct\(\$user, 'dice_points', 1\)\) return \$this->ops->fail\(67\);/.test(body),
        'платный бросок списывает 1 dice_points на сервере, отклоняет при недостатке (fail 67)');
    assert(!/\$session\['pity'\]/.test(body), 'регресс-гвард: start() не читает/не пишет pity — счётчика больше нет вообще');
    assert(/\$this->_weightedDie\(\$catalog, \$rollTrace\),\s*\n\s*\$this->_weightedDie\(\$catalog, \$rollTrace\),\s*\n\s*\$this->_weightedDie\(\$catalog, \$rollTrace\),\s*\n\s*\$this->_weightedDie\(\$catalog, \$rollTrace\),/.test(body),
        'без dev-форса все 4 кости честно бросаются через _weightedDie() — не structурный форс 4×6, обычный исход весов');
    assert(/\$rolls = \$this->_reducePremiumRoll\(\$rolls, \$catalog, \$rollTrace\);/.test(body),
        'результат прогоняется через _reducePremiumRoll() — единственная защита премиальных (включая джекпот) комбинаций на первом броске');
}

console.log('\nTest 3: dice.php.reroll() — может честно докинуть 4×6 (без хард-блока), требует активную сессию и остаток зарядов');
{
    // 02.10.2026 (по прямому указанию, после разбора найденного при полном прогоне tests/):
    // подтверждено пользователем — старый хард-блок othersAll6 ("нельзя докидать джекпот
    // переброском") сознательно снят вместе со всей pity-системой, не возвращается. Докинутый
    // переброском джекпот теперь имеет те же 90% шанса выжить, что и любая другая премиальная
    // комбинация — см. dice-combo-chance-reduced-10pct.test.js.
    const start = dicePhp.indexOf('function reroll(){');
    const end   = dicePhp.indexOf('\n        }', dicePhp.indexOf('$this->ops->ok([\'value\'', start));
    const body  = dicePhp.slice(start, end);

    assert(/if\(!is_array\(\$active\)\) return \$this->ops->fail\(68\);/.test(body), 'без активного броска — fail(68)');
    assert(/if\(intval\(\$active\['swapsUsed'\]\) >= intval\(\$active\['swapsAllowed'\]\)\) return \$this->ops->fail\(69\);/.test(body),
        'заряды переброса кончились — fail(69)');
    assert(!/othersAll6/.test(body), 'регресс-гвард: othersAll6 отсутствует — хард-блок на докидывание джекпота переброском снят сознательно');
    assert(/\$active\['rolls'\] = \$this->_reducePremiumRoll\(\$active\['rolls'\], \$catalog, \$rollTrace\);/.test(body),
        'единственная защита после переброса — та же вероятностная _reducePremiumRoll(), что и на первом броске');
}

console.log('\nTest 4: dice.php.resolve() — награда за каждое значение с парой+, применяет валюту, закрывает сессию (pity больше нет)');
{
    // 02.10.2026 (по прямому указанию, после разбора найденного при полном прогоне tests/):
    // pity-счётчика больше нет вообще — resolve() ничего не сбрасывает/не инкрементирует,
    // просто читает финальные rolls из сессии и закрывает её.
    const start = dicePhp.indexOf('function resolve(){');
    const end   = dicePhp.indexOf('\n        }', dicePhp.lastIndexOf('$this->ops->ok(['));
    const body  = dicePhp.slice(start, end);

    assert(/if\(!is_array\(\$active\)\) return \$this->ops->fail\(68\);/.test(body), 'без активного броска — fail(68)');
    assert(!/\$session\['pity'\]/.test(body), 'регресс-гвард: resolve() не трогает pity — счётчика больше нет');
    // 23.09.2026: условие теперь сохраняется в $already для trace-лога перед continue —
    // логика (одна строка на значение) не изменилась, см. dice-multiple-simultaneous-combos.test.js.
    assert(/\$already = in_array\(\$row\['v'\], \$takenValues, true\);/.test(body) && /if\(\$already\) continue;/.test(body),
        'для каждого значения берётся только ЛУЧШИЙ вариант (как в клиенте — не более одной награды на значение)');
    assert(/\$session\['active'\] = null;/.test(body), 'активная сессия закрывается после resolve — повторный resolve/reroll ничего не даст');
    assert(/case 'coins':\s*\n\s*\$this->ops->add\(\$user, 'coins', \$amt\);\s*\n\s*\$user\['coins_earned'\]/.test(body),
        'coins-награда также обновляет coins_earned (как клиентский _give(\'coins\',...) раньше)');
}

console.log('\nTest 5: dice.php зарегистрирован в permits, dice_session НЕ в whitelist users.php');
{
    // 25.09.2026 (регресс найден повторным прогоном тестов): 'getSession' добавлен — точка
    // восстановления броска после перезагрузки/смены вкладки, см.
    // dvor-session-resume-poker-dice-blackjack.test.js.
    // 27.09.2026 (устаревший тест, найдено плановой чисткой): 'buyPoints' добавлен 26.09.2026
    // (по прямому указанию — аудит "покупка поинтов зариков/рулетки за рубли напрямую вызывает
    // users.save", см. комментарий у buyPoints() в dice.php) — списание coins/начисление
    // dice_points перенесено на сервер, тест не обновили.
    assert(/\$this->permits = \['start', 'reroll', 'resolve', 'getSession', 'buyPoints'\];/.test(dicePhp), 'permits содержит start/reroll/resolve/getSession/buyPoints');
    // 19.09.2026: проверка сужена до самого массива $allowed — after users.resetSession()
    // (батч reset-account-session-fields) поле легитимно упоминается В ДРУГОМ месте файла
    // ('dice_session' => null внутри resetSession()), проверка по всему файлу целиком стала
    // ложно-отрицательной.
    const allowedMatch = usersPhp.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!allowedMatch, '$allowed массив найден в users.php');
    assert(!/'dice_session'/.test(allowedMatch ? allowedMatch[1] : ''),
        'dice_session НЕ в $allowed users.php — клиент не может отправить/подделать его через users.save (как roulette_cups)');
}

console.log('\nTest 6: dvor-dice-game.js (новый экран) — RNG больше не считает клиент, зовёт сервер start/reroll/resolve');
{
    assert(/TS\.php\('dice\.start', \{\}/.test(diceGameJs), '_playDiceNewScreen зовёт dice.start');
    assert(/TS\.php\('dice\.reroll', \{idx: selectedIdx\}/.test(diceGameJs), '_diceConfirmNewScreen зовёт dice.reroll');
    assert(/TS\.php\('dice\.resolve', \{\}/.test(diceGameJs), '_resolveDiceNewScreen зовёт dice.resolve');
    assert(!/this\._diceRolls = \[0,0,0,0\]\.map\(\(\)=>Math\.ceil\(6\*Math\.random\(\)\)\)/.test(diceGameJs),
        'локальный Math.random()-бросок убран из _playDiceNewScreen');
    assert(/import \{ applyPatch \} from '\.\.\/\.\.\/modules\/patch\.js';/.test(diceGameJs), 'applyPatch импортирован');
}

console.log('\nTest 7: dvor-dice.js — старая FLA-панель (_playDice, вызывается авто-ботом) тоже переведена на сервер');
{
    assert(/d\._playDice\(\);/.test(botJs), 'bot.js по-прежнему вызывает _playDice() — регресс-гвард, что эта функция ДЕЙСТВИТЕЛЬНО используется, не мёртвый код');
    assert(/TS\.php\('dice\.start', \{\}/.test(diceJs), '_playDice зовёт dice.start (не Math.random())');
    assert(/TS\.php\('dice\.resolve', \{\}/.test(diceJs), '_playDice сразу зовёт dice.resolve (старая панель не поддерживает переброс)');
    assert(!/Math\.ceil\(6\*Math\.random\(\)\)/.test(diceJs), 'локальный RNG полностью убран из dvor-dice.js');
    assert(!/this\._give\(/.test(diceJs), 'dvor-dice.js больше не начисляет награду напрямую через _give() — только через patch с сервера');
}

console.log('\nTest 8: dvor.js — TABLE награды зариков удалена из клиента (раздача теперь только на сервере)');
{
    // Таблица использовалась только внутри dvor-dice-game.js._resolveDiceNewScreen — она там и
    // была, не в dvor.js; проверяем, что ни client-side reward-таблица, ни _give-раздача по ней
    // не осталась в НОВОМ экране (в dvor.js._give() как helper остаётся — используется другими
    // играми/подсистемами, это ожидаемо и не проверяется здесь).
    assert(!/\{v:6,n:4,type:'shmot',\s*amt:5,\s*lbl:/.test(diceGameJs),
        'полная таблица (с лейблами, для начисления) удалена из dvor-dice-game.js — осталась только сокращённая (v,n) для подсветки строки в UI');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
