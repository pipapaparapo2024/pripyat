/**
 * Test: 27.09.2026, КРИТИЧЕСКИЙ живой репорт —
 *   «покупка валюты тоже не начисляет валюту (пробую купить рубли, достягу по трате голосов
 *    считает, а вот рубли не добавляются)».
 *
 * ПРИЧИНА (найдена чтением кода, симптом сходится 1-в-1):
 *   bank.js.successDonat() на подтверждённой покупке делал ДВЕ вещи ДО того, как открывалось
 *   защитное окно suspendPlayerSave():
 *     1) udata['votes_spent'] += votes  — через Proxy player-save.js это ставит автосейв в очередь;
 *     2) achievements._checkAll()       — при пересечении порога зовёт _syncWithServer(), а тот
 *        flushPlayerSave('achievement_earned'), который отправляет users.save с ПОЛНЫМ снимком
 *        udata НЕМЕДЛЕННО (синхронно, не через 500мс дебаунс).
 *   В этом снимке coins/stew/cigarettes — СТАРЫЕ: клиент их специально не считает сам с
 *   26.09.2026 (фикс двойного начисления), начисляет только вебхук VK. Вебхук
 *   (universal_pay.php, order_status_change) прилетает на сервер практически одновременно с
 *   клиентским событием VKWebAppShowOrderBoxResult — и этот users.save затирал уже честно
 *   начисленную валюту обратно на старое значение. votes_spent при этом сохранялся успешно
 *   тем же запросом — отсюда ровно наблюдаемая картина «ачивка считается, рубли нет».
 *   Тот же класс гонки уже ловили 26.09 для dev_panel.saveDevChanges() (живые логи:
 *   universal_pay начислил coins 3→20003, следующий сейв записал 3) — но там его закрыли
 *   точечно, а здесь он лежал на ОСНОВНОМ пути каждой покупки.
 *
 * ФИКС:
 *   1) votes_spent начисляет сам вебхук (universal_pay.php) — ОДНОЙ записью в БД вместе с
 *      валютой, поэтому рассинхрона между ними физически не может быть;
 *   2) клиент на покупке не пишет в udata вообще ничего — значит нечего и отправлять;
 *   3) 'votes_spent' убран из whitelist users.save (заодно закрыта анти-чит дыра «выдать себе
 *      все донат-ачивки одним users.save»);
 *   4) markPlayerDataFresh() после adopt-а свежего снимка с сервера — чтобы resumePlayerSave()
 *      не отправил этот же снимок «эхом» обратно и не затёр вебхук, долетевший после последней
 *      попытки опроса.
 *
 * Run: node tests/bank-votes-spent-server-side-no-stale-save.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root       = path.join(__dirname, '..');
const bankSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bank.js'), 'utf-8');
const saveSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'player-save.js'), 'utf-8');
const paySrc     = fs.readFileSync(path.join(root, 'server', 'universal_pay.php'), 'utf-8');
const usersSrc   = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const achSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'achievements.js'), 'utf-8');

function stripComments(s){
    return s.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
}
const bankCode = stripComments(bankSrc);

console.log('\nTest 1: клиент больше не пишет votes_spent и не дёргает достижения до обновления баланса');
assert(!/udata\['votes_spent'\]\s*=/.test(bankCode),
    "локальная запись udata['votes_spent'] удалена из bank.js");
{
    // successDonat() не должен содержать _checkAll() вообще — единственный легитимный вызов
    // достижений после покупки живёт в колбэке users.get внутри _refreshBalanceAfterPurchase().
    const m = bankCode.match(/successDonat\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'тело successDonat() найдено');
    if (m) {
        assert(!/achievements\._checkAll\(\)/.test(m[1]),
            'successDonat() НЕ зовёт achievements._checkAll() (иначе flushPlayerSave отправит старую валюту)');
    }
    const r = bankCode.match(/_refreshBalanceAfterPurchase\(currency, expectedCount\)\{([\s\S]*?)\n\t\}/);
    assert(!!r, 'тело _refreshBalanceAfterPurchase() найдено');
    if (r) {
        assert(/achievements\._checkAll\(\)/.test(r[1]),
            '_checkAll() вызывается внутри колбэка users.get — уже по свежим серверным данным');
        assert(/markPlayerDataFresh\('bank_purchase_refresh'\)/.test(r[1]),
            'после adopt-а серверного снимка снимается «грязный» флаг автосейва');
        assert(r[1].indexOf('markPlayerDataFresh') < r[1].indexOf('achievements._checkAll'),
            'markPlayerDataFresh() идёт РАНЬШЕ _checkAll() — иначе flush внутри _syncWithServer снова отправит снимок');
    }
}

console.log('\nTest 2: почему это вообще было гонкой — flushPlayerSave внутри _syncWithServer отправляет ПОЛНЫЙ снимок udata');
assert(/flushPlayerSave\('achievement_earned'/.test(achSrc),
    'achievements._syncWithServer() действительно зовёт flushPlayerSave (немедленная отправка, не дебаунс)');
assert(/const snapshot = JSON\.stringify\(window\.udata\);/.test(saveSrc),
    'flushPlayerSave отправляет udata ЦЕЛИКОМ — включая валюту, которую клиент не считает сам');

console.log('\nTest 3: markPlayerDataFresh() — реальная реализация, а не заглушка');
assert(/export function markPlayerDataFresh\(reason = 'manual'\)\{/.test(saveSrc),
    'функция объявлена и экспортирована');
assert(/savedRevision = revision;/.test(saveSrc),
    'сбрасывает «грязный» счётчик на текущую ревизию (сохранять нечего)');
assert(/pendingFlushOnResume = false;/.test(saveSrc),
    'снимает отложенный флаш, который иначе выстрелит из resumePlayerSave()');
assert(/window\.markPlayerDataFresh = markPlayerDataFresh;/.test(saveSrc),
    'выставлена на window — bank.js обращается к ней через window, как к остальным хелперам');

console.log('\nTest 4: сервер начисляет votes_spent тем же запросом, что и валюту (обе ветки — test и прод)');
{
    const credits = paySrc.match(/\$user\['votes_spent'\] = \$registry\['tools'\]->summ\(\$user\['votes_spent'\] \?\? 0, \$votes\);/g) || [];
    assert(credits.length === 2,
        'начисление votes_spent есть и в order_status_change, и в order_status_change_test (найдено: ' + credits.length + ')');
    const votes = paySrc.match(/\$votes = intval\(\$registry\['donats'\]\[\$item\] \?\? 0\);/g) || [];
    assert(votes.length === 2, 'цена в голосах берётся из уже посчитанного registry.donats (не дублирует таблицу цен)');
    // Начисление обязано попадать в тот же saveData(), что и валюта — иначе снова два источника.
    const idxVotes = paySrc.indexOf("$user['votes_spent'] = $registry['tools']->summ");
    const idxSave  = paySrc.indexOf("$saveRes = $registry['udb']->saveData($registry['utb'], $user);");
    assert(idxVotes > 0 && idxSave > idxVotes,
        'votes_spent мутирует $user ДО единственного saveData() — одна запись, не две');
}

console.log('\nTest 5: votes_spent больше не client-writable (анти-чит + невозможность затереть)');
{
    const m = usersSrc.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!m, '$allowed найден');
    if (m) {
        const body = stripComments(m[1]);
        assert(!/'votes_spent'/.test(body), "'votes_spent' отсутствует в whitelist users.save");
    }
}

console.log('\nTest 6: вебхук не пытается начислять «в никуда», если игрока нет в БД');
{
    const guards = paySrc.match(/ОТКАЗ — игрока нет в БД, начислять некуда/g) || [];
    assert(guards.length === 2, 'guard есть в обеих ветках начисления (найдено: ' + guards.length + ')');
    assert(/\$registry\['uid'\] = intval\(\$_POST\['user_id'\] \?\? 0\);/.test(paySrc),
        'user_id читается с ?? 0 — больше не PHP Warning «Undefined array key» на каждом пустом запросе');
    assert(/\$sig = \$_POST\['sig'\] \?\? '';/.test(paySrc),
        'sig читается с ?? — тот же warning в checkSig() закрыт');
}

console.log('\nTest 7: симуляция самой гонки — почему «ачивка есть, валюты нет»');
{
    // Модель: БД-строка игрока, вебхук пишет только свои поля, клиентский users.save — весь снимок.
    const db = { coins: 3, votes_spent: 0 };
    const clientSnapshot = { coins: 3, votes_spent: 1000 }; // votes_spent новый, coins старый

    // СТАРОЕ поведение: вебхук начислил, затем долетел клиентский сейв со старым coins.
    const oldDb = { ...db };
    oldDb.coins += 20000;                                   // вебхук VK
    Object.assign(oldDb, clientSnapshot);                   // users.save (whitelist включал votes_spent)
    assert(oldDb.coins === 3, 'старое поведение: coins откатился на 3 — валюта пропала');
    assert(oldDb.votes_spent === 1000, 'старое поведение: votes_spent сохранился — ачивка засчиталась');

    // НОВОЕ поведение: клиенту на покупке нечего сохранять, оба счётчика пишет вебхук.
    const newDb = { ...db };
    newDb.coins += 20000;
    newDb.votes_spent += 1000;                              // тот же saveData вебхука
    const allowedNow = ['coins'];                           // votes_spent больше не в whitelist
    const stale = { coins: 3, votes_spent: 0 };
    // Даже если бы устаревший сейв всё-таки ушёл, votes_spent он уже не тронет:
    const filtered = {};
    for (const k of allowedNow) if (k in stale) filtered[k] = stale[k];
    assert(newDb.coins === 20003, 'новое поведение: coins начислен');
    assert(newDb.votes_spent === 1000, 'новое поведение: votes_spent начислен тем же запросом');
    assert(!('votes_spent' in filtered), 'устаревший клиентский сейв физически не может тронуть votes_spent');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
