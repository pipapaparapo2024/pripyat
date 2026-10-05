/**
 * Test: 18.09.2026 — перенос экономики на сервер: Ящик (лутбокс).
 *
 * Раньше yashik.js._openOtkrytYashik() САМА катала награду (Math.random() на нычки/сигареты/
 * рубли/опыт/7% шанс шмотки) и списывала стоимость (obyskat pointerdown решал сам — 1 патрон
 * ИЛИ 50 очков достижений) — читер мог вызвать _openOtkrytYashik() напрямую из консоли без
 * единого патрона, либо просто присвоить себе валюту через udata.
 *
 * Теперь: yashik.openBox (сервер списывает патрон/очки, катает и ОТКЛАДЫВАЕТ награду в
 * yashik_session) → yashik.collect (начисляет отложенное). yashik_session НЕ входит в
 * whitelist users.php (как dice_session/roulette_cups) — клиент не может подделать отложенную
 * награду через users.save. Двухфазная схема сохраняет оригинальный UX: кнопка "НАЗАД" может
 * сжечь уже выпавшую, но не забранную награду (collect() просто не вызывается).
 *
 * Run: node tests/yashik-server-authoritative-lootbox.test.js
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

const yashikPhp = readSrc('server/core/controllers/yashik.php');
const usersPhp  = readSrc('server/core/controllers/users.php');
const yashikJs  = readSrc('_client/src/game/shell/overlays/yashik.js');
const shmotJs   = readSrc('_client/src/game/shmot.js');
const catalog   = JSON.parse(fs.readFileSync(path.join(root, 'server/json/yashik_config.json'), 'utf-8'));

console.log('\nTest 1: yashik_config.json 1:1 совпадает с исходными диапазонами yashik.js (регресс-гвард)');
{
    // Диапазоны сверены построчно при переносе (см. verify-скрипт в истории разработки):
    // stashGain = 10+floor(rand*11) → [10,20]; cigsGain = 5000+floor(rand*5001) → [5000,10000];
    // coinsGain = 5+floor(rand*11) → [5,15]; expGain = 100+floor(rand*400) → [100,499] (НЕ 500!
    // Math.random() эксклюзивно к 1, floor(x*400) даёт 0..399).
    assert(catalog.stash_min === 10 && catalog.stash_max === 20, 'нычки: 10-20');
    assert(catalog.cig_min === 5000 && catalog.cig_max === 10000, 'сигареты: 5000-10000');
    assert(catalog.coins_min === 5 && catalog.coins_max === 15, 'рубли: 5-15');
    assert(catalog.exp_min === 100 && catalog.exp_max === 499, 'опыт: 100-499 (не 500 — частая ошибка off-by-one)');
    // 02.10.2026 (ОБНОВЛЕНО повторным прогоном полного каталога тестов): shmot_chance_bp был
    // "временно недоступен" ещё с 23.09.2026 (пул id0-40 опустел — см. комментарий ниже), а
    // теперь дизайн пересмотрен окончательно — поле убрано из каталога целиком, обычная
    // награда ящика НЕ содержит случайную одежду (см. casino-loot-policy.test.js "Обычный
    // ящик не выдаёт случайную одежду", 100% источник шмота из ящика теперь — Потерянный
    // тайник, см. yashik-lost-stash-and-dev-force-drops.test.js).
    assert(catalog.shmot_chance_bp === undefined, 'shmot_chance_bp убран из каталога целиком (мёртвая настройка, редизайн)');
    assert(catalog.bullet_cost_ach === 50, 'стоимость патрона в очках достижений — 50 (ACH_THRESHOLD)');
    assert(catalog.patron_cost_stew === 50, 'стоимость покупки патрона — 50 тушёнки (PATRON_COST)');
    // 23.09.2026 (найдено этим же полным прогоном tests/, ПОСЛЕ батча "убери все шмотки,
    // которые не выбиваются с боссов" — весь id0-40 удалён из shmot.js целиком, см.
    // shmot-remove-purchasable-base-shop-keep-only-drops.test.js): пул этой награды всегда
    // был РОВНО id0-40 (см. историю ниже — и до, и после появления дроп-предметов id41+ этот
    // тест намеренно требовал shmot_item_count===41, именно чтобы дроп-вещи НЕ участвовали в
    // случайном розыгрыше). Теперь эталонного пула физически не осталось — yashik.php больше
    // НЕ выдаёт шмотку из ящика вообще (shmot_item_count:0 → пул всегда пуст → shmotId
    // остаётся null, тот же путь кода, что и "уже владеет всем в пуле"), пока дизайн награды
    // не пересмотрят отдельно. lost_stash_sequence (редкий pity-дроп, отдельный механизм) не
    // затронут — все 15 id там ≥41, см. Test 1 конфига выше.
    // 02.10.2026: "временно недоступна" выше подтвердилась — shmot_item_count тоже убран из
    // каталога вместе с shmot_chance_bp, механика не "пустая", а полностью удалена.
    assert(catalog.shmot_item_count === undefined, 'shmot_item_count тоже убран из каталога (была мёртвой настройкой того же удалённого пула id0-40)');

    const idMatches = [...shmotJs.matchAll(/id:(\d+),/g)].map(m => +m[1]);
    const legacyPurchasableIds = idMatches.filter(id => id <= 40);
    // 19.09.2026: +16 предметов вторым батчем дропов (id73-88).
    // 21.09.2026: +2 предмета сета "новопришедший" (id94/95, пересборка из _organized).
    // 22.09.2026: -1 (id93 удалён, не входил в канон) +4 финальной сверки (id96-99).
    // 23.09.2026 (чистка байт-в-байт дублей): 90 → 85 (см. shmot-rename-and-tooltip.test.js).
    // Восстановлены все 14 предметов, для которых появились исходники в _organized.
    // Диапазон id0-40 по-прежнему не возвращён: в каталоге только дропы.
    // 28.09.2026: +1 псевдо-предмет id:100 "Связка ключей" (см. tests/shmot-keyring-shown-as-item.test.js). 58 → 59.
    assert(idMatches.length === 59, 'в shmot.js всего 59 предметов (58 дропов id≥41 + псевдо-предмет id:100), получили ' + idMatches.length);
    assert(legacyPurchasableIds.length === 0, 'ни одного id из диапазона 0-40 в shmot.js больше не осталось');
}

console.log('\nTest 2: yashik.php.openBox() — списывает патрон ИЛИ очки достижений, откладывает награду (не начисляет сразу)');
{
    // 22.09.2026: конец openBox() сдвинулся (добавлен блок "Потерянный тайник" и
    // dev_force_drops) — ищем по функции целиком, не по точному литералу последней строки.
    const start = yashikPhp.indexOf('function openBox(){');
    const end   = yashikPhp.indexOf('\n        function buyPatron(){', start);
    const body  = yashikPhp.slice(start, end);

    // 05.10.2026 (стале-пин, не регрессия — см. аудит гонок состояний 04.10.2026: openBox()
    // получил SELECT...FOR UPDATE, вся бизнес-логика теперь на залоченной копии $lockedUser,
    // фейл-ветки обёрнуты в rollback/close перед return).
    assert(/if\(\$bullets > 0\)\{\s*\n\s*\$lockedUser\['bullets'\] = \$bullets - 1;/.test(body), 'при наличии патрона списывает именно его (приоритет над очками достижений)');
    assert(/if\(\$ach < \$achCost\)\{[\s\S]{0,120}?return \$this->ops->fail\(70\);/.test(body), 'без патрона и очков достижений — fail(70)');
    assert(/\$lockedUser\['ach_score'\] = \$ach - \$achCost;/.test(body), 'без патрона списывает очки достижений');
    assert(/\$lockedUser\['yashik_session'\] = json_encode\(\$session\);/.test(body),
        'награда откладывается в yashik_session, а НЕ начисляется сразу в этом методе — сохраняет UX "НАЗАД сжигает награду"');
    assert(!/->add\(\$user, 'cigarettes'/.test(body) && !/->add\(\$user, 'coins'/.test(body) && !/->add\(\$user, 'exp'/.test(body),
        'openBox() не начисляет валюту напрямую (нет Gameops::add на cigarettes/coins/exp) — это делает только collect()');
}

console.log('\nTest 3: yashik.php.buyPatron() — списывает тушёнку, выдаёт патрон');
{
    const start = yashikPhp.indexOf('function buyPatron(){');
    const end   = yashikPhp.indexOf('\n        }', yashikPhp.indexOf('$this->ops->ok([\'patch\' => $patch\]\);', start) > -1 ? yashikPhp.indexOf('$this->ops->ok([\'patch\' => $patch]);', start) : yashikPhp.length);
    const body  = yashikPhp.slice(start, end);
    // 24.09.2026 (баг "нужно 50, у меня 104"): проверка баланса теперь явная (ДО deduct), с
    // кастомным ответом need/have вместо голого fail(71) — тот же код 71, но клиент получает
    // ещё и реальные цифры (см. yashik-full-report тест ниже или сам yashik.php).
    assert(/if\(\$have < \$cost\)\{/.test(body) && /'code'=>71, 'need'=>\$cost, 'have'=>\$have/.test(body),
        'недостаточно тушёнки — явная проверка балансa (сервер сам проверяет, не доверяя клиенту), код 71 + реальные need/have');
    // 05.10.2026 (стале-пин, не регрессия — buyPatron() получил SELECT...FOR UPDATE, $lockedUser вместо $user).
    assert(/\$lockedUser\['bullets'\] = \$this->ops->i\(\$lockedUser, 'bullets'\) \+ 1;/.test(body), 'патрон реально выдаётся после списания');
}

console.log('\nTest 4: yashik.php.collect() — начисляет отложенную награду ровно один раз, закрывает сессию');
{
    const start = yashikPhp.indexOf('function collect(){');
    const end   = yashikPhp.lastIndexOf('}');
    const body  = yashikPhp.slice(start, end);

    // 05.10.2026 (стале-пин, не регрессия — collect() получил SELECT...FOR UPDATE, $lockedUser вместо $user).
    assert(/if\(!is_array\(\$session\)\)\{[\s\S]{0,120}?return \$this->ops->fail\(72\);/.test(body), 'нечего забирать (не открывали / уже забрали) — fail(72)');
    assert(/\$this->ops->add\(\$lockedUser, 'stash_count', intval\(\$session\['stash'\]\)\);/.test(body), 'начисляет нычки в stash_count (не habar_counts — та же коллизия полей, что уже чинили)');
    assert(/\$this->ops->add\(\$lockedUser, 'cigarettes', intval\(\$session\['cig'\]\)\);/.test(body), 'начисляет сигареты');
    assert(/\$this->ops->add\(\$lockedUser, 'coins', intval\(\$session\['coins'\]\)\);/.test(body), 'начисляет рубли');
    assert(/\$this->ops->add\(\$lockedUser, 'exp', intval\(\$session\['exp'\]\)\);/.test(body), 'начисляет опыт');
    assert(/\$lockedUser\['yashik_session'\] = null;/.test(body), 'сессия закрывается после начисления — повторный collect() ничего не даст (fail(72))');
}

console.log('\nTest 5: обычная награда ящика больше не включает случайную одежду из общего пула (редизайн 02.10.2026) — единственный источник шмота из ящика теперь Потерянный тайник, с собственным owned-фильтром');
{
    // 22.09.2026: конец openBox() сдвинулся (добавлен блок "Потерянный тайник" и
    // dev_force_drops, см. yashik-lost-stash-and-dev-force-drops.test.js) — ищем по функции
    // целиком, а не по точному литералу последней строки ok([...]), который с тех пор изменился.
    const start = yashikPhp.indexOf('function openBox(){');
    const end   = yashikPhp.indexOf('\n        function buyPatron(){', start);
    const body  = yashikPhp.slice(start, end);
    // 02.10.2026 (ОБНОВЛЕНО повторным прогоном полного каталога тестов — см.
    // casino-loot-policy.test.js "Обычный ящик не выдаёт случайную одежду"): старая формула
    // "7% шанс из общего пула id0-40 с owned-фильтром" была мёртвой уже с 23.09.2026 (пул был
    // пуст), теперь убрана из кода вовсе — $shmotId в session всегда null, никакого
    // rand(1,10000)/array_rand по общему пулу в openBox() больше нет.
    assert(!/shmot_chance_bp/.test(body), 'rand(1,10000) <= shmot_chance_bp по общему пулу убран из openBox() целиком');
    assert(/\$shmotId = null;/.test(body), 'session.shmotId всегда null — обычная награда ящика никогда не содержит случайную одежду');
    // Owned-фильтр "не выдать дубликат уже полученного предмета" никуда не делся — он просто
    // переехал в блок Потерянного тайника (единственный оставшийся источник шмота из ящика),
    // см. yashik-lost-stash-and-dev-force-drops.test.js Test 2 для полной проверки этой формулы.
    assert(/if\(empty\(\$shmotArr\[\$itemId\]\['owned'\]\)\) \$available\[\] = \$itemId;/.test(body),
        'owned-фильтр (не выдать дубликат) сохранён — теперь внутри блока Потерянного тайника, единственного живого источника шмота из ящика');
}

console.log('\nTest 6: fail-коды уникальны в проекте, yashik_session/permits настроены верно');
{
    assert(/\$this->permits = \['openBox', 'buyPatron', 'collect'\];/.test(yashikPhp), 'permits содержит openBox/buyPatron/collect');
    // 19.09.2026: сужено до массива $allowed — 'yashik_session' легитимно упоминается ещё и в
    // users.resetSession() ('yashik_session' => null), проверка по всему файлу стала ложно-отрицательной.
    const allowedMatch = usersPhp.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!allowedMatch, '$allowed массив найден в users.php');
    assert(!/'yashik_session'/.test(allowedMatch ? allowedMatch[1] : ''),
        'yashik_session НЕ в $allowed users.php — клиент не может отправить/подделать отложенную награду через users.save');
}

console.log('\nTest 7: клиент (yashik.js) больше не считает RNG и не начисляет валюту напрямую — только зовёт сервер');
{
    assert(/TS\.php\('yashik\.openBox', \{\}/.test(yashikJs), 'obyskat зовёт yashik.openBox');
    assert(/TS\.php\('yashik\.buyPatron', \{\}/.test(yashikJs), 'покупка патрона зовёт yashik.buyPatron');
    assert(/TS\.php\('yashik\.collect', \{\}/.test(yashikJs), 'crestик/ЗАБРАТЬ зовут yashik.collect');
    assert(!/Math\.floor\(Math\.random\(\) \* 11\)/.test(yashikJs), 'локальный RNG нычек/рублей убран');
    assert(!/Math\.random\(\) < 0\.07/.test(yashikJs), 'локальный RNG шмотки убран');
    assert(!/udata\['cigarettes'\] = String\(parseInt\(udata\['cigarettes'\] \|\| 0\) \+ cigsGain\)/.test(yashikJs),
        'клиент больше не начисляет сигареты напрямую в udata — только через applyPatch с сервера');
    assert(/import \{ applyPatch \} from '\.\.\/\.\.\/\.\.\/modules\/patch\.js';/.test(yashikJs), 'applyPatch импортирован');
}

console.log('\nTest 8: НАЗАД не вызывает collect (награда сгорает, как и было в исходном UX)');
{
    const start = yashikJs.indexOf("// --- Кнопка НАЗАД");
    const end   = yashikJs.indexOf('win.addChild(nazadBtn);') + 'win.addChild(nazadBtn);'.length;
    const body  = yashikJs.slice(start, end);
    assert(!/collectReward\(\)/.test(body), 'НАЗАД не вызывает collectReward() — награда не начисляется, как и в исходном коде');
    assert(!/TS\.php\('yashik\.collect'/.test(body), 'НАЗАД не делает запрос на сервер вообще');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
