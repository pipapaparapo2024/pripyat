/**
 * Test: 06.10.2026, по репорту — "топ по урону в сводке не обновляется, должен сбрасываться
 * каждую неделю, сейчас почему-то не сбросился".
 *
 * Корень (найден реальным чтением кода, не повторением старого бага): top.php._getWeeklyDamageTop()
 * считал границу недели через Gameops::mskWeekStartTs() — функция возвращает СЕКУНДЫ (как
 * time()/strtotime(), тот же формат, что у mskDailyDate()). Но `boss_damage_log`.`time` хранится
 * в МИЛЛИСЕКУНДАХ — bosses.php.attack() перед INSERT'ом пишет
 * `$now = intval(round(microtime(true) * 1000))`. SQL сравнивал `` `time` >= {$weekStartTs} ``
 * (мс-колонку с секундным порогом) — порог оказывался в 1000 раз меньше любого реального
 * мс-штампа, поэтому фильтр пропускал АБСОЛЮТНО ВСЁ, включая удары годовой давности: топ
 * фактически был lifetime-рейтингом и физически не мог "сброситься" на новой неделе, т.к. никогда
 * никого не исключал.
 *
 * Это ОТДЕЛЬНЫЙ баг от МСК-таймзонного фикса 05.10.2026 (см.
 * tests/gameops-msk-week-start-real-exec-05-10.test.js) — тот чинил 3-часовой edge case у самой
 * границы понедельника, этот — единицы измерения, которые были в 1000 раз не на том порядке
 * ПОСТОЯННО, а не только у границы. Существовавшие тесты (top-weekly-damage-vs-lifetime-authority,
 * gameops-msk-week-start-real-exec-05-10) проверяли только то, что $weekStartTs ВЫЧИСЛЯЕТСЯ через
 * mskWeekStartTs() и что переменная УПОМИНАЕТСЯ в SQL — regex по тексту, без реальной фильтрации
 * строк с реалистичными мс-значениями, поэтому не поймали рассогласование единиц измерения.
 *
 * Фикс: `$weekStartMs = $weekStartTs * 1000;` — все 3 SQL-запроса (leaderboard/my_value/my_place)
 * переведены на `` `time` >= {$weekStartMs} ``.
 *
 * Этот тест — РЕАЛЬНОЕ исполнение (не grep): берёт буквальное выражение из top.php через eval() и
 * прогоняет через него синтетические мс-штампы (эта неделя / прошлая неделя / год назад), а не
 * переизобретает формулу в JS — так будущая регрессия (например, кто-то снова забудет про *1000)
 * обязательно провалит тест, а не только сегодняшний баг.
 *
 * Run: node tests/top-weekly-damage-ms-vs-seconds-unit-mismatch-06-10.test.js
 */
const path = require('path');
const { findPhpBin } = require('./_php_bin.js');
const { execFileSync } = require('child_process');

let passed = 0, failed = 0;

const phpBin = findPhpBin();
if (!phpBin) {
    console.log('⚠️  PHP не найден локально — тест реального исполнения PHP пропущен (это не провал, см. tests/_php_bin.js). Прогнать с PHP: положить портативный в ~/tools/php/php.exe, или задать PHP_BIN=путь.');
    process.exit(0);
}

const fixture = path.join(__dirname, '_php_fixtures', 'top-weekly-damage-ms-unit-core.php');

let stdout;
try {
    stdout = execFileSync(phpBin, ['-d', 'display_errors=stderr', fixture], { encoding: 'utf-8', timeout: 15000 });
} catch (e) {
    console.error('❌ PHP-скрипт упал (фатальная ошибка):');
    console.error(e.stderr || e.message);
    process.exit(1);
}

stdout.trim().split('\n').forEach(line => {
    if (line.startsWith('PASS:')) { console.log('  ✅', line.slice(6)); passed++; }
    else if (line.startsWith('FAIL:')) { console.error('  ❌ FAIL:', line.slice(6)); failed++; }
    else if (line.startsWith('===')) console.log('\n' + line.replace(/=== | ===/g, ''));
    else if (line.trim()) console.log('  ', line);
});

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed (реальное исполнение PHP ${phpBin})`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
