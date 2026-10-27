/**
 * Test: 26.10.2026 — фича "Заначки". Подтверждает, что правка 4 существующих источников дропа
 * (zone.php/yashik.php/poker.php/roulette.php — замена слепого stash_count на выдачу конкретных
 * карточек через ZanachkiModel::grantRandomCards()) сохранила форму существующего ответа БЕЗ
 * ИЗМЕНЕНИЙ (stash.dropped / reward.stash, ключи patchCurrencies()) — вся существующая
 * клиентская анимация/попап подбора заначки (_showStashPickup(), reward.js ICON_MAP.stash)
 * продолжает получать ровно то же самое, что и раньше, не подозревая о новой механике карточек.
 * Плюс — что 'stash_data' реально добавлен в массивы блокируемых колонок (yashik/poker/
 * roulette) — самое вероятное место случайно забыть при правке (race между конкурентным
 * запросом и этой записью иначе мог бы затереть только что начисленную карточку устаревшим
 * снимком, см. AGENTS.md "Server-authoritative экономика").
 *
 * Run: node tests/zanachki-drop-sources-regression.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, ...p), 'utf-8');

const zonePhp     = read(['server', 'core', 'controllers', 'zone.php']);
const yashikPhp   = read(['server', 'core', 'controllers', 'yashik.php']);
const pokerPhp    = read(['server', 'core', 'controllers', 'poker.php']);
const roulettePhp = read(['server', 'core', 'controllers', 'roulette.php']);

console.log('\nTest 1: zone.php.fillCheckpoint() — форма ответа и вызов grantRandomCards() внутри 7%-блока');
{
    const start = zonePhp.indexOf('function fillCheckpoint()');
    const end = zonePhp.indexOf('function captureLocation()', start);
    const body = zonePhp.slice(start, end);
    assert(/\$stashOut = \['dropped' => false\];/.test(body), '$stashOut инициализируется прежним {dropped:false} — форма ответа не изменилась');
    assert(/mt_rand\(1, 100\) <= 7/.test(body), '7%-шанс дропа сохранён (значение не трогали этой правкой)');
    assert(/\$stashOut\['dropped'\] = true;/.test(body), 'stashOut[\'dropped\']=true сохранён — клиент (_showStashPickup) получает тот же флаг');
    assert(/ZanachkiModel::grantRandomCards\(\$this->ops, \$user, 1\);/.test(body), 'внутри 7%-блока добавлен вызов grantRandomCards(..., 1) — одна конкретная карточка вместо слепого инкремента');
    assert(/'stash' => \$stashOut/.test(body) || /'stash'\s*=>\s*\$stashOut/.test(body), 'ключ ответа \'stash\' => $stashOut сохранён без изменений');
    assert(/'stash_data'/.test(body), '\'stash_data\' добавлен в patchCurrencies() этого метода');
}

console.log('\nTest 2: yashik.php.collect() — stash_data в $lockCols + вызов grantRandomCards()');
{
    const start = yashikPhp.indexOf('function collect()');
    const body = yashikPhp.slice(start);
    assert(/\$lockCols = \['stash_count', 'stash_data', 'cigarettes', 'coins', 'exp', 'shmot', 'yashik_session', 'max_energy'\];/.test(body),
        '\'stash_data\' добавлен в $lockCols рядом с \'stash_count\' (защита от гонки при SELECT...FOR UPDATE)');
    assert(/\$this->ops->add\(\$lockedUser, 'stash_count', intval\(\$session\['stash'\]\)\);/.test(body), 'старая строка инкремента stash_count НЕ удалена (не задваиваем, не теряем значение)');
    assert(/ZanachkiModel::grantRandomCards\(\$this->ops, \$lockedUser, intval\(\$session\['stash'\]\)\);/.test(body), 'добавлен вызов grantRandomCards() с тем же количеством ($session[\'stash\'])');
    assert(/'reward' => \$session/.test(body), 'ключ ответа \'reward\' => $session сохранён (клиент читает reward.stash как раньше)');
    assert(/patchCurrencies\(\$user, \['stash_count', 'stash_data', 'cigarettes', 'coins', 'exp', 'shmot', 'max_energy'\]\)/.test(body), '\'stash_data\' добавлен в patchCurrencies()');
}

console.log('\nTest 3: poker.php.openBag() — stash_data в $lockFields + вызов grantRandomCards()');
{
    const start = pokerPhp.indexOf('function openBag()');
    const end = pokerPhp.indexOf('function _catalog()', start);
    const body = pokerPhp.slice(start, end);
    assert(/\$lockFields = \['stash_count', 'stash_data', 'shmot', 'max_energy'\];/.test(body), '\'stash_data\' добавлен в $lockFields');
    assert(/'stash' => mt_rand\(5, 15\)/.test(body), 'диапазон награды stash (5-15) не менялся этой правкой');
    assert(/\$this->ops->add\(\$user, 'stash_count', \$reward\['stash'\]\);/.test(body), 'старая строка инкремента stash_count сохранена');
    assert(/ZanachkiModel::grantRandomCards\(\$this->ops, \$user, \$reward\['stash'\]\);/.test(body), 'добавлен вызов grantRandomCards() с тем же количеством ($reward[\'stash\'])');
    assert(/'stash_count', 'stash_data', 'coins', 'coins_earned'/.test(body), '\'stash_data\' добавлен в patchCurrencies() рядом со stash_count');
}

console.log('\nTest 4: roulette.php.openCase() — stash_data в $lockFields + вызов grantRandomCards() (зеркало poker.php)');
{
    const start = roulettePhp.indexOf('function openCase()');
    const end = roulettePhp.indexOf('function buyPoints()', start);
    const body = roulettePhp.slice(start, end);
    assert(/\$lockFields = \['stash_count', 'stash_data', 'shmot', 'max_energy'\];/.test(body), '\'stash_data\' добавлен в $lockFields');
    assert(/'stash' => mt_rand\(5, 15\)/.test(body), 'диапазон награды stash (5-15) не менялся этой правкой');
    assert(/\$this->ops->add\(\$user, 'stash_count', \$reward\['stash'\]\);/.test(body), 'старая строка инкремента stash_count сохранена');
    assert(/ZanachkiModel::grantRandomCards\(\$this->ops, \$user, \$reward\['stash'\]\);/.test(body), 'добавлен вызов grantRandomCards() с тем же количеством ($reward[\'stash\'])');
    assert(/'stash_count', 'stash_data', 'coins', 'coins_earned'/.test(body), '\'stash_data\' добавлен в patchCurrencies() рядом со stash_count');
}

console.log('\nTest 5: ZanachkiModel::grantRandomCards() НЕ инкрементирует stash_count сам (иначе все 4 места задвоили бы счётчик)');
{
    const modelPhp = read(['server', 'core', 'models', 'zanachkimodel.php']);
    const start = modelPhp.indexOf('static function grantRandomCards');
    const end = modelPhp.indexOf('static function isCollectionComplete', start);
    const body = modelPhp.slice(start, end);
    assert(!/stash_count/.test(body), 'тело grantRandomCards() не содержит stash_count — счётчик остаётся исключительно зоной ответственности вызывающего кода');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
