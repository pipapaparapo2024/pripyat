/**
 * Test: 17.09.2026 (девятый батч) — разобрана и исправлена коллизия имён, замеченная в ходе
 * аудита безопасности: udata['habar_counts'] использовалось ДВУМЯ независимыми фичами с
 * несовместимыми форматами данных:
 *
 *  1) yashik.js/dvor.js (ящик, casino-приз "заначка") — простой счётчик:
 *     udata['habar_counts'] = parseInt(...) + amount.
 *  2) server/core/controllers/habar.php + hapuga.php (торговец «Хабар») — JSON-массив
 *     [cnt0,cnt1,cnt2,cnt3] (сколько неоткрытых контейнеров каждого из 4 типов), колонка в БД
 *     типа TEXT (см. server/migrate.php) — именно под это создавалась изначально.
 *
 * Реальный эффект: applyPatch() (modules/patch.js) делает Object.assign(udata, patch) —
 * когда сервер отвечает на habar.buy с JSON-массивом в patch.habar_counts, он БЕЗ ПРЕДУПРЕЖДЕНИЯ
 * затирает клиентский счётчик заначек. И наоборот — parseInt() на JSON-массиве вида "[1,0,0,0]"
 * возвращает NaN, что дальше превращает счётчик в буквальную строку "NaN" навсегда. На момент
 * аудита видимый игровой эффект минимален (счётчик заначек нигде не отображается в UI, а
 * habar.php.open() — куда реально шёл бы испорченный массив — не вызывается текущим клиентом
 * вообще), но это осталось бы миной на будущее.
 *
 * Исправление: счётчик заначек перенесён в отдельное поле stash_count (миграция 15,
 * tests/_fixtures/schema-history/migrate15.php.txt). habar_counts остаётся ИСКЛЮЧИТЕЛЬНО за habar.php/hapuga.php — их
 * код НЕ менялся.
 *
 * Run: node tests/habar-counts-collision-stash-count-split.test.js
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

// 18.09.2026: перенос Ящика на сервер (yashik.php.collect()) убрал прямое присваивание
// udata['stash_count'] из yashik.js — сервер сам начисляет через Gameops::add(..., 'stash_count', ...)
// и возвращает patch, клиент применяет его через applyPatch() (общий для крестика и ЗАБРАТЬ путь).
console.log('\nTest 1: заначка из ящика начисляется сервером (yashik.php) в stash_count, не habar_counts');
{
    const src = readSrc('_client/src/game/shell/overlays/yashik.js');
    const yashikPhp = readSrc('server/core/controllers/yashik.php');
    assert(!/udata\['stash_count'\]\s*=\s*String\(parseInt\(udata\['stash_count'\]/.test(src),
        'yashik.js больше не начисляет stash_count напрямую — только через applyPatch(res.patch)');
    assert(/applyPatch\(res\.patch\);/.test(src), 'применяет патч сервера');
    // 05.10.2026 (стале-пин, не регрессия — блокировка строки в yashik.php.collect(), см.
    // tests/yashik-server-authoritative-lootbox.test.js): $lockedUser вместо $user.
    assert(/\$this->ops->add\(\$lockedUser, 'stash_count', intval\(\$session\['stash'\]\)\);/.test(yashikPhp),
        'сервер (yashik.php.collect) начисляет именно stash_count, не habar_counts');
    assert(!/'habar_counts'/.test(yashikPhp), 'yashik.php вообще не трогает habar_counts (нет той же коллизии на новом месте)');
}

console.log('\nTest 2 (обновлено 19.10.2026 — находка закрыта): dvor.js больше не содержит клиентского начисления stash_count вообще');
{
    // 19.10.2026 (расследование "Антикризиса", см. tests/exp-respect-whitelist-console-
    // exploit-fix.test.js): _give() (единственное место, которое писало case 'stash') удалён
    // целиком — grep по всему _client/src подтвердил, что он не вызывался ни одним реальным
    // игровым путём, а был единственным живым способом эксплуатации stash_count/exp/respect/
    // coins_earned/dvor_games из консоли браузера. stash_count теперь пишет ТОЛЬКО сервер
    // (zone.php/poker.php/roulette.php через Gameops), 'stash_count' убран из client-writable
    // whitelist users.php (см. Test 4 ниже).
    const src = readSrc('_client/src/game/dvor.js');
    assert(!/_give\(type, amount\)\{/.test(src), '_give(type, amount) больше не определён в dvor.js (удалён как мёртвый код/консольный эксплойт)');
    assert(!/udata\['stash_count'\]\s*=/.test(src), 'прямого присваивания udata[\'stash_count\'] в этом файле больше нет вообще');
    assert(!/case 'stash': udata\['habar_counts'\]/.test(src),
        'старая запись в habar_counts убрана из dvor.js');
}

console.log('\nTest 3 (обновлено 19.10.2026 — находка закрыта): debug-tools.js (GIVE_MILLION) больше не пишет stash_count напрямую — только дельтой через devGrantCurrency');
{
    const src = readSrc('_client/src/game/debug-tools.js');
    assert(!/udata\['stash_count'\]\s*=\s*M;/.test(src), 'нет прямого udata[\'stash_count\']=M; — stash_count теперь идёт дельтой через devGrantCurrency');
    assert(/'stash_count'/.test(src.slice(src.indexOf('currencyDeltas'), src.indexOf('currencyDeltas') + 300)),
        "'stash_count' добавлен в список currencyDeltas");
    assert(!/udata\['habar_counts'\]\s*=\s*M;/.test(src),
        'GIVE_MILLION по-прежнему не выставляет habar_counts (не ломает JSON-массив контейнеров Хабара)');
}

console.log('\nTest 4 (обновлено 19.10.2026 — находка закрыта): users.php — stash_count УБРАН из whitelist (та же дыра, что у exp)');
{
    // 19.10.2026: stash_count оказался в $allowed ДВАЖДЫ (дубль), писался сервером
    // (zone.php/poker.php/roulette.php) И при этом оставался client-writable — тот же класс
    // бага, что у exp/respect/total_damage/bosses_killed и др. (см. большой коммент у $allowed
    // в users.php). Дев-кнопки переведены на devGrantCurrency(), обычная игровая запись и не
    // требовалась (единственный клиентский писатель был внутри ныне удалённого dvor.js._give()).
    const src = readSrc('server/core/controllers/users.php');
    const allowedBlock = src.match(/\$allowed = \[[\s\S]*?\n            \];/)[0].replace(/\/\/.*$/gm, '');
    const tokens = allowedBlock.split(/[\[\],\s]+/).map(s => s.replace(/^'|'$/g, ''));
    assert(!tokens.includes('stash_count'), "'stash_count' убран из whitelist \$allowed (как значение массива, не в комментарии)");
    const strictBlock = src.match(/\$strictNumericFields = \[[\s\S]*?\];/)[0].replace(/\/\/.*$/gm, '');
    assert(!/'stash_count'/.test(strictBlock), "'stash_count' убран из \$strictNumericFields (числовой потолок больше не нужен)");
    const devGrantBody = src.slice(src.indexOf('function devGrantCurrency()'), src.indexOf('function devSetRyukzakLevel'));
    assert(/\$allowedTypes = \[[^\]]*'stash_count'/.test(devGrantBody), "devGrantCurrency.allowedTypes содержит 'stash_count' (обходной путь для дев-кнопок)");
}

console.log('\nTest 5: migrate15.php добавляет колонку stash_count');
{
    const migratePath = path.join(root, 'tests', '_fixtures', 'schema-history', 'migrate15.php.txt');
    assert(fs.existsSync(migratePath), 'tests/_fixtures/schema-history/migrate15.php.txt создан');
    const src = fs.readFileSync(migratePath, 'utf-8');
    assert(/\$col = 'stash_count';/.test(src), 'миграция добавляет именно stash_count');
    assert(/ALTER TABLE `\{\$registry\['utb'\]\}` ADD COLUMN `\$col`/.test(src), 'миграция использует ALTER TABLE ADD COLUMN (не трогает существующие данные)');
}

console.log('\nTest 6: preloader.js и dev_panel.js — дефолты нового/сброшенного игрока включают stash_count');
{
    const preloader = readSrc('_client/src/game/preloader.js');
    const devPanel  = readSrc('_client/src/game/shell/overlays/dev_panel.js');
    assert(/stash_count:'0'/.test(preloader), 'preloader.js: дефолт нового игрока содержит stash_count');
    assert(/stash_count:'0'/.test(devPanel), 'dev_panel.js: полный сброс аккаунта содержит stash_count');
}

console.log('\nTest 7: регресс-гвард — habar.php/hapuga.php по-прежнему используют habar_counts как JSON-массив (не переименовано в stash_count)');
{
    const habarPhp  = readSrc('server/core/controllers/habar.php');
    const hapugaPhp = readSrc('server/core/controllers/hapuga.php');
    // 05.10.2026 (стале-пин, не регрессия — habar.php (не hapuga.php) получил блокировку
    // строки 04.10.2026, см. tests/race-conditions-skills-weapons-ryukzak-casino-04-10.test.js
    // стиль фикса): habar.php теперь читает это поле на залоченной копии $lockedUser.
    assert(/\$this->ops->j\(\$lockedUser, 'habar_counts', \[0,0,0,0\]\)/.test(habarPhp),
        'habar.php по-прежнему читает habar_counts как JSON-массив [0,0,0,0] — не переименовано');
    assert(/\$this->ops->j\(\$user, 'habar_counts', \[0,0,0,0\]\)/.test(hapugaPhp),
        'hapuga.php по-прежнему читает habar_counts как JSON-массив [0,0,0,0] — не переименовано');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
