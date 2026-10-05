/**
 * Test: батч 25.09.2026 (по прямому указанию, ответ на вопрос про поведение топов) —
 * подтверждённое асимметричное поведение двух вкладок топа:
 *  - cat:0 «Топ урона» — обновляется КАЖДУЮ НЕДЕЛЮ (считается из boss_damage_log с фильтром
 *    по времени начала текущей календарной недели, не lifetime-поле total_damage).
 *  - cat:4 «Топ по авторитету» (сортирует по exp/уровню, см. 23.09.2026 батч) — ЗА ВСЮ ИСТОРИЮ
 *    игры, без сброса. Причина: "через год цифры lifetime-урона теряют смысл для соревнования",
 *    а прогрессия по уровню естественно ограничена — накопительная метрика там осмысленна.
 *
 * Run: node tests/top-weekly-damage-vs-lifetime-authority.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src  = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'top.php'), 'utf-8');

console.log('\n1) get() — cat:0 перенаправляется в отдельный еженедельный обработчик ДО общей lifetime-ветки');
{
    const getStart = src.indexOf('function get(){');
    const getEnd   = src.indexOf('\n    }', src.indexOf('$this->ops->ok(\'rows\''.replace("'","")) );
    assert(/if\(\$cat === 0\) return \$this->_getWeeklyDamageTop\(\);/.test(src),
        'cat===0 отдаёт управление _getWeeklyDamageTop() отдельным ранним return');
    // Ранний return должен стоять РАНЬШЕ общего запроса к lifetime-полям (иначе cat:0 всё
    // равно попадёт в старую ветку до того, как дойдёт до if).
    const earlyReturnIdx = src.indexOf('if($cat === 0) return $this->_getWeeklyDamageTop();');
    const fieldsIdx      = src.indexOf('$fields = [\'total_damage\'');
    assert(earlyReturnIdx !== -1 && fieldsIdx !== -1 && earlyReturnIdx < fieldsIdx,
        'ранний return для cat:0 физически стоит раньше $fields (общая lifetime-ветка) в коде');
}

console.log('\n2) _getWeeklyDamageTop() — считает урон из boss_damage_log, не из lifetime-поля total_damage');
{
    const start = src.indexOf('private function _getWeeklyDamageTop(){');
    const end   = src.indexOf('\n    }', src.indexOf('$this->ops->ok([\'rows\'=>$out, \'my_value\'=>$my_value, \'my_place\'=>$my_place, \'cat\'=>0', start));
    assert(start !== -1, '_getWeeklyDamageTop() определён');
    const body = src.slice(start, end);
    assert(/FROM `boss_damage_log` bl/.test(body), 'источник данных — boss_damage_log (пер-хитовый лог), не users.total_damage');
    assert(!/`total_damage`/.test(body), 'lifetime-поле total_damage НИГДЕ не читается в этой ветке');
    assert(/SUM\(bl\.`damage`\) AS dmg/.test(body), 'суммирует реальный нанесённый урон по логу');
}

console.log('\n3) Границы недели — понедельник 00:00 серверных часов, ТА ЖЕ переменная используется во всех трёх запросах (leaderboard/my_value/my_place)');
{
    const start = src.indexOf('private function _getWeeklyDamageTop(){');
    const end   = src.indexOf('\n    }', src.indexOf('$this->ops->ok([\'rows\'=>$out, \'my_value\'=>$my_value, \'my_place\'=>$my_place, \'cat\'=>0', start));
    const body = src.slice(start, end);
    // 05.10.2026 (стале-пин, не регрессия — баг по репорту "топ не обновился на новой неделе"):
    // сырой strtotime('monday this week...') вычислялся в де-факто UTC-контексте PHP-процесса,
    // а не в МСК — каждый понедельник 00:00-02:59 МСК (ещё воскресенье по UTC-календарю) топ не
    // разворачивался. Заменён на Gameops::mskWeekStartTs(), см.
    // tests/gameops-msk-week-start-real-exec-05-10.test.js.
    assert(/\$weekStartTs = \$this->ops->mskWeekStartTs\(\);/.test(body),
        'начало недели вычисляется через Gameops::mskWeekStartTs() — корректно учитывает МСК, не сырое время сервера');
    const usages = (body.match(/\$weekStartTs/g) || []).length;
    assert(usages >= 4, '$weekStartTs используется во всех местах (объявление + 3 запроса) — нашлось упоминаний: ' + usages);
}

console.log('\n4) my_value/my_place считаются ТЕМ ЖЕ способом (тот же фильтр по неделе), что и сам leaderboard — не рассинхронизированы с ним');
{
    const start = src.indexOf('private function _getWeeklyDamageTop(){');
    const end   = src.indexOf('\n    }', src.indexOf('$this->ops->ok([\'rows\'=>$out, \'my_value\'=>$my_value, \'my_place\'=>$my_place, \'cat\'=>0', start));
    const body = src.slice(start, end);
    // 29.09.2026: добавлен AND `is_sedoy`=0 — см. tests/top-weekly-damage-excludes-sedoy.test.js.
    assert(/SELECT SUM\(`damage`\) AS s FROM `boss_damage_log` WHERE `uid` = \{\$uid\} AND `time` >= \{\$weekStartTs\} AND `is_sedoy`=0/.test(body),
        'my_value — сумма урона игрока за ТУ ЖЕ неделю');
    assert(/HAVING dmg > \{\$my_value\}/.test(body),
        'my_place считает игроков со строго БОЛЬШЕЙ недельной суммой (стандартная формула места +1)');
}

console.log('\n5) cat:4 (Топ по авторитету) — НЕ ТРОНУТ, остаётся lifetime (exp), без изменений');
{
    assert(/\$fields = \[\'total_damage\',\'coins\',\'bosses_killed\',\'stew\',\'exp\',\'achievement_stars\'\];/.test(src),
        '$fields[4]=exp сохранён нетронутым — cat:4 по-прежнему lifetime, без фильтра по неделе');
    // cat:4 идёт через СТАРУЮ ветку (users-таблица), не через _getWeeklyDamageTop — проверяем,
    // что новая функция вызывается ИСКЛЮЧИТЕЛЬНО для cat===0.
    assert((src.match(/_getWeeklyDamageTop\(\)/g) || []).length === 2,
        '_getWeeklyDamageTop упомянут ровно дважды — вызов (cat:0) и само определение метода, никакой другой cat её не зовёт');
}

console.log('\n6) scope=\'friends\' поддержан в обеих ветках (топ друзей работает для еженедельного урона так же, как для lifetime-категорий)');
{
    const start = src.indexOf('private function _getWeeklyDamageTop(){');
    const end   = src.indexOf('\n    }', src.indexOf('$this->ops->ok([\'rows\'=>$out, \'my_value\'=>$my_value, \'my_place\'=>$my_place, \'cat\'=>0', start));
    const body = src.slice(start, end);
    assert(/if\(\$scope === 'friends'\)\{/.test(body), 'ветка friends присутствует в еженедельном обработчике');
    assert(/bl\.`uid` IN\(/.test(body), 'фильтр друзей применяется к boss_damage_log.uid (алиас bl), а не к несуществующей здесь users-таблице напрямую');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
