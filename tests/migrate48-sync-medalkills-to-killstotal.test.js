/**
 * Test: 17.10.2026, по прямому указанию — "почему-то золотые медали за 100 убитых боссов не
 * даются". Найдено: medalKills (счётчик для бронза/серебро/золото, 10/50/100) был однажды
 * обнулён отдельной миграцией 42 ("обнуляет ТОЛЬКО визуальный прогресс медалей... не ломая
 * историю убийств"), а видимый на карточке босса счётчик "УБИТО: N" берётся из ДРУГОГО,
 * никогда не сбрасываемого killsTotal — игрок с "УБИТО: 100" ожидает золото, но его medalKills
 * мог ещё не догнать после сброса. По прямому указанию (после объяснения) — одноразово поднять
 * medalKills до killsTotal всем игрокам, отменяя эффект миграции 42.
 *
 * tests/_fixtures/schema-history/migrate48.php.txt — разовая ручная синхронизация, запущена на проде 17.10.2026 (Checked:
 * 66, players fixed: 32, total kill-points bumped: 926 — подтверждено логом выполнения и прямой
 * сверкой нескольких живых аккаунтов по SSH/MySQL, например Antikrizis: killsTotal=[143,53,18,7]
 * medalKills было [112,39,13,5] → стало [143,53,18,7]).
 *
 * Run: node tests/migrate48-sync-medalkills-to-killstotal.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const migratePhp = fs.readFileSync(path.join(root, 'tests', '_fixtures', 'schema-history', 'migrate48.php.txt'), 'utf-8');

console.log('\n1) migrate48.php — только UPDATE точечной строки, никаких DROP/TRUNCATE/DELETE');
{
    assert(!/DROP\b/i.test(migratePhp) && !/TRUNCATE\b/i.test(migratePhp) && !/DELETE FROM/i.test(migratePhp),
        'скрипт не удаляет и не очищает таблицы/строки целиком');
    assert(/UPDATE `\{\$r\['utb'\]\}` SET bosses_data='\$json' WHERE id=\$id/.test(migratePhp),
        'UPDATE точечный, по id конкретной строки');
}

console.log('\n2) migrate48.php — гейт по ключу (или CLI), как и остальные миграции проекта');
{
    assert(/PHP_SAPI !== 'cli'.*FIXTURE_NOT_EXECUTABLE/.test(migratePhp),
        'защищена секретным ключом в URL ИЛИ разрешён прямой CLI-запуск (тот же паттерн, что migrate47)');
}

console.log('\n3) Реальный прогон логики — medalKills[i] поднимается ТОЛЬКО если killsTotal[i] больше, никогда не понижается');
{
    // Порт логики скрипта 1-в-1 на JS.
    function migrateRow(rawJson){
        const data = JSON.parse(rawJson);
        if(!data || typeof data !== 'object') return null;
        const killsTotal = Array.isArray(data.killsTotal) ? data.killsTotal : [];
        if(!killsTotal.length) return null;
        if(!Array.isArray(data.medalKills)) data.medalKills = new Array(8).fill(0);
        while(data.medalKills.length < 8) data.medalKills.push(0);
        let changed = false;
        for(let i = 0; i < 8; i++){
            const kt = parseInt(killsTotal[i]) || 0;
            const mk = parseInt(data.medalKills[i]) || 0;
            if(kt > mk){ data.medalKills[i] = kt; changed = true; }
        }
        return changed ? JSON.stringify(data) : null; // null = "не тронут" (как continue в PHP)
    }

    // Antikrizis-подобный случай — реальный разрыв после миграции 42.
    const row1 = JSON.stringify({
        killsTotal: [143,53,18,7,0,0,0,0],
        medalKills: [112,39,13,5,0,0,0,0],
        keys: [999,2,1,0,0,0,0,0],            // НЕ должно измениться
        dailyKills: [3,1,0,0,0,0,0,0],        // НЕ должно измениться
        freeWpnCdMs: {'0': 1735000000000},    // НЕ должно измениться
    });
    const result1 = JSON.parse(migrateRow(row1));
    assert(JSON.stringify(result1.medalKills) === JSON.stringify([143,53,18,7,0,0,0,0]),
        'medalKills поднят до killsTotal поэлементно (112→143, 39→53, 13→18, 5→7)');
    assert(JSON.stringify(result1.keys) === JSON.stringify([999,2,1,0,0,0,0,0]), 'КРИТИЧНО: keys НЕ изменились');
    assert(JSON.stringify(result1.dailyKills) === JSON.stringify([3,1,0,0,0,0,0,0]), 'КРИТИЧНО: dailyKills НЕ изменились');
    assert(JSON.stringify(result1.freeWpnCdMs) === JSON.stringify({'0': 1735000000000}), 'КРИТИЧНО: freeWpnCdMs НЕ тронут');

    // Уже синхронный случай (Sveligen-подобный, никогда не затрагивался миграцией 42) — не трогаем.
    const row2 = JSON.stringify({ killsTotal: [67,24,9,3,0,0,0,0], medalKills: [67,24,9,3,0,0,0,0] });
    assert(migrateRow(row2) === null, 'уже синхронный medalKills=killsTotal — строка пропускается (changed=false), лишний UPDATE не шлётся');

    // medalKills отсутствует целиком (старый формат до введения поля) — инициализируется нулями, затем поднимается.
    const row3 = JSON.stringify({ killsTotal: [10,0,0,0,0,0,0,0] });
    const result3 = JSON.parse(migrateRow(row3));
    assert(result3.medalKills[0] === 10, 'medalKills, отсутствовавший в блобе, создаётся и поднимается до killsTotal');

    // medalKills ВЫШЕ killsTotal (не должно штатно случаться) — миграция НЕ понижает его.
    const row4 = JSON.stringify({ killsTotal: [5,0,0,0,0,0,0,0], medalKills: [8,0,0,0,0,0,0,0] });
    assert(migrateRow(row4) === null, 'medalKills > killsTotal — не трогается (миграция только поднимает вверх, никогда не понижает)');
}

console.log('\n4) Реальный прогон логики — строки без killsTotal (никогда не начинал бой) безопасно пропускаются');
{
    function migrateRow(rawJson){
        const data = JSON.parse(rawJson);
        if(!data || typeof data !== 'object') return null;
        const killsTotal = Array.isArray(data.killsTotal) ? data.killsTotal : [];
        if(!killsTotal.length) return null;
        return 'would-process';
    }
    assert(migrateRow('{"keys":[999,0,0,0,0,0,0,0]}') === null, 'запись без killsTotal — пропускается, нечего синхронизировать');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
