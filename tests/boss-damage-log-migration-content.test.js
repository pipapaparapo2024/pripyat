/**
 * Test: server/migrate23.php — создаёт таблицу boss_damage_log (аддитивно, CREATE TABLE IF NOT
 * EXISTS), тот же шаблон, что migrate19-22.php (защита ключом в URL, инструкция удалить файл
 * после выполнения). Источник правды для урона по боссам — см. большой комментарий в
 * server/core/controllers/bosses.php над _derivedHp() и
 * boss-attack-server-authoritative-and-timing-friend-rule.test.js за использованием таблицы.
 *
 * 22.09.2026: выполнен на проде вручную (https://pripyat-game.ru/server/migrate23.php?key=...),
 * таблица создана, файл удалён с сервера сразу после — тот же порядок действий, что и у
 * migrate19-22.php (см. историю в CLAUDE.md/migrate21.php). Локальная копия в репозитории
 * остаётся как историческая запись (тот же принцип, что migrate19-22.php).
 *
 * Run: node tests/boss-damage-log-migration-content.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'server', 'migrate23.php'), 'utf-8');

console.log('\nTest 1: защищена ключом в URL — тот же приём, что migrate19-22.php');
{
    assert(/if\(!isset\(\$_GET\['key'\]\) \|\| \$_GET\['key'\] !== 'stalker_migrate23_2026'\)\{/.test(migration),
        'защищена уникальным ключом — не выполняется случайным GET-запросом');
    assert(/http_response_code\(403\);/.test(migration), 'отдаёт 403 при неверном/отсутствующем ключе');
}

console.log('\nTest 2: CREATE TABLE IF NOT EXISTS boss_damage_log — аддитивно, идемпотентно, ничего не дропает');
{
    assert(/CREATE TABLE IF NOT EXISTS `boss_damage_log`/.test(migration), 'IF NOT EXISTS — повторный запуск безопасен');
    assert(/`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT/.test(migration), 'id — автоинкрементный первичный ключ');
    assert(/`uid` INT UNSIGNED NOT NULL/.test(migration), 'колонка uid — кто нанёс урон');
    assert(/`boss_id` TINYINT UNSIGNED NOT NULL/.test(migration), 'колонка boss_id');
    assert(/`diff_idx` TINYINT UNSIGNED NOT NULL/.test(migration), 'колонка diff_idx');
    assert(/`damage` INT UNSIGNED NOT NULL/.test(migration), 'колонка damage');
    assert(/`critical` TINYINT\(1\) NOT NULL DEFAULT 0/.test(migration), 'колонка critical — флаг крита');
    assert(/`time` BIGINT UNSIGNED NOT NULL/.test(migration), 'колонка time — серверное время удара (мс), не клиентское');
    assert(/PRIMARY KEY \(`id`\)/.test(migration), 'первичный ключ по id');
    assert(/KEY `idx_uid_boss_time` \(`uid`, `boss_id`, `diff_idx`, `time`\)/.test(migration),
        'составной индекс под запросы _damageSumSince()/_friendsDamageSumSince()/_friendsDamagePerUserSince() (uid+boss_id+diff_idx+time)');
    assert(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/.test(migration), 'InnoDB/utf8mb4 — тот же движок/кодировка, что у остальных таблиц проекта');
}

console.log('\nTest 3: та же инструкция "удалить после выполнения", что у существующих миграций');
{
    assert(/После выполнения — удалить файл с сервера\./.test(migration), 'комментарий с инструкцией присутствует');
    assert(/DELETE this file!/.test(migration), 'вывод после выполнения тоже напоминает удалить файл');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
