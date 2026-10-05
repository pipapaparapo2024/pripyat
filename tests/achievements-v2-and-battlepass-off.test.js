/**
 * Test: большой пакет 15.09.2026 —
 *  1) Battle Pass временно отключён (был частично отключён раньше: кнопка "пропуск"
 *     disabled:true, addXp() возвращает сразу — но у Василича оставалась рабочая
 *     лазейка: 3 товара напрямую двигали bpLevel в обход addXp()). Лазейка закрыта.
 *  2) Заведены новые счётчики для достижений: coins_spent (11 мест списания рублей),
 *     votes_spent (bank.js.successDonat, единая точка VK-доната), str_xp_total
 *     (base.js._trainStat, только "Сила"), login_streak/last_login_day (preloader.js,
 *     реальный стрик подряд идущих дней, а не days_played — тот считает просто
 *     "дней с момента регистрации", даже если игрок не заходил).
 *  3) server/users.php — критический баг: 'achievements' и 'achievement_stars' вообще
 *     не были в whitelist, весь прогресс достижений жил только в памяти браузера.
 *  4) ~137 новых достижений по присланному руководителем полному списку — экономические
 *     (опыт/сигареты/рубли/тушенка), качалка, сила, стрик входов, БП (дормант), траты
 *     (голоса/рубли/тушенка), друзья, мета (сумма очков достижений). "Бои с игроком"
 *     сознательно НЕ добавлены — механики PvP в игре нет вообще.
 *
 * Run: node tests/achievements-v2-and-battlepass-off.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game');
const achSrc      = fs.readFileSync(path.join(root, 'achievements.js'), 'utf-8');
const popupSrc    = fs.readFileSync(path.join(root, 'shell', 'popups', 'achievement.js'), 'utf-8');
const vassSrc     = fs.readFileSync(path.join(root, 'vassilich.js'), 'utf-8');
const baseSrc     = fs.readFileSync(path.join(root, 'base.js'), 'utf-8');
const bankSrc     = fs.readFileSync(path.join(root, 'bank.js'), 'utf-8');
const preloaderSrc= fs.readFileSync(path.join(root, 'preloader.js'), 'utf-8');
const gangsSrc    = fs.readFileSync(path.join(root, 'gangs.js'), 'utf-8');
const hapugaSrc   = fs.readFileSync(path.join(root, 'hapuga.js'), 'utf-8');
const usersPhpSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const basePhpSrc      = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'base.php'), 'utf-8');
const vassilichPhpSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'vassilich.php'), 'utf-8');

console.log('\nTest 1: Battle Pass лазейка у Василича закрыта');
{
    assert(!/\{id:3, icon:'🏆', name:'БП \+5 уровней'/.test(vassSrc) || /\/\/ \{id:3, icon:'🏆', name:'БП \+5 уровней'/.test(vassSrc),
        'товар id:3 (БП +5 уровней) закомментирован, а не активен');
    assert(/\/\/ \{id:4, icon:'🏆', name:'БП \+11 уровней'/.test(vassSrc), 'товар id:4 закомментирован');
    assert(/\/\/ \{id:5, icon:'🏆', name:'БП \+24 уровня'/.test(vassSrc), 'товар id:5 закомментирован');
    assert(/\/\/ if\(effect\.bp_levels && window\.battlepass\)\{/.test(vassSrc), 'ветка effect.bp_levels в _applyEffect закомментирована');
    assert(/Бател Пасс временно отключён/.test(vassSrc), 'причина задокументирована комментарием');
}

console.log('\nTest 2: новые счётчики достижений заведены и проведены');
{
    // coins_spent — хотя бы в нескольких ключевых местах (полную проверку всех 12 файлов не дублируем)
    // 27.09.2026 (base.js/vassilich.js переведены на честный запрос-ответ — см.
    // tests/base-server-authoritative-upgrade-and-train.test.js и
    // tests/vassilich-server-authoritative-buy-and-loot.test.js): coins_spent/stew_spent для
    // этих двух мест списания больше НЕ считает клиент локально (убран вместе со старым
    // локальным списанием валюты) — счётчик переехал на сервер, в base.php.upgrade()/
    // vassilich.php.buy(), тем же приёмом, что уже применён в habar.php.buy() для stew_spent.
    // 05.10.2026 (стале-пин, не регрессия — параллельная сессия добавила блокировку строки в
    // base.php/vassilich.php, см. tests/base-server-authoritative-upgrade-and-train.test.js):
    // счётчик теперь копится на залоченной копии $lockedUser, не на $user напрямую.
    assert(/if\(isset\(\$cost\['coins'\]\)\) \$lockedUser\['coins_spent'\] = \$this->ops->i\(\$lockedUser, 'coins_spent'\) \+ intval\(\$cost\['coins'\]\);/.test(basePhpSrc),
        'coins_spent проведён в base.php (апгрейд зданий, server-authoritative)');
    assert(/if\(\$type === 'coins'\) \$lockedUser\['coins_spent'\] = \$this->ops->i\(\$lockedUser, 'coins_spent'\) \+ \$amount;/.test(vassilichPhpSrc),
        'coins_spent проведён в vassilich.php (server-authoritative, было только stew_spent)');
    // 27.09.2026 (аудит whitelist-гонки — см. tests/coins-stew-spent-server-authoritative-
    // whitelist-and-race.test.js): gangs.js/hapuga.js больше НЕ пишут coins_spent локально —
    // перенесено на сервер (gangs.php.donate()/hapuga.php.buy()), тем же приёмом, что и
    // base.php/vassilich.php выше.
    const gangsPhpSrc  = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'gangs.php'), 'utf-8');
    const hapugaPhpSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'hapuga.php'), 'utf-8');
    assert(/if\(\$c\['coins'\]\) \$user\['coins_spent'\] = \$this->ops->i\(\$user, 'coins_spent'\) \+ \$c\['coins'\];/.test(gangsPhpSrc),
        'coins_spent проведён в gangs.php (донат банде, server-authoritative)');
    assert(/\$user\['coins_spent'\] = \$this->ops->i\(\$user, 'coins_spent'\) \+ \$sale;/.test(hapugaPhpSrc),
        'coins_spent проведён в hapuga.php (покупка у хапуги, server-authoritative)');

    // votes_spent — с 27.09.2026 начисляет СЕРВЕР (universal_pay.php), тем же запросом, что и
    // саму валюту. Локальная запись в bank.js была причиной критического бага «валюта не
    // начисляется» — см. tests/bank-votes-spent-server-side-no-stale-save.test.js.
    assert(/_votesForItem\(itemNum\)\{/.test(bankSrc), '_votesForItem(itemNum) — helper для расчёта цены в голосах (остался для лога)');
    assert(!/udata\['votes_spent'\] = /.test(bankSrc),
        'bank.js больше НЕ пишет votes_spent локально (иначе тянет за собой users.save со старой валютой)');
    const payPhpSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'universal_pay.php'), 'utf-8');
    assert(/\$user\['votes_spent'\] = \$registry\['tools'\]->summ\(\$user\['votes_spent'\] \?\? 0, \$votes\);/.test(payPhpSrc),
        'votes_spent начисляет вебхук universal_pay.php той же записью, что и валюту');

    // str_xp_total — только для "Сила" (idx===0)
    // 27.09.2026 (base.js._trainStat переведён на честный запрос-ответ — см.
    // tests/base-server-authoritative-upgrade-and-train.test.js): проверка раньше искала
    // однострочный if(idx===0) udata[...]=...; — код теперь блочный (if(idx===0){ const
    // gainedXp=...; udata[...]=...; }, внутри колбэка ответа сервера), сам инвариант
    // (str_xp_total копится только для idx===0) не изменился, обновлено под новую форму.
    assert(/if\(idx === 0\)\{[\s\S]{0,200}udata\['str_xp_total'\] = \(parseInt\(udata\['str_xp_total'\] \|\| 0\) \+ gainedXp\)\.toString\(\);/.test(baseSrc),
        'str_xp_total копится ТОЛЬКО для характеристики "Сила" (idx 0), не для всех трёх');

    // login_streak — реальный стрик, не days_played
    assert(/_updateLoginStreak\(\)\{/.test(preloaderSrc), '_updateLoginStreak найден в preloader.js');
    assert(/if\(diffDays === 1\)\{\s*\n\s*udata\['login_streak'\] = String\(\(parseInt\(udata\['login_streak'\] \|\| 0\)\) \+ 1\);/.test(preloaderSrc),
        'стрик увеличивается только при РОВНО +1 дне от последнего входа');
    assert(/udata\['login_streak'\] = '1';/.test(preloaderSrc), 'разрыв (пропущенный день) сбрасывает стрик на 1, а не обнуляет');
}

console.log('\nTest 3: server whitelist — критический баг с achievements исправлен');
{
    const m = usersPhpSrc.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!m, '$allowed массив найден');
    if(m){
        // 27.09.2026: whitelist густо прокомментирован — в комментариях НАМЕРЕННО называются
        // поля, которые из него УБРАНЫ (с историей почему). Проверять надо только реальные
        // элементы массива, иначе assert «поле НЕ в whitelist» ложно падает, а assert «поле В
        // whitelist» ложно ПРОХОДИТ по упоминанию в комментарии (именно так 'coins_spent' ниже
        // продолжал «проходить» после того, как его убрали из списка в этот же день).
        const body = m[1].split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
        // 23.09.2026 (перенос достижений на сервер, репорт "ачивки вылетают как попало"):
        // achievements/achievement_stars/ach_score/bullets УБРАНЫ из whitelist — теперь их
        // читает и пишет ТОЛЬКО сервер (achievements.php.sync(), тот же класс поля, что
        // skills_levels/dice_session) — раньше клиент мог выставить achievement_stars/bullets
        // любым числом одним users.save.
        assert(!/'achievements'/.test(body), "'achievements' (earned-карта) НЕ в whitelist — пишет только сервер");
        assert(!/'achievement_stars'/.test(body), "'achievement_stars' (общий счёт) НЕ в whitelist — пишет только сервер");
        assert(!/'ach_score'/.test(body), "'ach_score' НЕ в whitelist — пишет только сервер");
        assert(!/'bullets'/.test(body), "'bullets' НЕ в whitelist — пишет только сервер");
        // 27.09.2026: 'coins_spent'/'stew_spent' УБРАНЫ из whitelist (гонка дебаунс-автосейва
        // со server-authoritative счётчиком, см. коммент в users.php), 'votes_spent' — тоже,
        // но по более жёсткой причине: именно его локальная запись в bank.js.successDonat()
        // тянула за собой users.save со СТАРОЙ валютой и затирала начисление вебхука VK.
        assert(!/'coins_spent'/.test(body), "'coins_spent' НЕ в whitelist — ведёт только сервер");
        assert(!/'votes_spent'/.test(body), "'votes_spent' НЕ в whitelist — начисляет только вебхук universal_pay.php");
        assert(/'str_xp_total'/.test(body), "'str_xp_total' в whitelist");
        assert(/'login_streak'/.test(body), "'login_streak' в whitelist");
        assert(/'last_login_day'/.test(body), "'last_login_day' в whitelist");
    }
    const resetMatch = usersPhpSrc.match(/function resetSession\(\)\{([\s\S]*?)\n        \}/);
    assert(!!resetMatch, 'resetSession() найден');
    if(resetMatch){
        const resetBody = resetMatch[1];
        assert(/'achievements'\s*=> null,/.test(resetBody), "сброс аккаунта обнуляет 'achievements'");
        assert(/'achievement_stars'\s*=> 0,/.test(resetBody), "сброс аккаунта обнуляет 'achievement_stars'");
        assert(/'ach_score'\s*=> 0,/.test(resetBody), "сброс аккаунта обнуляет 'ach_score'");
        assert(/'bullets'\s*=> 0,/.test(resetBody), "сброс аккаунта обнуляет 'bullets'");
    }
}

console.log('\nTest 4: новый список достижений — целостность (без дублей id, сумма очков)');
{
    const ids = [...achSrc.matchAll(/\bid:'([a-z0-9_]+)'/g)].map(m => m[1]);
    const seen = new Set(); let dupFound = null;
    for(const id of ids){ if(seen.has(id)){ dupFound = id; break; } seen.add(id); }
    assert(dupFound === null, 'нет дублирующихся id во всём списке достижений (' + ids.length + ' записей)');
    assert(ids.length >= 250, 'список достижений реально расширен (было ~115, стало ' + ids.length + ')');

    // 15.09.2026: раздел "Бои с игроком" (pvp) изначально был сознательно исключён (в игре
    // не было PvP-механики) — сумма была 4412 (4455 минус 43 очка pvp). Пользователь позже
    // сам добавил категорию 'pvp' отдельной правкой (вне этой сессии) — теперь сумма снова
    // ровно 4455, как в исходном присланном списке. Обновлено по факту, не откатываем.
    const ptsSum = [...achSrc.matchAll(/pts:(\d+)/g)].reduce((s,m) => s + parseInt(m[1]), 0);
    assert(ptsSum === 4455, 'суммарные очки всех достижений — 4455 (включая добавленный позже раздел pvp)');
}

console.log('\nTest 5: новые категории достижений присутствуют с ожидаемым числом записей');
{
    const catCounts = {};
    for(const m of achSrc.matchAll(/cat:'([a-z_]+)'/g)) catCounts[m[1]] = (catCounts[m[1]]||0) + 1;
    const expected = {
        exp: 16, cig_hoard: 8, coins_hoard: 14, stew_hoard: 16,
        gym: 6, strength: 8, streak: 7, bp: 6,
        spend_votes: 14, spend_coins: 12, spend_stew: 13,
        friends: 7, meta: 9,
    };
    for(const [cat, count] of Object.entries(expected)){
        assert(catCounts[cat] === count, `категория '${cat}': ${catCounts[cat]||0} записей (ожидалось ${count})`);
    }
    assert(catCounts['pvp'] === 6, 'категория PvP ("Бои с игроком") добавлена пользователем позже — 6 записей');
}

console.log('\nTest 6: _state() отдаёт все новые поля, используемые новыми check()');
{
    const m = achSrc.match(/_state\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, '_state() найден');
    if(m){
        const body = m[1];
        for(const field of ['exp:', 'cig:', 'coinsBalance:', 'stewBalance:', 'trainCount:', 'strXp:', 'loginStreak:', 'bpLevel:', 'votesSpent:', 'coinsSpent:', 'stewSpent:', 'friendsCount:', 'achPts:']){
            assert(body.includes(field), `_state() возвращает поле ${field.replace(':','')}`);
        }
    }
}

console.log('\nTest 7: попап — иконки и описания для новых категорий');
{
    for(const cat of ['exp','cig_hoard','coins_hoard','stew_hoard','gym','strength','streak','spend_votes','spend_coins','spend_stew','friends']){
        assert(popupSrc.includes(cat + ':') , `CAT_ICON содержит запись для '${cat}'`);
    }
    for(const cat of ['exp','cig_hoard','coins_hoard','stew_hoard','gym','strength','streak','bp','spend_votes','spend_coins','spend_stew','friends','meta']){
        assert(popupSrc.includes("case '" + cat + "':"), `_achievementDesc обрабатывает категорию '${cat}'`);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
