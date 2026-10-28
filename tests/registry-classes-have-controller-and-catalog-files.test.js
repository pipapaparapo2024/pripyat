/**
 * Test: 28.10.2026 — инцидент "Раздел временно недоступен" на проде для 2048/Разнарядки/Заначек.
 * Корень: registry.php на проде не содержал эти 3 класса в whitelist (отдельная причина,
 * уже была), а ПОСЛЕ починки whitelist вскрылась ВТОРАЯ, более глубокая причина — на проде
 * физически отсутствовали 5 server-side файлов (game2048.php, raznaryadkaprogress.php,
 * zanachkimodel.php, game2048_config.json, raznaryadka_config.json), хотя в git-репозитории
 * (и на тесте) они были — т.е. обычный "супер деплой" (который копирует только JS-бандл+
 * index.html) никогда не подхватывал server/*.php/*.json, апдейт этих файлов делался вручную
 * отдельными upload.sh-вызовами и было легко забыть один файл из пачки.
 *
 * Для деплой-синхронизации (git/тест/прод реально совпадают на живых серверах) теперь есть
 * tools/check_server_files_parity.sh — живой SSH-инструмент, его нельзя прогнать статическим
 * тестом (нет сети в CI/тестовом окружении). Этот файл — дополняющая, более узкая проверка:
 * статическая, работает без сети, ловит ДРУГОЙ (но смежный) класс бага — "класс добавлен в
 * whitelist registry.php, но файл контроллера/catalog-JSON не существует даже в самом
 * РЕПОЗИТОРИИ" (например опечатка в имени, забыли закоммитить файл, удалили файл но не убрали
 * из whitelist). Не заменяет парный живой инструмент, а идёт ПЕРЕД ним — дешёвая первая линия
 * защиты, которая гоняется при каждом прогоне tests/*.test.js, а не только вручную перед
 * супер деплоем.
 *
 * Run: node tests/registry-classes-have-controller-and-catalog-files.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

console.log('Test 1: каждый класс из registry.php \'classes\' whitelist имеет файл контроллера в server/core/controllers/');
{
    const registrySrc = read('server/core/models/registry.php');
    const m = registrySrc.match(/'classes'=>array\(([^)]*)\)/);
    assert(!!m, 'массив classes найден в registry.php (regex не сломался на реструктуризации файла)');
    const classes = m[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
    assert(classes.length >= 25, `разумное количество классов найдено (${classes.length}) — не пустой/обрезанный парсинг`);

    let missing = [];
    for (const cls of classes) {
        // Роутер маппит lowercase-имя класса напрямую на файл: core/controllers/<name>.php
        // (см. universal.php: $router->setPath('core/controllers'), ucfirst($input[0]) — класс
        // с большой буквы, но ИМЯ ФАЙЛА — как в самом whitelist, т.е. lowercase).
        const controllerPath = `server/core/controllers/${cls}.php`;
        if (!exists(controllerPath)) missing.push(controllerPath);
    }
    assert(missing.length === 0, missing.length === 0
        ? `все ${classes.length} классов из whitelist имеют файл контроллера`
        : `ОТСУТСТВУЮТ файлы контроллеров: ${missing.join(', ')}`);

    // Регресс-гвард конкретно на этот инцидент — если кто-то уберёт одну из трёх фич из
    // whitelist без явного решения, тест должен явно это показать, а не молча пройти.
    assert(classes.includes('raznaryadka') && classes.includes('game2048') && classes.includes('zanachki'),
        'raznaryadka/game2048/zanachki по-прежнему в whitelist (28.10.2026 инцидент)');
}

console.log('\nTest 2: каждый catalog(\'xxx\') вызов в контроллерах/моделях ссылается на существующий server/json/xxx.json');
{
    const dirs = ['server/core/controllers', 'server/core/models'];
    const catalogCalls = []; // {file, name}
    for (const dir of dirs) {
        for (const fn of fs.readdirSync(path.join(root, dir))) {
            if (!fn.endsWith('.php')) continue;
            const rel = `${dir}/${fn}`;
            const src = read(rel);
            const re = /catalog\('([a-z0-9_]+)'\)/g;
            let mm;
            while ((mm = re.exec(src))) catalogCalls.push({ file: rel, name: mm[1] });
        }
    }
    assert(catalogCalls.length >= 10, `найдено разумное число catalog() вызовов по всему server/ (${catalogCalls.length})`);

    let missing = [];
    for (const { file, name } of catalogCalls) {
        const jsonPath = `server/json/${name}.json`;
        if (!exists(jsonPath)) missing.push(`${jsonPath} (из ${file})`);
    }
    assert(missing.length === 0, missing.length === 0
        ? `все ${catalogCalls.length} catalog() вызовов ссылаются на существующие JSON-каталоги`
        : `ОТСУТСТВУЮТ JSON-каталоги: ${missing.join(', ')}`);

    // Регресс-гвард конкретно на этот инцидент.
    const names = catalogCalls.map(c => c.name);
    assert(names.includes('raznaryadka_config') && names.includes('game2048_config'),
        'raznaryadka_config/game2048_config по-прежнему запрашиваются через catalog() (28.10.2026 инцидент)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
