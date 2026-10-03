/**
 * Test: «Рамка уважения» на карточках локаций (16.09.2026) — кто заработал больше всего
 * уважения именно с конкретной локации, глобально среди всех игроков. Архитектура —
 * прямая копия системы «фото УБИВШЕГО» у боссов (boss_last_kill/bosses.killers), только
 * рекорд по МАКСИМУМУ, а не по "последнему":
 *  - server/core/controllers/zone.php (новый) — leaders()/recordRespect(), таблица
 *    zone_respect_leader, апсерт "только если больше" через GREATEST/IF (не отдельный
 *    SELECT+UPDATE — атомарно, без гонок между разными игроками).
 *  - 'zone' зарегистрирован в registry.php classes.
 *  - server/migrate13.php — создаёт zone_respect_leader + 5 колонок loc_respect_0..4.
 *  - users.php whitelist — те же 5 колонок (личный накопленный счётчик игрока).
 *  - zone.js._addLocRespect(locIdx, amount) — вызывается во всех 3 местах начисления
 *    uважения за локацию (чекпоинт/захват/бизнес-доход).
 *  - zone_screen.js — рендер рамки+фото, тот же относительный отступ на всех 5 карточках.
 *
 * Run: node tests/zone-respect-leader-frame.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const zonePhp    = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'zone.php'), 'utf-8');
const registryPhp = fs.readFileSync(path.join(root, 'server', 'core', 'models', 'registry.php'), 'utf-8');
const usersPhp    = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const migrate13   = fs.readFileSync(path.join(root, 'server', 'migrate13.php'), 'utf-8');
const zoneJsSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'zone.js'), 'utf-8');
const zoneScreenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'zone_screen.js'), 'utf-8');

// 17.09.2026 (позже этого батча, полный перенос Зоны на сервер): permits вырос — добавлены
// fillCheckpoint/captureLocation/upgradeBusiness/collectIncome (сама экономика Зоны). leaders/
// recordRespect остались как были, просто уже не единственные два метода в списке.
console.log('\nTest 1: сервер — контроллер Zone зарегистрирован и реализует leaders()/recordRespect()');
{
    assert(/'classes'\s*=>\s*array\([^)]*'zone'/.test(registryPhp.replace(/\n/g, '')),
        "'zone' добавлен в registry.php classes (иначе universal.php отклонит метод как невалидный класс)");
    // 26.09.2026: permits с тех пор обзавёлся 'resetMyRespectLeader' (не связано с этой правкой,
    // см. zone-respect-leader-reset-on-account-reset.test.js) — проверяем только то, что важно
    // ЗДЕСЬ: leaders/recordRespect присутствуют, а не точное совпадение всего массива.
    const permitsMatch = zonePhp.match(/\$this->permits = \[([^\]]*)\];/);
    assert(!!permitsMatch && /'leaders'/.test(permitsMatch[1]) && /'recordRespect'/.test(permitsMatch[1]),
        'Zone.permits содержит leaders и recordRespect (среди позже добавленных методов экономики Зоны)');
    assert(/function leaders\(\)/.test(zonePhp), 'метод leaders() существует');
    assert(/function recordRespect\(\)/.test(zonePhp), 'метод recordRespect() существует');
    // 26.09.2026: голый SELECT заменён на INNER JOIN с users (см.
    // tests/zone-leaders-inner-join-deleted-users.test.js) — рекордсмен без реального
    // аккаунта больше не попадает в выдачу. Здесь — только регресс-гвард, что leaders()
    // продолжает читать именно из zone_respect_leader (таблица не поменялась).
    assert(/FROM `zone_respect_leader` z/.test(zonePhp),
        'leaders() читает из zone_respect_leader');
}

console.log('\nTest 2: recordRespect() — апсерт "только если больше", а не безусловная перезапись');
{
    assert(/ON DUPLICATE KEY UPDATE/.test(zonePhp), 'использует ON DUPLICATE KEY UPDATE (атомарный апсерт)');
    assert(/GREATEST\(`amount`, \$amount\)/.test(zonePhp),
        'amount берётся как GREATEST — новый рекорд не может УМЕНЬШИТЬ сохранённый максимум');
    assert(/IF\(\$amount > `amount`, \$uid, `user_id`\)/.test(zonePhp),
        'user_id обновляется на нового игрока ТОЛЬКО когда его итог реально больше текущего рекорда');
    assert(/\$loc < 0 \|\| \$loc > 4 \|\| \$amount < 0/.test(zonePhp),
        'валидация loc (0-4) и amount (>=0) до похода в БД');
}

console.log('\nTest 3: миграция создаёт таблицу-лидерборд и 5 личных счётчиков в users');
{
    assert(/CREATE TABLE IF NOT EXISTS `zone_respect_leader`/.test(migrate13), 'создаёт zone_respect_leader');
    assert(/PRIMARY KEY \(`location_id`\)/.test(migrate13),
        'location_id — PRIMARY KEY (ровно 5 строк максимум, ON DUPLICATE KEY бьёт именно по нему)');
    // Колонки генерируются циклом ($cols['loc_respect_'.$i]), а не перечислены буквально —
    // проверяем сам цикл (i < 5) и что $col начинается с 'loc_respect_'.
    assert(/for\(\$i = 0; \$i < 5; \$i\+\+\) \$cols\['loc_respect_'\.\$i\]/.test(migrate13),
        'цикл миграции генерирует ровно 5 колонок loc_respect_0..4');
    for (let i = 0; i < 5; i++) {
        assert(new RegExp("'loc_respect_" + i + "'").test(usersPhp), `loc_respect_${i} есть в whitelist users.php`);
    }
}

// 17.09.2026 (позже этого батча, полный перенос Зоны на сервер): начисление уважения за
// локацию (чекпоинт/захват/доход бизнеса) само переехало на сервер — читер больше не может
// подделать "сколько уважения я заработал" консолью. Поэтому и репорт в лидерборд
// (_recordRespectLeader) сервер теперь делает СЕБЕ САМ, сразу после начисления, в тех же 3
// местах — client-side _addLocRespect()/zone.recordRespect больше не нужны и стали мёртвым
// кодом (оставлены как есть, не вызываются).
console.log('\nTest 4: zone.php — уважение с локации репортится в лидерборд во всех 3 местах начисления (сервер)');
{
    const start = zonePhp.indexOf('private function _recordRespectLeader($locIdx, $total){');
    const end   = zonePhp.indexOf('\n        }', start);
    assert(start !== -1, '_recordRespectLeader(locIdx, total) определён в zone.php');
    assert(/ON DUPLICATE KEY UPDATE/.test(zonePhp.slice(start, end)), 'использует ON DUPLICATE KEY UPDATE (та же логика GREATEST, что и раньше)');

    const callSites = [...zonePhp.matchAll(/this->_recordRespectLeader\(\$locIdx, \$user\[\$locRespKey\]\);/g)];
    assert(callSites.length === 3,
        `_recordRespectLeader вызывается в 3 местах начисления уважения (fillCheckpoint/captureLocation/collectIncome) — найдено ${callSites.length}`);
}

console.log('\nTest 5: zone_screen.js — рамка на всех 5 карточках с ОДНИМ относительным отступом, фото по паттерну боссов');
{
    assert(/const RESPECT_FRAME_REL_X\s*=\s*\d+,\s*RESPECT_FRAME_REL_Y\s*=\s*\d+/.test(zoneScreenSrc),
        'общая константа относительного отступа рамки (одна на все 5 карточек)');
    assert(/рамка уважение\.png/.test(zoneScreenSrc), 'использует загруженный файл рамка уважение.png');
    assert(/respectFrame\.x = cardX \+ RESPECT_FRAME_REL_X/.test(zoneScreenSrc),
        'рамка позиционируется от СВОЕГО угла карточки (cardX), не от общего центра экрана — одна формула подходит и верхнему, и нижнему слоту');
    assert(/respectFrameSprites\[loc\.locIdx\] = respectFrame/.test(zoneScreenSrc),
        'рамка каждой локации сохраняется по locIdx для подстановки фото после ответа сервера');

    assert(/TS\.php\('zone\.leaders'/.test(zoneScreenSrc), 'запрашивает zone.leaders при открытии экрана');
    assert(/bosses\._resolveVkUsers/.test(zoneScreenSrc),
        'переиспользует общую утилиту резолва VK id→фото с bosses, не дублирует VK API вызов');
    assert(/modules\.checkFlags\(\['bosses'\], _withResolver\)/.test(zoneScreenSrc),
        'форсирует загрузку модуля bosses, если игрок открыл Зону раньше Боссов в этой сессии');
    // 21.09.2026 (карусель по одной локации — см. zone-locations-carousel-slide.test.js): фото
    // вставляется В ГРУППУ своей локации (не в win напрямую), чтобы ехать вместе с карточкой
    // при сдвиге карусели; "видимость по странице" заменена маской + позицией группы —
    // отдельного переключения visible больше не требуется (не показывается — просто уехало
    // за пределы Graphics-маски вместе со своей группой).
    // 24.09.2026 (баг найден по прямому указанию — "число/фото рекордсмена должны быть по
    // Z-индексу ВЫШЕ рамки"): addChildAt(photoSpr, frameIdx) вставляло фото ПЕРЕД рамкой в
    // списке детей — в PIXI это НИЖЕ по z-порядку, рамка рисовалась поверх и перекрывала фото.
    // Заменено на addChild (конец списка группы = верх z-порядка) — см.
    // zone-respect-leader-position-zindex-and-refresh.test.js.
    assert(/g\.group\.addChild\(photoSpr\);/.test(zoneScreenSrc),
        'фото вставляется В КОНЕЦ списка детей группы своей локации — выше рамки по z-индексу, но по-прежнему едет вместе с карточкой');
    assert(/this\._zoneRespectPhotos\.push\(\{ spr: photoSpr, locIdx: l\.loc \}\);/.test(zoneScreenSrc),
        'фото запоминается по locIdx (не pageIdx — страниц больше нет)');
    assert(/locWrap\.mask = maskGfx;/.test(zoneScreenSrc),
        'видимость текущей/остальных локаций обеспечивается Graphics-маской (не ручным .visible по странице)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
