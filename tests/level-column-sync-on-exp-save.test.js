/**
 * Test: 26.09.2026, по прямому живому репорту со скриншотом — "меня поздравляют с уровнем 22
 * уже 40 раз".
 *
 * Root cause: users.level в БД писался ТОЛЬКО дефолтом '1' при создании/сбросе аккаунта
 * (users.php._defaultResetUdata()) и больше никогда сервером не обновлялся — реальный уровень
 * считает только клиент (interface.js.updateNick(), формула из exp) и держит его ТОЛЬКО в
 * памяти (udata['level'] = String(level), без отправки на сервер). Любой полный рефреш строки
 * игрока с сервера (users.get — например modules/bank.js._refreshBalanceAfterPurchase() после
 * КАЖДОЙ покупки, но и другие пути) возвращал СТАРОЕ '1' из БД. updateNick() на следующий тик
 * снова видел level(22, из exp) > prevLevel(1, из "свежих" данных) и открывал попап повторно —
 * при частых рефрешах (несколько покупок/действий подряд) попап всплывал раз за разом.
 *
 * Фикс — сервер пересчитывает и сохраняет level из exp той же формулой, что и клиент, при
 * КАЖДОМ сохранении, где присутствует exp. Два независимых места записи (оба пишут в БД
 * напрямую, не связаны общим кодом):
 *   1) server/core/models/gameops.php.saveUser() — центральная точка почти всех
 *      server-authoritative записей (dvor.php/roulette.php/bosses.php/habar.php/...).
 *   2) server/core/controllers/users.php.save() — обычный клиентский автосейв (whitelist
 *      $allowed), пишет через $registry['udb'] напрямую, В ОБХОД Gameops::saveUser().
 *
 * Run: node tests/level-column-sync-on-exp-save.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf-8');

const gameopsPhp = read('server/core/models/gameops.php');
const usersPhp   = read('server/core/controllers/users.php');
const interfaceJs = read('_client/src/game/interface.js');

const LEVEL_FORMULA = /max\(0, \(int\)floor\(\(-1 \+ sqrt\(1 \+ \$exp \/ 5\)\) \/ 2\)\)/;

console.log('\nTest 1: interface.js — клиентская формула уровня из exp (эталон, с которым сверяем сервер)');
{
    assert(/Math\.max\(0, Math\.floor\(\(-1 \+ Math\.sqrt\(1 \+ exp \/ 5\)\) \/ 2\)\)/.test(interfaceJs),
        'клиентская формула присутствует и не менялась (level = max(0, floor((-1+sqrt(1+exp/5))/2)))');
}

console.log('\nTest 2: gameops.php.saveUser() пересчитывает и пишет level, если exp присутствует в $update');
{
    const start = gameopsPhp.indexOf('function saveUser(');
    assert(start !== -1, 'saveUser() найдена');
    const end = gameopsPhp.indexOf('\n    }', start);
    const body = gameopsPhp.slice(start, end);
    assert(/if\(isset\(\$update\['exp'\]\)\)\{/.test(body), 'проверяет наличие exp в $update перед пересчётом');
    assert(LEVEL_FORMULA.test(body), 'формула level идентична клиентской (server-authoritative зеркало Test 1)');
    assert(/\$update\['level'\] = \(string\)\$level;/.test(body), 'записывает level в $update тем же вызовом (партиция UPDATE подхватит новое поле)');
    // Порядок важен: level должен посчитаться ДО реального saveData(), иначе не попадёт в SQL.
    const expIdx = body.indexOf("isset(\$update['exp'])");
    const saveIdx = body.indexOf('saveData(');
    assert(expIdx > -1 && saveIdx > -1 && expIdx < saveIdx, 'пересчёт level происходит РАНЬШЕ вызова saveData()');
}

console.log('\nTest 3: users.php.save() — тот же пересчёт, отдельно (пишет в БД напрямую, минуя Gameops::saveUser())');
{
    const start = usersPhp.indexOf('function save(){');
    assert(start !== -1, 'save() найдена');
    const end = usersPhp.indexOf('\n        }', usersPhp.indexOf("error(99)", start));
    const body = usersPhp.slice(start, end);
    assert(/if\(isset\(\$update\['exp'\]\)\)\{/.test(body), 'проверяет наличие exp в $update перед пересчётом');
    assert(LEVEL_FORMULA.test(body), 'формула level идентична клиентской и gameops.php (единообразие)');
    assert(/\$update\['level'\] = \(string\)\$level;/.test(body), 'записывает level в $update тем же вызовом');
    const expIdx = body.indexOf("isset(\$update['exp'])");
    const saveIdx = body.indexOf("saveData(");
    assert(expIdx > -1 && saveIdx > -1 && expIdx < saveIdx, 'пересчёт level происходит РАНЬШЕ вызова saveData()');
}

console.log('\nTest 4: обе формулы (gameops.php и users.php) буквально идентичны друг другу и клиенту — не разошлись при копировании');
{
    const gStart = gameopsPhp.indexOf('function saveUser(');
    const gBody  = gameopsPhp.slice(gStart, gameopsPhp.indexOf('\n    }', gStart));
    const uStart = usersPhp.indexOf('function save(){');
    const uBody  = usersPhp.slice(uStart, usersPhp.indexOf('\n        }', usersPhp.indexOf('error(99)', uStart)));
    const gFormula = (gBody.match(LEVEL_FORMULA) || [])[0];
    const uFormula = (uBody.match(LEVEL_FORMULA) || [])[0];
    assert(!!gFormula && !!uFormula && gFormula === uFormula, 'PHP-формула буквально одинакова в обоих местах записи');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
