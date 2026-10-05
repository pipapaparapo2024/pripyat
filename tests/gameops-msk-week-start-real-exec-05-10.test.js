/**
 * Test: 05.10.2026, по репорту — "топ по урону не обновился хотя должен был (у всех должен был
 * сброситься на новую неделю)". Реальное исполнение Gameops::mskWeekStartTs() (server/core/
 * models/gameops.php) через локальный PHP — не grep по тексту файла.
 *
 * Корень: top.php._getWeeklyDamageTop() считал границу недели через сырой
 * strtotime('monday this week 00:00:00') — вычисляется в де-факто UTC-контексте PHP-процесса
 * (нигде не стоит date_default_timezone_set(), см. комментарий у mskDailyDate() в gameops.php).
 * Понедельник 00:00-02:59 МСК — это ещё ВОСКРЕСЕНЬЕ по UTC-календарю, поэтому в эти три часа
 * каждую неделю strtotime() трактовал "эту неделю" как прошлую — топ не разворачивался ровно
 * тогда, когда игрок ждал сброса по московской полуночи. После 03:00 МСК граница съезжает в
 * другую сторону — на 3ч ПОЗЖЕ реальной МСК-полуночи, незаметно теряя урон первых 3ч недели.
 *
 * Фикс: новая функция Gameops::mskWeekStartTs() — тот же +3ч-трюк (gmdate() на сдвинутой эпохе),
 * что уже применён к дневным лимитам (mskDailyDate()/mskNextResetMs()). top.php переключён на неё.
 *
 * Run: node tests/gameops-msk-week-start-real-exec-05-10.test.js
 */
const fs   = require('fs');
const path = require('path');
const { findPhpBin } = require('./_php_bin.js');
const { execFileSync } = require('child_process');

let passed = 0, failed = 0;

const phpBin = findPhpBin();
if (!phpBin) {
    console.log('⚠️  PHP не найден локально — тест реального исполнения PHP пропущен (это не провал, см. tests/_php_bin.js). Прогнать с PHP: положить портативный в ~/tools/php/php.exe, или задать PHP_BIN=путь.');
    process.exit(0);
}

const fixture = path.join(__dirname, '_php_fixtures', 'gameops-msk-week-start-core.php');

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

console.log(`\nTest: server/core/controllers/top.php — _getWeeklyDamageTop() реально использует mskWeekStartTs()`);
{
    const topPhp = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'top.php'), 'utf-8');
    const ok1 = /\$weekStartTs = \$this->ops->mskWeekStartTs\(\);/.test(topPhp);
    console.log('  ' + (ok1 ? '✅' : '❌ FAIL:'), 'weekStartTs считается через Gameops::mskWeekStartTs()');
    ok1 ? passed++ : failed++;
    // Ищем именно ИСПОЛНЯЕМЫЙ вызов (присвоение в $weekStartTs), не упоминание в комментарии —
    // докблок фикса намеренно цитирует старую формулу как объяснение "было/стало" (см. Rule #10
    // проекта — комментарии-истории инцидентов не трогаются), сам текст "strtotime('monday this
    // week" поэтому всё ещё встречается в файле, просто не как код.
    const ok2 = !/\$weekStartTs = strtotime\(/.test(topPhp);
    console.log('  ' + (ok2 ? '✅' : '❌ FAIL:'), 'сырой strtotime() больше не присваивается в $weekStartTs как исполняемый код (упоминание в комментарии-докблоке — не регрессия)');
    ok2 ? passed++ : failed++;
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed (реальное исполнение PHP ${phpBin})`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
