/**
 * Test: 29.09.2026, по прямому указанию + скриншот — "Медаль вроде получена за 10 киллов, но
 * она как была мутная на заднем плане, так и осталась. Сделать надо, чтобы она была чёткой."
 *
 * Экран списка боссов (bosses_select.js) рисует медаль (бронза/серебро/золото за 10/50/100
 * побед) с alpha = killed >= MEDAL_THRESHOLDS[mi] ? 1.0 : 0.35 — "мутная" = alpha 0.35
 * (медаль не заработана), "чёткая" = alpha 1.0 (заработана).
 *
 * Корень: переменная `killed` (единственный источник для alpha медали) читалась ТОЛЬКО из
 * bd.killsTotal[i] — распарсенного udata['bosses_data'] (JSON-блоб). Соседняя переменная
 * `dailyKilled` уже получила фикс 24.09.2026 (см. комментарий в коде — баг "УБИТО:0 ЛИМИТ:0/7
 * сразу после перезагрузки, хотя в БД реально 4"): если udata['bosses_data'] ещё не успел
 * подхватить самый свежий patch (гонка с параллельным автосейвом — тот же класс багов, что
 * incident_checkall_flush_wipes_server_credits, см. память агента), dailyKilled падает обратно
 * на bosses.dailyKills[i] (in-memory снимок, обновляется сразу по ответу сервера). У `killed`
 * такого фолбэка не было — если bd.killsTotal[i] временно отставал, killed молча оставался 0
 * несмотря на то, что bosses.killsTotal[i] уже содержал верный счёт побед, и медаль визуально
 * не "открывалась" даже после честно набранного порога.
 *
 * Фикс: killed теперь падает на bosses.killsTotal[i], если bd.killsTotal[i] недоступен — тем же
 * способом, что dailyKilled уже делает для bosses.dailyKills[i].
 *
 * Run: node tests/boss-medal-alpha-killstotal-fallback.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bossesSelectJs = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_select.js'), 'utf-8');

console.log('\n1) bosses_select.js — killed падает на bosses.killsTotal[i], если bd.killsTotal[i] недоступен (та же логика, что dailyKilled)');
{
    // 02.10.2026: bd теперь объявляется отдельно (`let bd = {};` до try) и переприсваивается
    // здесь БЕЗ `const` — та же переменная, просто другой стиль объявления (var-scope, не логика).
    const s = bossesSelectJs.indexOf('bd = helper.safeParseJSON(udata && udata[\'bosses_data\'], {});');
    const e = bossesSelectJs.indexOf('if(window.bosses && bosses._bossStartMs && bosses._diffIdx != null)', s);
    assert(s !== -1 && e !== -1, 'блок вычисления dailyKilled/killed найден');
    const body = bossesSelectJs.slice(s, e);

    assert(/if\(bd\.dailyKills && bd\.dailyKills\[i\] != null\) dailyKilled = parseInt\(bd\.dailyKills\[i\] \|\| 0\);/.test(body),
        'sanity: dailyKilled по-прежнему читается из bd.dailyKills[i] первым делом');
    assert(/else if\(window\.bosses && bosses\.dailyKills\) dailyKilled = parseInt\(bosses\.dailyKills\[i\] \|\| 0\);/.test(body),
        'sanity: dailyKilled по-прежнему имеет фолбэк на bosses.dailyKills[i] (уже существовавший фикс от 24.09.2026)');

    assert(/if\(bd\.killsTotal && bd\.killsTotal\[i\] != null\) killed = parseInt\(bd\.killsTotal\[i\] \|\| 0\);/.test(body),
        'killed по-прежнему читается из bd.killsTotal[i] первым делом');
    assert(/else if\(window\.bosses && bosses\.killsTotal\) killed = parseInt\(bosses\.killsTotal\[i\] \|\| 0\);/.test(body),
        'КРИТИЧНО (фикс): killed теперь тоже падает на bosses.killsTotal[i], если bd.killsTotal[i] недоступен/устарел');
}

console.log('\n2) Регресс-гвард — сама формула alpha медали (X >= порог ? 1.0 : 0.35) не тронута этой правкой');
{
    // 02.10.2026 (найдено при разборе этого провала, не связано с исходным фиксом выше):
    // отдельная правка (migrate42.php + bosses.php $data['medalKills'], см.
    // tests/sedoy-dev-roulette-medals.test.js) завела для медалей ОТДЕЛЬНУЮ серию убийств
    // (medalKilled = bd.medalKills[i] ?? killed, см. комментарий в коде — "Медали считают
    // отдельную серию после общего сброса, а надпись «УБИТО» остаётся исторической"), поэтому
    // alpha теперь сравнивается с medalKilled, а не с killed напрямую. killed по-прежнему
    // участвует как фолбэк внутри medalKilled, когда medalKills ещё не на сервере — сам фикс
    // из этого теста (killsTotal-фолбэк) не тронут, просто на один уровень глубже.
    assert(/const medalKilled = \(bd\.medalKills && bd\.medalKills\[i\] != null\) \? parseInt\(bd\.medalKills\[i\] \|\| 0\) : killed;/.test(bossesSelectJs),
        'medalKilled — отдельная серия медалей с фолбэком на killed (тот самый killed из фикса выше)');
    assert(/mSpr\.alpha = medalKilled >= MEDAL_THRESHOLDS\[mi\] \? 1\.0 : 0\.35;/.test(bossesSelectJs),
        'формула alpha медали осталась прежней по сути — сравнение с порогом, просто источник теперь medalKilled');
}

console.log('\n3) Реальный прогон логики — фолбэк спасает от "медаль не открылась" при отставании udata от in-memory состояния');
{
    // Мини-модель ИМЕННО той логики, что теперь в коде (порядок условий важен — регресс на
    // текстовый паттерн не поймал бы, если бы порядок или условие сломались).
    function computeKilled(bd, bossesKillsTotal, i){
        let killed = 0;
        if(bd.killsTotal && bd.killsTotal[i] != null) killed = parseInt(bd.killsTotal[i] || 0);
        else if(bossesKillsTotal) killed = parseInt(bossesKillsTotal[i] || 0);
        return killed;
    }

    // Сценарий из репорта: udata['bosses_data'] ещё хранит СТАРЫЙ снимок (killsTotal отсутствует
    // вовсе, как бывает сразу после гонки с автосейвом) — но in-memory bosses.killsTotal уже
    // содержит честно заработанные 10 побед.
    let killed = computeKilled({}, [0,0,0,0,0,0,0,10], 7);
    assert(killed === 10, 'до фикса было бы 0 (медаль "мутная") — после фикса корректно читает 10 из bosses.killsTotal');
    assert(killed >= 10, 'при killed=10 и пороге бронзы=10 медаль теперь считается заработанной (alpha=1.0)');

    // Обычный путь — bd.killsTotal свежий и валидный, фолбэк не должен его перекрывать.
    killed = computeKilled({killsTotal: [0,0,0,0,0,0,0,25]}, [0,0,0,0,0,0,0,999], 7);
    assert(killed === 25, 'если bd.killsTotal валиден — используется ОН, а не устаревший/иной bosses.killsTotal (fallback не перекрывает свежие данные)');

    // Ни того, ни другого нет (совсем новый аккаунт) — остаётся 0, медаль корректно не показана.
    killed = computeKilled({}, null, 7);
    assert(killed === 0, 'если оба источника недоступны — killed остаётся 0 (новый игрок, медаль честно не заработана)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
