/**
 * Test: 26.10.2026 — репорт по скриншоту ("ДЕЛА СТАЛКЕР, ВЫПОЛНЕНО ЗАДАНИЙ 0/31" с красными
 * крестиками на днях 1-25): фича "Ежедневные задания" реально стартует только 1 ноября 2026
 * (config['launch_month'] = "2026-11"), но игрок, открывший экран ДО старта, видел дни 1-25
 * помеченными как 'failed' (красный крестик "провалено") — выглядит так, будто игроки не
 * выполнили задания, которых у них ещё физически не было.
 *
 * Корень: Raznaryadka::getState() считал день 'failed', если он просто МЕНЬШЕ "сегодня"
 * (effectiveDay()), не проверяя, относятся ли вообще данные игрока к уже ЗАПУЩЕННОМУ месяцу
 * (raznaryadka_data.month >= launch_month). Для игрока, открывшего экран в октябре (ДО
 * старта), raznaryadka_data.month = "2026-10" — все дни до today считались провалом, хотя
 * сама фича ещё не была "живой".
 *
 * Фикс: день может стать 'failed' только если данные игрока относятся к уже запущенному месяцу
 * (month >= launch_month) — тот же гейт добавлен в payDay() (анти-чит: нельзя "откупить" день,
 * которого по факту не было, до реального старта фичи).
 *
 * Run: node tests/raznaryadka-pre-launch-no-failed-days.test.js
 */
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { findPhpBin } = require('./_php_bin.js');
const { execFileSync } = require('child_process');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const raznPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'raznaryadka.php'), 'utf-8');

console.log('\nTest 1: getState() — день становится \'failed\' только если месяц игрока >= launch_month');
{
    const start = raznPhp.indexOf('function getState(){');
    assert(start !== -1, 'getState() найден');
    const end = raznPhp.indexOf('\n        function ', start + 10);
    const body = raznPhp.slice(start, end);

    assert(/\$launchMonth = \$config\['launch_month'\] \?\? null;/.test(body), 'launch_month читается из конфига');
    assert(/\$featureLive = !\$launchMonth \|\| \$data\['month'\] >= \$launchMonth;/.test(body),
        'featureLive = нет launch_month в конфиге ИЛИ месяц игрока >= launch_month');
    assert(/\$failedCutoffDay = \$featureLive \? \$today : 1;/.test(body),
        'до старта фичи cutoff=1 (ни один день не "раньше сегодня" — значит ни один не failed)');
    assert(/\$visualStatus = \$st === 'done' \? 'done' : \(\$d < \$failedCutoffDay \? 'failed' : 'pending'\);/.test(body),
        'статус дня считается через failedCutoffDay, не напрямую через today');
    assert(/\$failedDesc = \$this->_failedDaysDesc\(\$data, \$failedCutoffDay\);/.test(body),
        '_failedDaysDesc() тоже получает failedCutoffDay (иначе pay_costs предлагал бы купить дни, которых не было)');
}

console.log('\nTest 2: payDay() — тоже отклоняет откуп дня, если фича ещё не стартовала для месяца игрока (анти-чит, не только визуал)');
{
    const start = raznPhp.indexOf('function payDay(){');
    assert(start !== -1, 'payDay() найден');
    const end = raznPhp.indexOf('\n        function ', start + 10);
    const body = raznPhp.slice(start, end);

    assert(/\$launchMonth = \$config\['launch_month'\] \?\? null;/.test(body), 'payDay(): launch_month читается из конфига');
    assert(/\$featureLive = !\$launchMonth \|\| \$data\['month'\] >= \$launchMonth;/.test(body), 'payDay(): featureLive вычисляется тем же способом');
    assert(/if\(!\$featureLive\) return \$this->ops->fail\(55\);/.test(body),
        'payDay(): фича не стартовала → fail(55), откуп отклонён на сервере (не только клиент скрывает кнопку)');
}

console.log('\nTest 3 (реальное исполнение PHP): формула "день failed только если месяц >= launch_month" на реальных данных конфига');
{
    const phpBin = findPhpBin();
    if (!phpBin) {
        console.log('  ⚠️  PHP не найден локально — часть 3 пропущена, см. tests/_php_bin.js.');
    } else {
        const phpLines = [
            "require_once 'core/models/jsonloader.php';",
            "$loader = new Jsonloader();",
            "$config = $loader->get('raznaryadka_config', true);",
            "$launchMonth = $config['launch_month'] ?? null;",
            'if ($launchMonth !== \'2026-11\') { echo "FAIL: launch_month ожидался 2026-11, получили " . var_export($launchMonth, true) . "\\n"; exit; }',
            'echo "PASS: launch_month в конфиге = 2026-11\\n";',
            "",
            "$dataMonth = '2026-10';",
            "$featureLive = !$launchMonth || $dataMonth >= $launchMonth;",
            'echo ($featureLive === false ? "PASS" : "FAIL") . ": октябрьский игрок (месяц 2026-10 < launch_month) featureLive=false\\n";',
            "",
            "$dataMonth2 = '2026-11';",
            "$featureLive2 = !$launchMonth || $dataMonth2 >= $launchMonth;",
            'echo ($featureLive2 === true ? "PASS" : "FAIL") . ": ноябрьский игрок (месяц 2026-11 >= launch_month) featureLive=true\\n";',
        ];
        const code = phpLines.join('\n');
        const fixture = path.join(os.tmpdir(), 'raznaryadka-prelaunch-test-' + process.pid + '.php');
        fs.writeFileSync(fixture, '<?php\n' + code + '\n', 'utf-8');
        try {
            const stdout = execFileSync(phpBin, ['-d', 'display_errors=stderr', fixture], { encoding: 'utf-8', timeout: 15000, cwd: path.join(root, 'server') });
            stdout.trim().split('\n').forEach(line => {
                if (line.startsWith('PASS:')) { console.log('  ✅', line.slice(6)); passed++; }
                else if (line.startsWith('FAIL:')) { console.error('  ❌ FAIL:', line.slice(6)); failed++; }
                else if (line.trim()) console.log('   ', line);
            });
        } catch (e) {
            console.error('  ❌ PHP-скрипт упал:', e.stderr || e.message);
            failed++;
        } finally {
            try { fs.unlinkSync(fixture); } catch(_){}
        }
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
