/**
 * Test: батч 19.09.2026 (по прямому указанию) — PvP-дуэль "заруба" с кнопки "зарубиться" на
 * экране визита к другу, плюс глобальный фикс сокращения "К" в попапе наград.
 *
 * ПЕРЕПИСАН 22.09.2026 (по прямому указанию, отдельный батч — уточнено: пункты про "силу",
 * "награду 100/100" и "неограниченные атаки" относятся к ЗАРУБЕ, не к боссам):
 *  - Кулдаун 24ч на пару (атакующий, цель) убран целиком — на одного игрока можно нападать без
 *    ограничений по количеству раз. zaruba_cooldowns/проверка удалены из zaruba.php полностью.
 *  - Награда за победу — фиксированная 100 сигарет / 100 опыта (было: случайный диапазон
 *    500-1500 каждое), проигравший по-прежнему ничего не получает.
 *  - "Сила" (str_xp_total) БОЛЬШЕ НЕ меняется победой/поражением в Зарубе — растёт только от
 *    клика "качнуть" другого игрока (см. zaruba-gym-pump.test.js). Исход дуэли по-прежнему
 *    определяется сравнением ТЕКУЩЕЙ силы, просто дуэль её больше не отменяет.
 *
 * 25.09.2026 (регресс найден повторным прогоном тестов — ещё один РЕВЕРС того же дня, см.
 * zaruba.php): фиксированная награда 100/100 из этого файла УБРАНА целиком (Заруба больше
 * ничего не начисляет), плюс исчез дневной лимит атак. Тесты 3/5/11 ниже подправлены под
 * актуальное поведение; полная, подробная проверка нового ("без лимита, без награды") поведения
 * живёт в отдельном, более новом файле —
 * tests/zaruba-no-limit-no-reward-and-friend-damage-asymmetry.test.js — не дублируем её здесь.
 *
 * Run: node tests/zaruba-duel-and-reward-k-format.test.js
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

const zarubaPhp   = readSrc('server/core/controllers/zaruba.php');
const registrySrc = readSrc('server/core/models/registry.php');
const usersPhp    = readSrc('server/core/controllers/users.php');
const errorsJson  = JSON.parse(readSrc('server/json/errors.json'));
const zarubaCfg   = JSON.parse(readSrc('server/json/zaruba_config.json'));
const rewardJs    = readSrc('_client/src/game/shell/popups/reward.js');
const profileJs   = readSrc('_client/src/game/shell/overlays/player_profile.js');

console.log('\nTest 1: registry.php — контроллер zaruba зарегистрирован в classes');
{
    assert(/'classes'=>array\([^)]*'zaruba'[^)]*\)/.test(registrySrc.replace(/\n/g, '')),
        "'zaruba' добавлен в registry.php classes (иначе universal.php отклонит метод как невалидный класс) — где-то внутри массива, не обязательно последним");
}

console.log('\nTest 2: zaruba_config.json — фиксированная награда 100/100, никакого кулдауна в конфиге');
{
    assert(zarubaCfg.cig_reward === 100, 'cig_reward === 100 (символичная фиксированная награда)');
    assert(zarubaCfg.exp_reward === 100, 'exp_reward === 100');
    assert(zarubaCfg.cig_min === undefined && zarubaCfg.cig_max === undefined, 'старый диапазон cig_min/cig_max убран из конфига');
    assert(zarubaCfg.cooldown_hours === undefined, 'cooldown_hours убран из конфига — атаковать можно без ограничений');
}

console.log('\nTest 3: zaruba.php.fight() — валидация параметров, БЕЗ проверки кулдауна');
{
    const start = zarubaPhp.indexOf('function fight(){');
    const end   = zarubaPhp.indexOf('\n        }', zarubaPhp.indexOf('$this->ops->ok(', start));
    const body  = zarubaPhp.slice(start, end);

    // 25.09.2026 (регресс найден повторным прогоном тестов): fight() рефакторен — $uid теперь
    // отдельная локальная переменная (не inline intval($this->registry['uid']) на каждой
    // проверке), и перед fail(91) добавлен error_log() по ПРАВИЛУ №8 (подробное логирование) —
    // сама валидация не изменилась, просто больше не однострочная. Regex обновлены под факт.
    assert(/if\(\$targetId <= 0\) return \$this->ops->fail\(54\);/.test(body), 'невалидный target_id → код 54');
    assert(/if\(\$targetId === \$uid\) return \$this->ops->fail\(90\);/.test(body),
        'нельзя зарубиться с самим собой → код 90');
    assert(/if\(isset\(\$targetRow\['error'\]\) && \$targetRow\['error'\]\)\{[\s\S]*?return \$this->ops->fail\(91\);/.test(body),
        'несуществующая цель → код 91 (внутри блока с error_log)');
    // 22.09.2026: кулдаун убран целиком — ни чтения zaruba_cooldowns, ни fail(92) в fight() нет.
    assert(!/zaruba_cooldowns/.test(body), 'fight() больше НЕ читает/пишет zaruba_cooldowns — атаковать можно без ограничений');
    assert(!/fail\(92\)/.test(body), 'fight() больше не возвращает код 92 (кулдаун убран) — код переиспользован для нового pump()');
}

console.log('\nTest 4: zaruba.php.fight() — исход дуэли по накопленной Силе (str_xp_total), не по уровню/RNG');
{
    const start = zarubaPhp.indexOf('function fight(){');
    const end   = zarubaPhp.indexOf('\n        }', zarubaPhp.indexOf('$this->ops->ok(', start));
    const body  = zarubaPhp.slice(start, end);

    assert(/\$myStrength\s*=\s*\$this->ops->i\(\$user, 'str_xp_total', 0\);/.test(body), 'своя сила — str_xp_total (не base_stats level)');
    assert(/\$targetStrength = intval\(\$targetRow\['str_xp_total'\] \?\? 0\);/.test(body), 'сила цели — тоже str_xp_total');
    assert(/\$won = \$myStrength >= \$targetStrength;/.test(body), 'победа определяется сравнением, не случайностью (ничья — победа атакующего)');
}

console.log('\nTest 5: zaruba.php.fight() — "Сила" НЕ меняется исходом дуэли, награда убрана целиком');
{
    const start = zarubaPhp.indexOf('function fight(){');
    const end   = zarubaPhp.indexOf('\n        }', zarubaPhp.indexOf('$this->ops->ok(', start));
    const body  = zarubaPhp.slice(start, end);

    // 22.09.2026: обе мутации str_xp_total (+1 победителю / -1 проигравшему) убраны целиком —
    // Заруба больше НИКАК не трогает "Силу", только сравнивает её для определения победителя.
    assert(!/\$myStrength = \$myStrength \+ 1/.test(body) && !/\$myStrength = max\(0, \$myStrength - 1\)/.test(body),
        '"Сила" атакующего не меняется ни при победе, ни при поражении');
    assert(!/\$targetStrength = max\(0, \$targetStrength - 1\)/.test(body) && !/\$targetStrength = \$targetStrength \+ 1/.test(body),
        '"Сила" цели не меняется ни при победе, ни при поражении');
    assert(!/\$user\['str_xp_total'\]/.test(body), 'str_xp_total атакующего вообще не сохраняется в $user — дуэль его не трогает');

    // 25.09.2026 (по прямому указанию — РЕВЕРС: "убери награду за победу, ничего не выдавай") —
    // фиксированная награда 100/100 из каталога, добавленная батчем 22.09.2026, убрана целиком.
    // Подробная проверка ("ничего не начисляется, ответ без reward, saveUser не вызывается")
    // вынесена в отдельный, более новый тест — см.
    // tests/zaruba-no-limit-no-reward-and-friend-damage-asymmetry.test.js — здесь достаточно
    // убедиться, что старая логика начисления реально отсутствует.
    assert(!/\$reward\[/.test(body), 'награда за победу (фиксированная из каталога) убрана целиком — переменной $reward больше нет');
    assert(!/\$this->ops->add\(/.test(body), 'fight() вообще не вызывает Gameops::add — ни победитель, ни проигравший ничего не получают');
    assert(!/rand\(intval\(\$catalog\['cig_min'\]/.test(body), 'старый rand() по диапазону (батч 19.09.2026) тоже отсутствует');
}

console.log('\nTest 6: zaruba.php.fight() — цель НЕ модифицируется вообще (только читается для сравнения силы)');
{
    const start = zarubaPhp.indexOf('function fight(){');
    const end   = zarubaPhp.indexOf('\n        }', zarubaPhp.indexOf('$this->ops->ok(', start));
    const body  = zarubaPhp.slice(start, end);

    // 22.09.2026: раз "Сила" цели больше не меняется, прямой udb->saveData() по цели (нужный
    // раньше, чтобы записать её -1/+1, пока она может быть офлайн) стал не нужен вообще.
    assert(!/\$targetUpdate/.test(body), 'targetUpdate/прямая запись цели убраны — fight() больше не пишет чужой аккаунт');
    assert((body.match(/\$this->registry\['udb'\]->saveData/g) || []).length === 0,
        'fight() не вызывает udb->saveData вообще — цель read-only');
    assert(/\$user\['zaruba_cooldowns'\]/.test(body) === false, 'кулдаун цели/себя не пишется — атаковать можно без ограничений');
}

console.log('\nTest 7: zaruba_cooldowns НЕ в client-writable whitelist users.php (историческая защита, поле не переиспользуется)');
{
    const allowedMatch = usersPhp.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!allowedMatch, '$allowed массив найден в users.php');
    assert(!/'zaruba_cooldowns'/.test(allowedMatch ? allowedMatch[1] : ''),
        "'zaruba_cooldowns' по-прежнему НЕ в whitelist (поле больше не используется, но и не должно попасть в whitelist задним числом)");
}

console.log('\nTest 8: errors.json — коды 90/91 по-прежнему зарегистрированы (92 переиспользован под pump(), не про Зарубу)');
{
    const codes = errorsJson.map(e => e.code);
    assert(codes.includes(90) && codes.includes(91), 'коды 90 (сам на себя), 91 (не найден) присутствуют');
}

console.log('\nTest 9: reward.js — formatRewardAmount сокращает числа от 1000 буквой "К" (последние 3 цифры отбрасываются)');
{
    assert(/export function formatRewardAmount\(n\)\{/.test(rewardJs), 'функция экспортирована (используется и в player_profile.js для панели зарубы)');
    assert(/if\(n >= 1000\) return Math\.floor\(n \/ 1000\) \+ 'К';/.test(rewardJs), 'от 1000 — floor(n/1000)+К, как объяснил пользователь (20000 → "20К")');
    assert(/'\+' \+ formatRewardAmount\(item\.amount\)/.test(rewardJs), 'применяется к сумме в попапе наград (вместо сырого item.amount)');

    // sanity-проверка формулы саму по себе (не паттерн-матчинг, а реальный вызов)
    function formatRewardAmount(n){ n = parseInt(n) || 0; if(n >= 1000) return Math.floor(n / 1000) + 'К'; return String(n); }
    assert(formatRewardAmount(20000) === '20К', '20000 → "20К" (пример пользователя, босс Жгут)');
    assert(formatRewardAmount(999) === '999', '999 (3 цифры) остаётся как есть, не сокращается');
    assert(formatRewardAmount(1500) === '1К', '1500 → "1К" (последние 3 цифры отброшены целиком, не округление до сотен)');
    assert(formatRewardAmount(0) === '0', '0 остаётся "0"');
}

console.log('\nTest 10: player_profile.js — "зарубиться" реально запускает дуэль через TS.php(\'zaruba.fight\'), без обработки кулдауна');
{
    const start = profileJs.indexOf('proto._startZaruba = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);

    assert(/TS\.php\('zaruba\.fight', \{target_id: profile\.id\}/.test(body), 'шлёт target_id профиля, на который зашли в гости');
    assert(/applyPatch\(res\.patch\);/.test(body), 'применяет патч сервера (обновляет свои сигареты/опыт)');
    assert(/this\._buildZarubaResultScreen\(win, res\);/.test(body), 'рисует экран итога после ответа сервера');
    // 22.09.2026: кулдаун убран целиком — клиент больше не показывает адресное сообщение про 24ч.
    assert(!/err && err\.code === 92/.test(body), 'обработчик кода 92 (кулдаун Зарубы) убран — атаковать можно без ограничений');
}

console.log('\nTest 11: player_profile.js — экран итога зарубы собран из всех запрошенных файлов на снятых позициях');
{
    const start = profileJs.indexOf('proto._buildZarubaResultScreen = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);

    assert(/PIXI\.Texture\.from\('\.\/images\/заруба задний фон\.png'\)/.test(body) && /bg\.x = -8; bg\.y = 72;/.test(body),
        'фон — x=-8,y=72 (картинка 7)');
    assert(/this\._buildZarubaCard\(zwin, 107, 132, res\.won,  myNick,             res\.my_strength\);/.test(body),
        'левая карточка (ты) — x=107,y=132 (картинка 8), шаблон зависит от res.won');
    assert(/this\._buildZarubaCard\(zwin, 780, 133, !res\.won, res\.target_nick,    res\.target_strength\);/.test(body),
        'правая карточка (соперник) — x=780,y=133 (картинка 9), противоположный шаблон');
    // 25.09.2026 (по прямому указанию — "убери файл панель награды, он не нужен"): панель
    // "заруба панель награды.png" вместе с формат-строками сигарет/опыта под ней убрана
    // целиком — победа в Зарубе больше ничего не начисляет (см. Test 5 выше и отдельный тест
    // tests/zaruba-no-limit-no-reward-and-friend-damage-asymmetry.test.js).
    assert(!/заруба панель награды\.png/.test(body.replace(/\/\/.*$/gm, '')), 'панель награды больше не создаётся (вне комментариев)');
    assert(/PIXI\.Texture\.from\('\.\/images\/заруба кнопка закрыть\.png'\)/.test(body) && /closeBtn\.x = 483; closeBtn\.y = 521;/.test(body),
        'кнопка закрыть — x=483,y=521 (картинка 11)');
}

console.log('\nTest 12: player_profile.js — карточка победитель/повержен показывает ник + значение силы (без больше не соответствующей действительности "дельты")');
{
    const start = profileJs.indexOf('proto._buildZarubaCard = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);

    assert(/const cardCfg = isWinner \? ZARUBA_CARD_LAYOUT\.won : ZARUBA_CARD_LAYOUT\.lost;/.test(body), 'выбирает шаблон победитель/проигравший по isWinner');
    // 22.09.2026: "+1 К СИЛЕ"/"-1 СИЛЫ" убраны — "Сила" больше не меняется исходом дуэли,
    // такая надпись вводила бы в заблуждение.
    assert(!/'\+1 К СИЛЕ'/.test(body) && !/'-1 СИЛЫ'/.test(body),
        'надпись "+1 К СИЛЕ"/"-1 СИЛЫ" убрана — она больше не соответствует действительности');
    assert(/fill: isWinner \? '#4ecb4e' : '#cb4e4e'/.test(body), 'цвет значения Силы зелёный/красный по исходу (как на референсе) — само значение остаётся');
    assert(/String\(strength \|\| 0\)/.test(body), 'значение Силы — реальное текущее число (не меняется дуэлью, но по-прежнему показывается)');
}

console.log('\nTest 13: новые ассеты зарубы скопированы под неймспейс-именами (защита от коллизий имён)');
{
    const imgDir = path.join(root, '_client', 'development', 'images');
    const expected = [
        'заруба задний фон.png', 'заруба победитель.png', 'заруба проигравший.png',
        'заруба панель награды.png', 'заруба кнопка закрыть.png',
    ];
    for(const f of expected){
        assert(fs.existsSync(path.join(imgDir, f)), 'файл существует: ' + f);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
