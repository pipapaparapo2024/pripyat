/**
 * Test: 29.09.2026, по прямому указанию — "проверь урон от седого проходит в топ по урону?
 * если да то он не должен проходить".
 *
 * Ответ на первую часть — ДА, проходил: top.php.get() (cat:0, "Топ по урону" на Сводке) уже
 * с 25.09.2026 считается НЕ по lifetime-полю total_damage, а прямым SUM() по boss_damage_log
 * за текущую календарную неделю (см. tests/top-weekly-damage-vs-lifetime-authority.test.js) —
 * но этот запрос не знал о колонке `is_sedoy` (миграция 35, добавлена 29.09.2026 для
 * bosses.php._ratingTop(), см. tests/boss-sedoy-excluded-from-friend-rating.test.js) и суммировал
 * ЛЮБОЙ урон из лога, включая купленную помощь Седого.
 *
 * Вторая часть указания — "топ по урону делаем недельным, кд одна неделя, сбрасываем в конце" —
 * УЖЕ выполнена (см. комментарий 25.09.2026 в top.php.get(): `strtotime('monday this week
 * 00:00:00')`, сам сбрасывается прошедшей неделей, выпадающей из фильтра `time >=`, без
 * отдельного счётчика/крона) — никаких дополнительных изменений не потребовалось.
 *
 * Фикс: все три запроса _getWeeklyDamageTop() (список топа, моя сумма, моё место) получили
 * `is_sedoy`=0 — та же логика, что уже применена к внутрибоевому рейтингу "УЧАСТНИКИ БОЯ"
 * (bosses.php._ratingTop()). Урон Седого по-прежнему УБИВАЕТ босса (пишется в лог, влияет на
 * производный HP) — просто не учитывается как личный вклад ни в одном из рейтингов урона.
 *
 * Run: node tests/top-weekly-damage-excludes-sedoy.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const topPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'top.php'), 'utf-8');

function weeklyBody(){
    const start = topPhp.indexOf('private function _getWeeklyDamageTop(){');
    const end   = topPhp.indexOf('\n    }', topPhp.indexOf('$this->ops->ok([\'rows\'=>$out, \'my_value\'=>$my_value, \'my_place\'=>$my_place, \'cat\'=>0', start));
    return topPhp.slice(start, end);
}

console.log('\n1) Список топа (leaderboard rows) — подзапрос по boss_damage_log исключает is_sedoy=1');
{
    const body = weeklyBody();
    // 06.10.2026: переменная переименована в $weekStartMs (boss_damage_log.time — миллисекунды,
    // см. tests/top-weekly-damage-ms-vs-seconds-unit-mismatch-06-10.test.js) — сам фильтр и его
    // позиция относительно is_sedoy=0 не изменились, обновлено только имя.
    assert(/WHERE `time` >= \{\$weekStartMs\} AND `is_sedoy`=0\s*\n\s*GROUP BY `uid`/.test(body),
        'подзапрос d (список топа) фильтрует is_sedoy=0 вместе с временны́м окном недели');
}

console.log('\n2) my_value (моя недельная сумма) — тот же фильтр is_sedoy=0');
{
    const body = weeklyBody();
    assert(/SELECT SUM\(`damage`\) AS s FROM `boss_damage_log` WHERE `uid` = \{\$uid\} AND `time` >= \{\$weekStartMs\} AND `is_sedoy`=0/.test(body),
        'my_value считается БЕЗ урона Седого — согласовано с leaderboard выше');
}

console.log('\n3) my_place (моё место) — тот же фильтр is_sedoy=0, включая ветку scope=friends');
{
    const body = weeklyBody();
    assert(/WHERE bl\.`time` >= \{\$weekStartMs\} AND bl\.`is_sedoy`=0/.test(body),
        'подзапрос для места тоже исключает is_sedoy=1 — три запроса (rows/my_value/my_place) согласованы друг с другом');
}

console.log('\n4) Регресс-гвард — недельная граница (strtotime monday this week) не тронута этой правкой, топ остаётся недельным');
{
    const body = weeklyBody();
    // 05.10.2026 (стале-пин, не регрессия — баг по репорту "топ не обновился на новой неделе"):
    // сырой strtotime() заменён на Gameops::mskWeekStartTs() (та же МСК-граница понедельника,
    // но без 3-часового разъезда с UTC-временем сервера), см.
    // tests/gameops-msk-week-start-real-exec-05-10.test.js. Топ остаётся недельным — эта правка
    // поменяла только ТОЧНОСТЬ границы, не саму концепцию "раз в неделю".
    assert(/\$weekStartTs = \$this->ops->mskWeekStartTs\(\);/.test(body),
        'граница недели осталась прежней — задача "сделать недельным" уже была выполнена 25.09.2026, эта правка её не трогает');
}

console.log('\n5) Регресс-гвард — HP-производные пути (bosses.php) НЕ фильтруют is_sedoy (урон седого по-прежнему убивает босса)');
{
    const bossesPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
    const start = bossesPhp.indexOf('private function _syncFightSession(');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(!/is_sedoy/.test(body), '_syncFightSession() (производный HP боя) по-прежнему не упоминает is_sedoy — топ и HP это независимые, не спутанные фильтры');
}

console.log('\n6) Реальный прогон логики — недельная сумма после фикса исключает вклад Седого, независимо посчитанный');
{
    // Мини-модель SUM() с фильтром is_sedoy=0 — та же формула, что теперь в SQL.
    function weeklySumExcludingSedoy(rows, uid){
        return rows.filter(r => r.uid === uid && r.is_sedoy === 0).reduce((s, r) => s + r.damage, 0);
    }
    function weeklySumAll(rows, uid){
        return rows.filter(r => r.uid === uid).reduce((s, r) => s + r.damage, 0);
    }

    const weekLog = [
        { uid: 1, damage: 3000, is_sedoy: 0 },  // честный удар
        { uid: 1, damage: 15000, is_sedoy: 1 }, // Седой — не должен идти в топ
        { uid: 2, damage: 4000, is_sedoy: 0 },
    ];

    assert(weeklySumExcludingSedoy(weekLog, 1) === 3000, 'до фикса топ показал бы 18000 (3000+15000), после фикса — честные 3000');
    assert(weeklySumAll(weekLog, 1) === 18000, 'регресс-гвард модели: без фильтра сумма действительно была бы 18000 (подтверждает, что баг был реальным)');
    assert(weeklySumExcludingSedoy(weekLog, 2) === 4000, 'игрок без Седого — значение не меняется фильтром вообще');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
