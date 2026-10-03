/**
 * Test: 29.09.2026, по прямому указанию — аудит рамки «УБИВШИЙ» на карточке босса
 * (bosses_select.js). Два независимых репорта: (1) "иногда показывает разные иконки у разных
 * игроков" и (2) "победил босса, вышел — моё изображение не всегда ставится первым".
 *
 * Корень (1): bosses.php.recordKill() — fire-and-forget с клиента (bosses-combat.js._onDefeat.
 * _doRedirect, вызывается при закрытии попапа результата, см. коммент там же — "убившим
 * считается тот, кто ПОСЛЕДНИМ вышел с попапа победы"). Несколько игроков могут закрыть попап
 * почти одновременно — их запросы могут доехать до сервера НЕ в том порядке, в котором были
 * отправлены. UPDATE раньше был безусловным — более старый по времени killed_at, доехавший
 * ПОСЛЕ более нового, тихо перезаписывал его поверх. Фикс — гвард по времени ($now >=
 * `killed_at`), а не по порядку доставки запроса.
 *
 * Корень (2): та же fire-and-forget запись — если игрок открывает список боссов раньше, чем
 * recordKill() реально долетел до сервера, bosses.killers ещё отдаёт СТАРОГО убившего. Фикс —
 * клиент хранит свою последнюю победу локально (bosses._lastOwnKill, bosses-combat.js) и
 * подставляет себя в bosses_select.js, пока серверная запись не догонит по killed_at (сервер
 * теперь отдаёт это поле в ответе killers()).
 *
 * Run: node tests/boss-killer-badge-race-and-optimistic-self.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bossesPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
const combatJs = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');
const selectJs = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_select.js'), 'utf-8');

console.log('\nTest 1: recordKill() гвардирует UPDATE по времени, а не перезаписывает безусловно');
{
    const start = bossesPhp.indexOf('function recordKill(){');
    const end = bossesPhp.indexOf('function startFight', start);
    const body = bossesPhp.slice(start, end);
    assert(body.includes('ON DUPLICATE KEY UPDATE'), 'INSERT ... ON DUPLICATE KEY UPDATE сохранён');
    assert(/`user_id`\s*=\s*IF\(\$now >= `killed_at`, \$uid, `user_id`\)/.test(body),
        'user_id обновляется только если новый $now не старше уже сохранённого killed_at');
    assert(/`killed_at`\s*=\s*IF\(\$now >= `killed_at`, \$now, `killed_at`\)/.test(body),
        'killed_at обновляется по тому же условию, что и user_id (согласованно)');
    assert(!/UPDATE `user_id`=\$uid, `killed_at`=\$now/.test(body),
        'старый безусловный UPDATE (без гварда) больше не встречается');
}

console.log('\nTest 2: killers() отдаёт killed_at клиенту');
{
    const start = bossesPhp.indexOf('function killers(){');
    const end = bossesPhp.indexOf('function recordKill', start);
    const body = bossesPhp.slice(start, end);
    assert(/SELECT bl\.`boss_id`, bl\.`user_id`, bl\.`killed_at`, u\.`nick`/.test(body),
        'SQL выбирает killed_at вместе с boss_id/user_id/nick');
    assert(/'killed_at' => intval\(\$row\['killed_at'\]\)/.test(body),
        'killed_at попадает в итоговый массив, отдаваемый клиенту');
}

console.log('\nTest 3: bosses-combat.js фиксирует локальную метку своей победы перед fire-and-forget recordKill');
{
    const idx = combatJs.indexOf("TS.php('bosses.recordKill'");
    assert(idx !== -1, 'вызов bosses.recordKill найден');
    const before = combatJs.slice(Math.max(0, idx - 400), idx);
    assert(/this\._lastOwnKill = this\._lastOwnKill \|\| \{\};/.test(before),
        '_lastOwnKill инициализируется перед отправкой recordKill');
    assert(/this\._lastOwnKill\[idx\] = Math\.floor\(Date\.now\(\) \/ 1000\);/.test(before),
        '_lastOwnKill[idx] записывается в секундах (тот же формат, что и серверный killed_at=time())');
}

console.log('\nTest 4: bosses_select.js подставляет себя вместо устаревшей серверной записи');
{
    // 29.09.2026 (по прямому указанию, см. комментарий в bosses_select.js у этого блока):
    // к сравнению меток добавлен TTL-гвард stillInFlight (<=15 сек от своей победы) — без него
    // локальная подмена держалась бы всю сессию, даже после проигрыша/более поздней победы
    // другого игрока. Заодно сравнение ужесточено с ">=" на строгое ">": когда серверная запись
    // ДОГОНЯЕТ локальную метку (тот же killed_at), теперь предпочитается серверная запись — у
    // неё уже настоящий nick, а не плейсхолдер nick:'' у локальной подмены.
    assert(selectJs.includes('bosses._lastOwnKill'), 'читает bosses._lastOwnKill');
    assert(/const stillInFlight = \(Math\.floor\(Date\.now\(\) \/ 1000\) - myTs\) <= 15;/.test(selectJs),
        'TTL-гвард — локальная подмена живёт не дольше 15 сек (на время доставки fire-and-forget)');
    assert(/myTs > \(serverRec\.killed_at \|\| 0\)/.test(selectJs),
        'сравнивает локальную метку с killed_at серверной записи (а не бездумно подставляет себя всегда)');
    assert(/if\(stillInFlight && \(!serverRec \|\| myTs > \(serverRec\.killed_at \|\| 0\)\)\)/.test(selectJs),
        'подстановка себя срабатывает и когда серверной записи для этого босса ещё вообще нет (при условии stillInFlight)');
    // Должно остаться прежнее поведение резолва VK-юзеров и вставки спрайта — эта правка не
    // должна была тронуть остальной код обработчика.
    assert(selectJs.includes('bosses._resolveVkUsers(killers.map(k=>k.id)'),
        'резолв VK-пользователей по-прежнему идёт по (возможно подменённому) списку killers');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
