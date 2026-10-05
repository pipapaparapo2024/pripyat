/**
 * Test: батч 22.09.2026 (по прямому указанию, живой репорт — "покупаю шмотку за 40 тушёнки,
 * ошибка «недостаточно тушёнки», хотя у меня её в разы больше") — расследование напрямую в БД
 * прода показало: у игрока реально 7400 тушёнки (в разы больше 40), в php_errors.log никакого
 * исключения при этой покупке нет. Корень бага — НЕ в сервере: shmot.js._buy()'s error-колбэк
 * ВСЕГДА показывал "недостаточно [валюты]" для ЛЮБОЙ ошибки сервера (51 — предмет не в
 * каталоге, 52 — уже куплено, 54 — некорректный тип цены, 99 — не удалось сохранить), даже не
 * глядя на err.code. Реальная причина отказа (скорее всего 52 — уже куплено, экран не
 * обновился) пряталась за неверным сообщением.
 *
 * Заодно исправлены реальные неточности в описании сетов дроп-шмоток (id41+), сверенные с
 * присланным пользователем полным списком: "новопришедший" — это ДЕФОЛТНЫЙ (стартовый) сет, не
 * очередной "выпадает с босса" (бонусы были угаданы неверно — исправлены), id84 назывался
 * "Булава", правильно "Труба".
 *
 * Run: node tests/shmot-buy-error-code-branching-and-catalog-fixes.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const shmotJs  = readSrc('_client/src/game/shmot.js');
const shmotPhp = readSrc('server/core/controllers/shmot.php');

console.log('\nTest 1: shmot.js._buy() — error-колбэк ветвится по err.code, не всегда "недостаточно валюты"');
{
    const start = shmotJs.indexOf('TS.php(\'shmot.buy\'');
    const end   = shmotJs.indexOf('\n\t}', shmotJs.indexOf("}, (err) => {", start));
    const body  = shmotJs.slice(start, end);

    assert(/const code = err && err\.code;/.test(body), 'явно читает err.code из ответа сервера');
    assert(/if\(code === 50\)\{/.test(body), 'код 50 (реально недостаточно средств) — показывает сумму/баланс, как раньше');
    assert(/\} else if\(code === 52\)\{/.test(body), 'код 52 (уже куплено) — обрабатывается отдельной веткой, не путается с недостатком средств');
    assert(/item\.owned = true;/.test(body), 'при коде 52 клиент сам исправляет локально устаревший owned:false и перерисовывает экран');
    assert(/\} else if\(code === 51\)\{/.test(body), 'код 51 (предмет не в каталоге) — отдельное сообщение');
    assert(/\} else \{[\s\S]*?Не удалось купить/.test(body), 'любой другой код — общее сообщение об ошибке, не "недостаточно валюты"');
}

console.log('\nTest 2: shmot.php.buy() — каждая отказная ветка логирует причину (Правило №8)');
{
    const start = shmotPhp.indexOf('function buy(){');
    const end   = shmotPhp.indexOf('\n    }\n}', start);
    const body  = shmotPhp.slice(start, end);

    assert(/error_log\('\[shmot\.buy\] fail\(51\)/.test(body), 'fail(51) логирует uid/item_id');
    assert(/error_log\('\[shmot\.buy\] fail\(52\)/.test(body), 'fail(52) логирует uid/item_id');
    assert(/error_log\('\[shmot\.buy\] fail\(54\)/.test(body), 'fail(54) логирует uid/item_id/тип цены');
    assert(/error_log\('\[shmot\.buy\] fail\(50\)/.test(body), 'fail(50) логирует uid/item_id/валюту/стоимость/реальный баланс — именно то, чего не хватало в живом репорте');
    // 05.10.2026 (стале-пин, не регрессия — блокировка строки в shmot.php.buy(), баланс в
    // этом логе теперь читается с залоченной копии $lockedUser, не $user).
    assert(/have='\.\$this->ops->i\(\$lockedUser, \$cur\)/.test(body), 'fail(50) логирует РЕАЛЬНЫЙ баланс на сервере (не то, что думает клиент)');
}

console.log('\nTest 3: каталог id41+ — сверка с полным списком сетов пользователя');
{
    const item84 = shmotJs.match(/\{id:84,[^}]*\}/)[0];
    assert(/name:'Труба \(Тайник\)'/.test(item84), 'id84 переименован "Булава"→"Труба"');
    assert(/imgFile:'шмот булава сталкер тайник\.png'/.test(item84), 'файл картинки НЕ переименован (тот же физический файл) — только отображаемое имя');

    const item94 = shmotJs.match(/\{id:94,[^}]*\}/)[0];
    assert(/bonus:'\+20 к автомату'/.test(item94) && /bk:'auto_flat',\s*bv:20/.test(item94),
        'id94 (Кроссовки Новопришедший) — верный бонус +20 к автомату (было ошибочно +60)');

    const item95 = shmotJs.match(/\{id:95,[^}]*\}/)[0];
    assert(/bonus:'\+4 к мачете'/.test(item95) && /bk:'machete_flat',\s*bv:4/.test(item95),
        'id95 (Футболка Новопришедший) — верный бонус +4 к мачете, machete_flat (было ошибочно +60 к пистолету, gun_flat)');
}

console.log('\nTest 4: все прочие сеты из присланного списка уже совпадают 1-в-1 с каталогом (регресс-проверка, ничего не сломано попутно)');
{
    const CHECKS = [
        [41, "bonus:'\\+40 к автомату'", "fragments:20"],   // Панама Охотник ссср
        [50, "bonus:'\\+30 к пистолету'"],                   // Газета Крыс мастер
        [61, "bonus:'\\+200 к автомату'"],                   // Бита Соло Жгут выживший
        [88, "bonus:'\\+150 к автомату'"],                   // Шорты Тинейджер
    ];
    CHECKS.forEach(([id, ...patterns]) => {
        const m = shmotJs.match(new RegExp('\\{id:' + id + ',[^}]*\\}'));
        assert(!!m, 'id' + id + ' найден в каталоге');
        patterns.forEach(p => {
            assert(m && new RegExp(p).test(m[0]), 'id' + id + ' соответствует присланному списку (' + p + ')');
        });
    });
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
