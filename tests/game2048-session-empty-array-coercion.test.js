/**
 * Test: 26.10.2026 — репорт "игра 2048 не работает" на тестовом сервере (первый живой деплой
 * фичи). Живой лог (uid=382448269, первый ход): лавина PHP-warning —
 * "Undefined array key 'moveSeq'/'board'/'score'", "Trying to access array offset on null" —
 * и в итоге move() молча "успевал" с искалеченным полем (board с ОДНОЙ плиткой вместо двух,
 * без type/attemptIndex/startedAt).
 *
 * Корень: Database::trueJSON() (server/core/models/database.php) молча подменяет ЛЮБОЕ NULL
 * JSON-подобное поле на [] (пустой массив), когда $this->sample ложный — а он ВСЕГДА ложный,
 * потому что core/samples/tables/ физически пустая папка (ни на сервере, ни локально нет ни
 * одного *_tbsample файла, см. database.js._sample/SampleLoader::load() — is_readable($file)
 * всегда false). game2048_session — TEXT NULL без DEFAULT (migrate52.php) — у ЛЮБОГО игрока,
 * который ещё не начинал партию, это физически [] вместо null. is_array([]) истинно, поэтому
 * старая проверка `is_array($session) ? $data : null` в Game2048::_loadSession() ПРОПУСКАЛА
 * этот артефакт как "реальная активная сессия" — start()/move() читали несуществующие
 * board/moveSeq/score как undefined. Это задевает КАЖДОГО нового игрока на первом же действии
 * в игре — отсюда "игра не работает" у всех, не только у этого аккаунта.
 *
 * Та же категория бага, что уже документирована в database.php для dev_force_* / nick / energy
 * (null == "0" / null == "" коэрсия) — просто для нового JSON-подобного server-only поля,
 * которое не попало в существующий $isStringField-список (и не должно — это не строковое
 * поле, фикс точечный, в самом game2048.php, не в общем database.php).
 *
 * Спавн "2" с вероятностью 90% (ТЗ п.2) при этом УЖЕ был реализован верно —
 * server/json/game2048_config.json spawn_weights:{"2":90,"4":10} + Game2048::_weightedSpawn()
 * (взвешенный rand), проблема была исключительно в том, что игра не доходила до реального
 * хода вообще.
 *
 * Часть 1 (этот файл) — regex-проверка фикса в исходнике. Часть 2 — РЕАЛЬНОЕ исполнение
 * Game2048::_loadSession() через tests/_php_fixtures/game2048-session-empty-array-coercion.php
 * (чистая логика без $link/$this->ops — без всякого мока, см. tests/_php_bin.js).
 *
 * Run: node tests/game2048-session-empty-array-coercion.test.js
 */
const fs   = require('fs');
const path = require('path');
const { findPhpBin } = require('./_php_bin.js');
const { execFileSync } = require('child_process');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const gamePhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'game2048.php'), 'utf-8');

console.log('\nTest 1: _loadSession() требует наличия ключа \'board\' — не доверяет одному is_array()');
{
    const start = gamePhp.indexOf('function _loadSession(');
    assert(start !== -1, '_loadSession() найден');
    const end = gamePhp.indexOf('\n        private function _loadDaily(', start);
    const body = gamePhp.slice(start, end);

    assert(/return \(is_array\(\$data\) && isset\(\$data\['board'\]\)\) \? \$data : null;/.test(body),
        'финальная проверка требует is_array($data) И isset($data[\'board\']) — не просто is_array($data)');
    assert(!/return is_array\(\$data\) \? \$data : null;/.test(body),
        'старая недостаточная проверка (без isset board) убрана');
}

console.log('\nTest 2 (реальное исполнение PHP): _loadSession() на всех граничных случаях (артефакт [], null, отсутствие ключа, настоящая сессия)');
{
    const phpBin = findPhpBin();
    if (!phpBin) {
        console.log('  ⚠️  PHP не найден локально — часть 2 (реальное исполнение) пропущена, см. tests/_php_bin.js. Часть 1 (regex) уже прогнана выше.');
    } else {
        const fixture = path.join(__dirname, '_php_fixtures', 'game2048-session-empty-array-coercion.php');
        const serverDir = path.join(root, 'server');
        let stdout;
        try {
            stdout = execFileSync(phpBin, ['-d', 'display_errors=stderr', fixture], { encoding: 'utf-8', timeout: 15000, cwd: serverDir });
        } catch (e) {
            console.error('  ❌ PHP-скрипт упал (фатальная ошибка):');
            console.error('  ', e.stderr || e.message);
            failed++;
            stdout = '';
        }
        if (stdout) {
            stdout.trim().split('\n').forEach(line => {
                if (line.startsWith('PASS:')) { console.log('  ✅', line.slice(6)); passed++; }
                else if (line.startsWith('FAIL:')) { console.error('  ❌ FAIL:', line.slice(6)); failed++; }
                else if (line.trim()) console.log('   ', line);
            });
        }
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
