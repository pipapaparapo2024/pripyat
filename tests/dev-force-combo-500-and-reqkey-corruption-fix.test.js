/**
 * Test: 26.09.2026, по прямому репорту пользователя (консоль) —
 *
 * "Пытался в dev включить 100% выпадение комбинации покера и выскочило 500 Internal Server
 * Error / [devPanel._setDevCombo] ← ошибка: Invalid request code:35, а следом раздача покера
 * упала с 'Несовпадение подписи запроса' (code:4), попап 'не удалось начать раздачу'".
 *
 * Root cause #1 (подтверждено чтением живого /var/log/php_errors.log на сервере):
 *   PHP Fatal error: Uncaught mysqli_sql_exception: Unknown column 'dev_force_poker' in
 *   'field list' in database.php:77 — прошлая сессия добавила users.php.setDevCombo() и
 *   dice.php/poker.php/blackjack.php/roulette.php, читающие dev_force_dice/poker/blackjack/
 *   roulette, но миграцию для этих 4 колонок не создала и не выполнила — колонок физически
 *   нет в живой БД (SHOW COLUMNS подтвердил только dev_force_drops/dev_force_jackpot).
 *   Фикс — server/migrate33.php (ALTER TABLE, по образцу migrate26.php).
 *
 * Root cause #2 (server.js.completeRequest()): при HTTP-статусе не 200 (как раз наш 500)
 *   client подставляет errors[1] (window.errors, index.js) — объект БЕЗ поля req_key.
 *   `this.req_key = this.json['req_key']` безусловно затирал req_key в undefined, из-за чего
 *   СЛЕДУЮЩИЙ запрос (раздача покера) уходил с буквальным "&req_key=undefined" и
 *   гарантированно падал кодом 4 на сервере — именно это увидел пользователь сразу после 500.
 *
 * Run: node tests/dev-force-combo-500-and-reqkey-corruption-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const migratePath = path.join(root, 'server', 'migrate33.php');
const serverSrc = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'server.js'), 'utf-8');

console.log('\nTest 1: server/migrate33.php существует и добавляет все 4 недостающие колонки');
{
    assert(fs.existsSync(migratePath), 'migrate33.php создан');
    const src = fs.readFileSync(migratePath, 'utf-8');
    assert(/\[.dev_force_dice.,/.test(src), 'колонка dev_force_dice в списке миграции');
    assert(/\[.dev_force_poker.,/.test(src), 'колонка dev_force_poker в списке миграции');
    assert(/\[.dev_force_blackjack.,/.test(src), 'колонка dev_force_blackjack в списке миграции');
    assert(/\[.dev_force_roulette.,/.test(src), 'колонка dev_force_roulette в списке миграции');
    assert(/if\(!isset\(\$_GET\['key'\]\) \|\| \$_GET\['key'\] !== 'stalker_migrate33_2026'\)/.test(src),
        'миграция защищена секретным ключом (тот же паттерн, что migrate26-32)');
    assert(/SHOW COLUMNS FROM `\{\$registry\['utb'\]\}` LIKE '\$col'/.test(src),
        'миграция идемпотентна — пропускает уже существующие колонки (SKIP), не падает при повторном запуске');
}

console.log('\nTest 2: server.js — req_key НЕ затирается в undefined на ответе без req_key (500/битый JSON)');
{
    const assignMatches = serverSrc.match(/this\.req_key = this\.json\['req_key'\];/g) || [];
    assert(assignMatches.length === 1, 'ровно одно место в файле присваивает req_key из ответа сервера');
    assert(/if\(this\.json\['req_key'\]\) this\.req_key = this\.json\['req_key'\];/.test(serverSrc),
        'единственное присваивание — под условием if(this.json[req_key]), не безусловное');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
