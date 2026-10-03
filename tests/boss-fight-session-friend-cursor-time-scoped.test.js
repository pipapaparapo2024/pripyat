/**
 * Test: 27.09.2026 (по прямому указанию, репорт игрока + скриншот — "Зашел в игру. Босс до
 * этого стоял, но хп фулл, урон есть. ... Зашел снова в бой, победу засчитало. После попытки
 * снова напасть, нижний худ пропадает, в бой не заходит.").
 *
 * Расследование: скриншот показывал HP-бар боевого экрана ПОЛНЫМ (1000/1000), при этом панель
 * «РЕЙТИНГ УРОНА» ЭТОЙ ЖЕ карточки честно показывала суммарный урон трёх участников (~2.2K —
 * больше maxHp босса). rating() (bosses.php.rating()/_ratingTop()) НИКОГДА не кэширует — это
 * всегда свежий SUM() по boss_damage_log, поэтому цифры там были правдой. Значит бага не в
 * рейтинге, а в HP — конкретно в мутируемом кэше boss_fight_session (_syncFightSession()).
 *
 * Корень: при бэкфилле кэша (ветка "нет кэша, или он от другой попытки" — !$matches) курсор
 * (cursorId) заводился от ГЛОБАЛЬНОГО MAX(id) по ВСЕЙ таблице boss_damage_log — без всякой связи
 * с $bossStartMs или $friendIds. Если ИМЕННО в момент этого конкретного бэкфилла список взаимных
 * друзей ВК ($friendIds, требует живого round-trip запроса на каждого кандидата в _friendIds())
 * по любой причине оказывался пуст (например, ещё не успел синхронизироваться при первом за
 * долгое время обращении к уже какое-то время идущему бою), $friends в формуле HP считался
 * нулём — но курсор ВСЁ РАВНО уезжал вперёд мимо УЖЕ СУЩЕСТВУЮЩИХ строк урона друга в логе,
 * помечая их как «уже учтённые» НАВСЕГДА (пока $matches===true, то есть до конца всей текущей
 * попытки боя — bossId/diffIdx/startMs не поменяются просто от разговора с сервером).
 * _applyFriendDamage() смотрит только "id > cursorId" — эти строки уже "позади" курсора, значит
 * урон друга терялся безвозвратно даже на СЛЕДУЮЩИЙ вызов, когда friendIds уже приходил
 * корректным. HP оставался завышенным (в пределе — полным) до конца всей попытки боя.
 *
 * Это же объясняет и остальные два симптома репорта: "победу засчитало" — игрок в итоге сам
 * добил уже неверно завышенный HP серией личных ударов (свой урон считается отдельно и всегда
 * верно, см. _damageSumSince()); "после попытки снова напасть худ пропадает" — отдельный баг в
 * обработке ошибки startFight() на клиенте, см. boss-startfight-error-restores-select-screen.
 * test.js (частый повод для такой ошибки сразу после победы — исчерпанный дневной лимit убийств
 * именно этого босса).
 *
 * Фикс: курсор при бэкфилле — строго граница ПО ВРЕМЕНИ ($bossStartMs), не "что сейчас в конце
 * таблицы". SELECT MAX(id) WHERE time < $bossStartMs — id последней строки ДО начала ИМЕННО
 * этой попытки боя, независимо от того, кто уже успел ударить и был ли friendIds известен в
 * момент бэкфилла. Следующий же вызов _syncFightSession() (attack/friendsDamage/claimKill/
 * useSedoy — все текут через один и тот же _applyFriendDamage()) с уже корректным friendIds
 * честно подберёт ВЕСЬ урон друга с начала боя (id > граница), а не потеряет его.
 *
 * Run: node tests/boss-fight-session-friend-cursor-time-scoped.test.js
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

const bossesPhp = readSrc('server/core/controllers/bosses.php');

const syncStart = bossesPhp.indexOf('private function _syncFightSession(');
const syncEnd   = bossesPhp.indexOf('\n        }', syncStart);
const syncBody  = bossesPhp.slice(syncStart, syncEnd);

console.log('\nTest 1: курсор бэкфилла — граница по времени ($bossStartMs), не глобальный максимум таблицы');
{
    assert(/\$res = \$link->query\('SELECT MAX\(`id`\) AS maxId FROM `boss_damage_log` WHERE `time` < '\.intval\(\$bossStartMs\)\);/.test(syncBody),
        'запрос курсора ограничен `time` < $bossStartMs — id последней строки ДО начала ЭТОЙ попытки боя');
}

console.log('\nTest 2: регресс-гвард — старая формулировка (безусловный MAX(id) по всей таблице) не вернулась');
{
    // Ищем ИМЕННО безусловный вариант запроса (ровно закрывающая кавычка сразу после имени
    // таблицы, без WHERE) — старый баг выглядел как 'SELECT MAX(`id`) AS maxId FROM `boss_damage_log`'.
    const oldPattern = /query\('SELECT MAX\(`id`\) AS maxId FROM `boss_damage_log`'\)/;
    assert(!oldPattern.test(syncBody), 'query() больше не вызывается с безусловной строкой без WHERE `time`');
}

console.log('\nTest 3: friendIds по-прежнему используется ТОЛЬКО для суммы урона друга — не участвует в определении границы курсора');
{
    // Порядок в исходнике: $mine, затем $friends (с использованием friendIds), затем ЗАПРОС
    // курсора — friendIds не должен упоминаться в самой строке SQL-запроса курсора.
    const cursorQueryLine = syncBody.split('\n').find(l => l.includes('SELECT MAX(`id`) AS maxId'));
    assert(!!cursorQueryLine, 'строка с запросом курсора найдена');
    assert(cursorQueryLine && !cursorQueryLine.includes('friendIds') && !cursorQueryLine.includes('ids'),
        'запрос курсора не зависит от friendIds — граница чисто по времени, значит не может "потерять" друга, ещё не признанного взаимным на момент бэкфилла');
}

console.log('\nTest 4: _applyFriendDamage() не менялась — по-прежнему курсорная дедупликация без отдельного фильтра по time (граница уже в самом курсоре)');
{
    const start = bossesPhp.indexOf('private function _applyFriendDamage(');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/`id` > \$sinceId/.test(body), 'фильтр по-прежнему id > курсор — теперь курсор сам по себе честно кодирует "после $bossStartMs", а не "после случайного момента опроса"');
    assert(!/`time`\s*>=/.test(body), 'по-прежнему без отдельного фильтра по time внутри самого _applyFriendDamage — вся защита теперь целиком в правильной границе курсора при бэкфилле');
}

console.log('\nTest 5: sanity — все серверные вызывающие места (attack/claimKill/useSedoy/friendsDamage/startFight) по-прежнему текут через ОДИН _syncFightSession(), фикс применяется ко всем сразу');
{
    const callers = [
        "function attack(){",
        "function claimKill(){",
        "function useSedoy(){",
        "function friendsDamage(){",
        "function startFight(){",
    ];
    callers.forEach(marker => {
        const idx = bossesPhp.indexOf(marker);
        assert(idx !== -1, marker + ' найдена в bosses.php');
        const nextFn = bossesPhp.indexOf('\n        function ', idx + 1);
        const funcBody = bossesPhp.slice(idx, nextFn === -1 ? bossesPhp.length : nextFn);
        assert(/\$this->_syncFightSession\(/.test(funcBody), marker + ' вызывает _syncFightSession() — получает исправленную границу курсора автоматически, без отдельной правки в каждой функции');
    });
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
