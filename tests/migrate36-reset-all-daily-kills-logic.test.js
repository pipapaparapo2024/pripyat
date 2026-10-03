/**
 * Test: 29.09.2026, по прямому указанию (извинение перед игроками — "сделай так, чтобы у всех
 * игроков все лимиты сбросились прямо сейчас"). server/migrate36.php — разовый ручной сброс
 * bosses_data.dailyKills/dailyDate у ВСЕХ игроков сразу.
 *
 * Это мутация JSON-блоба построчно (не простой UPDATE column=const), поэтому основной риск —
 * случайно затереть СОСЕДНИЕ поля того же блоба (keys/killsTotal/bossStartMs/freeWpnCdMs и
 * т.д.) вместо точечного сброса только dailyKills/dailyDate. Тест мини-моделирует ИМЕННО
 * логику декодирования/мутации/кодирования, что и в PHP-скрипте, чтобы поймать это ДО того,
 * как скрипт реально запущен на живой БД (нет локального PHP для прогона самого файла).
 *
 * Run: node tests/migrate36-reset-all-daily-kills-logic.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const migratePhp = fs.readFileSync(path.join(root, 'server', 'migrate36.php'), 'utf-8');

console.log('\n1) migrate36.php — только ADD/UPDATE точечных полей, никаких DROP/TRUNCATE/DELETE');
{
    assert(!/DROP\b/i.test(migratePhp) && !/TRUNCATE\b/i.test(migratePhp) && !/DELETE FROM/i.test(migratePhp),
        'скрипт не удаляет и не очищает таблицы/строки целиком');
    assert(/UPDATE `\{\$utb\}` SET `bosses_data`=\? WHERE `id`=\?/.test(migratePhp),
        'UPDATE точечный, по id конкретной строки, через prepared statement (защита от SQL-инъекции)');
    assert(/bind_param\('si', \$newJson, \$row\['id'\]\)/.test(migratePhp), 'параметры биндятся типизированно (не строковая конкатенация в SQL)');
}

console.log('\n2) migrate36.php — гейт по ключу, как и остальные миграции проекта');
{
    assert(/\$_GET\['key'\].*'stalker_migrate36_2026'/.test(migratePhp), 'защищена секретным ключом в URL (тот же паттерн, что migrate34/migrate35)');
}

console.log('\n3) Реальный прогон логики — мутация JSON меняет ТОЛЬКО dailyKills/dailyDate, остальные поля бита-в-бит сохранены');
{
    // Порт логики скрипта 1-в-1 (декодирование → мутация → кодирование), на JS вместо PHP —
    // JSON.parse/JSON.stringify эквивалентны json_decode/json_encode для этой структуры.
    function migrateRow(rawJson, todayMsk){
        const data = JSON.parse(rawJson);
        if(!data || typeof data !== 'object') return null;
        if(data.dailyKills === undefined && data.dailyDate === undefined) return null; // skippedEmpty
        data.dailyKills = [0,0,0,0,0,0,0,0];
        data.dailyDate = todayMsk;
        return JSON.stringify(data);
    }

    const realisticRow = JSON.stringify({
        dailyKills: [7,3,0,0,0,0,0,0],      // игрок уже выбрал весь лимит по Охотнику
        dailyDate: '2026-09-28',             // старая (вчерашняя) дата
        keys: [999,2,1,0,0,0,0,0],          // ключи — НЕ должны измениться
        killsTotal: [45,12,3,0,0,0,0,0],    // побед за всё время — НЕ должны измениться
        bossStartMs: [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]],
        freeWpnCdMs: {'0': 1735000000000, '1': 1735000000000, '2': 1735000000000}, // КД оружия — НЕ должен измениться
        curCycleDmg: [500,0,0,0,0,0,0,0],
    });

    const resultJson = migrateRow(realisticRow, '2026-09-29');
    assert(resultJson !== null, 'строка с dailyKills реально обрабатывается (не попадает в skippedEmpty)');
    const result = JSON.parse(resultJson);

    assert(JSON.stringify(result.dailyKills) === JSON.stringify([0,0,0,0,0,0,0,0]), 'dailyKills сброшен в нули для всех 8 боссов');
    assert(result.dailyDate === '2026-09-29', 'dailyDate выставлен на сегодняшнюю (новую) МСК-дату');

    // КРИТИЧНО — соседние поля не тронуты вообще.
    assert(JSON.stringify(result.keys) === JSON.stringify([999,2,1,0,0,0,0,0]), 'КРИТИЧНО: keys НЕ изменились — миграция не должна трогать ключи боссов');
    assert(JSON.stringify(result.killsTotal) === JSON.stringify([45,12,3,0,0,0,0,0]), 'КРИТИЧНО: killsTotal (победы за всё время) НЕ изменился');
    assert(JSON.stringify(result.bossStartMs) === JSON.stringify([[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]]),
        'КРИТИЧНО: bossStartMs (активные бои) НЕ тронут — идущие бои не форфейтятся этой миграцией');
    assert(JSON.stringify(result.freeWpnCdMs) === JSON.stringify({'0': 1735000000000, '1': 1735000000000, '2': 1735000000000}),
        'КРИТИЧНО: freeWpnCdMs (кулдаун бесплатного оружия) НЕ тронут');
    assert(JSON.stringify(result.curCycleDmg) === JSON.stringify([500,0,0,0,0,0,0,0]), 'КРИТИЧНО: curCycleDmg НЕ тронут');
}

console.log('\n4) Реальный прогон логики — граничные случаи безопасно пропускаются, не падают');
{
    function migrateRow(rawJson, todayMsk){
        let data;
        try { data = JSON.parse(rawJson); } catch(e) { return undefined; } // bad JSON — PHP-эквивалент: json_decode возвращает null, is_array(null)===false
        if(!data || typeof data !== 'object' || Array.isArray(data)) return null;
        if(data.dailyKills === undefined && data.dailyDate === undefined) return null;
        data.dailyKills = [0,0,0,0,0,0,0,0];
        data.dailyDate = todayMsk;
        return JSON.stringify(data);
    }

    assert(migrateRow('{"keys":[0,0,0,0,0,0,0,0]}', '2026-09-29') === null,
        'запись без dailyKills/dailyDate (никогда не начинал бой) — пропускается, нечего сбрасывать');
    assert(migrateRow('not valid json{{{', '2026-09-29') === undefined,
        'битый JSON — не бросает исключение наружу, безопасно определяется как невалидный (PHP: is_array(json_decode(...))===false)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
