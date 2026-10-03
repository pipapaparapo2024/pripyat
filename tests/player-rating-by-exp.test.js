/**
 * Test: 29.09.2026, по прямому указанию + скриншот визитки игрока — "Вот тут рейтинг сделай
 * привязку к уровню игрока. Кто на каком месте по опыту в игре, такое и место в рейтинге."
 *
 * Корень: "РЕЙТИНГ #N" на визитке игрока (player_profile.js, поле profile.rating_place) на
 * самом деле считался users.php.getProfile() как место в топе по УРОНУ (total_damage) — та же
 * метрика, что и "ТОП ПО УРОНУ" в Сводке. Визитка при этом соседним полем показывает УРОВЕНЬ
 * игрока — то есть заголовок "рейтинг" рядом с уровнем визуально подразумевал ранжирование по
 * этому же уровню/опыту, а фактически ранжировал по совершенно другой метрике (урону боссам).
 *
 * Фикс: rating_place теперь считается по `exp` (тот же столбец БД, из которого клиент считает
 * уровень персонажа — см. CLAUDE.md "Уровни: 0→1 = 40 опыта, каждый следующий +40 к порогу
 * накопительно") — место по опыту теперь равно месту в рейтинге. Игроки на одном УРОВНЕ (но с
 * разным опытом внутри уровня) получают разные места — это ожидаемо и более гранулярно, чем
 * ранжирование по самому уровню, но полностью эквивалентно ему по порядку между разными
 * уровнями (выше уровень ⇒ выше exp ⇒ выше место, всегда).
 *
 * Run: node tests/player-rating-by-exp.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const usersPhp        = read('server/core/controllers/users.php');
const playerProfileJs = read('_client/src/game/shell/overlays/player_profile.js');

console.log('\n1) users.php.getProfile() — rating_place считается по exp, не по total_damage');
{
    const start = usersPhp.indexOf('function getProfile(){');
    const end   = usersPhp.indexOf('\n        }', start);
    assert(start !== -1 && end !== -1, 'getProfile() найдена целиком');
    const body = usersPhp.slice(start, end);

    assert(/\$myExp = intval\(\$row\['exp'\] \?\? 0\);/.test(body), 'читает свой exp из строки игрока');
    assert(/SELECT COUNT\(\*\)\+1 AS place FROM `\{\$this->registry\['utb'\]\}` WHERE `exp`-0 > \{\$myExp\}/.test(body),
        'КРИТИЧНО: SQL считает место по `exp` (больше игроков с БОЛЬШИМ опытом + 1 = моё место)');
    assert(!/WHERE `total_damage`-0 > \{\$myDamage\}/.test(body),
        'старый запрос по total_damage (топ по урону) удалён — не задвоенный источник рейтинга');
    assert(/'id', 'nick', 'exp', 'respect'/.test(body), 'sanity: exp уже входит в SELECT getProfile() (не нужно отдельного запроса)');
    assert(/'rating_place'\s*=> \$ratingPlace,/.test(body), 'rating_place по-прежнему возвращается клиенту под тем же ключом (клиент не нужно менять)');
}

console.log('\n2) player_profile.js — читает profile.rating_place как раньше (клиентский контракт не менялся, поменялась только серверная формула)');
{
    assert(/const ratingStr = profile\.rating_place \? \('#' \+ profile\.rating_place\) : '-';/.test(playerProfileJs),
        'клиент по-прежнему просто показывает "#" + rating_place — вся логика ранжирования на сервере');
}

console.log('\n3) Реальный прогон логики — место в рейтинге строго следует порядку по опыту');
{
    // Мини-модель ИМЕННО серверной формулы: place = COUNT(exp > myExp) + 1.
    function ratingPlace(allExp, myExp){
        return allExp.filter(e => e > myExp).length + 1;
    }

    const players = [50000, 40000, 25000, 25000, 10000, 0]; // разные игроки в "БД"
    assert(ratingPlace(players, 50000) === 1, 'игрок с максимальным опытом — место #1');
    assert(ratingPlace(players, 0) === 6, 'игрок с нулевым опытом (или его нет в списке) — последнее место');
    assert(ratingPlace(players, 25000) === 3, 'при равном опыте с другим игроком — оба получают одинаковое место (COUNT строго больше, не >=)');

    // Более высокий уровень (а значит и больший накопленный exp) всегда даёт место не хуже —
    // порядок между УРОВНЯМИ сохраняется, даже если гранулярность внутри уровня выше.
    const lowLevelExp = 39;   // ещё не пересёк порог первого уровня (40 exp = 0→1)
    const highLevelExp = 40;  // уже 1-й уровень
    assert(ratingPlace([highLevelExp, lowLevelExp], lowLevelExp) > ratingPlace([highLevelExp, lowLevelExp], highLevelExp),
        'игрок следующего уровня (больше exp) всегда получает место не хуже игрока предыдущего уровня');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
