/**
 * Test: батч 22.09.2026 (по прямому указанию, репорт "хата после покупки снова просит её
 * купить, хоть в ней и нахожусь") — причина: hata.js._buyHata()/_selectHata() были
 * fire-and-forget TS.php('users.save', {...}, null, null) БЕЗ callback на успех/ошибку,
 * локальный udata менялся оптимистично ДО подтверждения сервера. Если конкретно этот
 * users.save тихо не сохранялся, следующая свежая загрузка (users.get) откатывала владение.
 * Заодно закрывает дыру: списание сигарет раньше шло client-side (клиент теоретически мог
 * подделать base_bg_owned/cigarettes через консоль, тот же класс дыры, что уже закрывали для
 * оружия/шмоток).
 *
 * Фикс: новый server-authoritative контроллер server/core/controllers/hata.php (permits
 * buy/select) по стандартному паттерну Gameops — сервер сам проверяет разблокировку/баланс,
 * сам списывает сигареты, сам пишет владение; hata.js вызывает его с нормальными callback'ами
 * и applyPatch(), без оптимистичной локальной мутации до ответа сервера.
 *
 * Run: node tests/hata-server-authoritative.test.js
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

const hataPhp     = readSrc('server/core/controllers/hata.php');
const hataCfg     = JSON.parse(readSrc('server/json/hata_config.json'));
const registrySrc = readSrc('server/core/models/registry.php');
const hataJs      = readSrc('_client/src/game/shell/overlays/hata.js');

console.log('\nTest 1: registry.php — контроллер hata зарегистрирован в classes');
{
    assert(/'classes'=>array\([^)]*'hata'[^)]*\)/.test(registrySrc.replace(/\n/g, '')),
        "'hata' добавлен в registry.php classes (иначе universal.php отклонит метод как невалидный класс)");
}

console.log('\nTest 2: hata_config.json — каталог локаций совпадает с клиентским HATAS (id/cost/bossReq)');
{
    const start = hataJs.indexOf('const HATAS = [');
    const end   = hataJs.indexOf('];', start);
    const hatasBody = hataJs.slice(start, end);
    const clientLocs = [...hatasBody.matchAll(/\{ id:(\d+), name:'([^']+)',\s+img:'[^']+',\s+bossReq:(-?\d+),\s+cost:(\d+)\s*\}/g)]
        .map(m => ({ id: parseInt(m[1]), name: m[2], bossReq: parseInt(m[3]), cost: parseInt(m[4]) }));
    assert(clientLocs.length === 8, 'на клиенте найдено 8 локаций хаты для сверки');
    assert(hataCfg.locations.length === 8, 'серверный каталог тоже содержит 8 локаций');
    clientLocs.forEach(cl => {
        const sl = hataCfg.locations.find(l => l.id === cl.id);
        assert(!!sl, 'id:' + cl.id + ' присутствует в серверном каталоге');
        assert(sl && sl.bossReq === cl.bossReq && sl.cost === cl.cost,
            'id:' + cl.id + ' (' + cl.name + ') — серверные bossReq/cost совпадают с клиентскими (' + cl.bossReq + '/' + cl.cost + ')');
    });
}

console.log('\nTest 3: hata.php — permits buy/select, проверка разблокировки по боссу');
{
    assert(/\$this->permits = \['buy', 'select'\];/.test(hataPhp), "permits содержит 'buy' и 'select'");
    const isUnlockedStart = hataPhp.indexOf('private function _isUnlocked(');
    const isUnlockedEnd   = hataPhp.indexOf('\n        }', isUnlockedStart);
    const body = hataPhp.slice(isUnlockedStart, isUnlockedEnd);
    assert(/if\(\$bossReq < 0\) return true;/.test(body), 'локация без требования (Кубрик, bossReq:-1) всегда разблокирована');
    assert(/if\(\$this->ops->i\(\$user, 'hata_progress', -1\) >= \$bossReq\) return true;/.test(body),
        'основная проверка — hata_progress (максимальный побеждённый босс), та же логика, что была на клиенте');
    assert(/return \$this->ops->i\(\$user, 'boss_kills_' \. \$bossReq, 0\) > 0;/.test(body),
        'страховка через boss_kills_N для старых сохранений без hata_progress — зеркалит старую клиентскую логику');
}

console.log('\nTest 4: hata.php.buy() — проверяет разблокировку/баланс/владение, списывает сигареты, пишет владение атомарно на сервере');
{
    const start = hataPhp.indexOf('function buy(){');
    const end   = hataPhp.indexOf('\n        }', hataPhp.indexOf('$this->ops->ok(', start));
    const body  = hataPhp.slice(start, end);

    assert(/if\(!\$this->_isUnlocked\(\$user, \$loc\)\) return \$this->ops->fail\(94\);/.test(body), 'нужный босс ещё не побеждён → код 94');
    assert(/if\(in_array\(\$locId, \$owned\)\) return \$this->ops->fail\(52\);/.test(body), 'уже куплено → код 52 (тот же код, что shmot.php использует для повторной покупки)');
    assert(/if\(\$cost > 0 && !\$this->ops->deduct\(\$user, 'cigarettes', \$cost\)\) return \$this->ops->fail\(50\);/.test(body),
        'не хватает сигарет → код 50, списание через Gameops::deduct (с проверкой баланса)');
    assert(/\$owned\[\] = \$locId;/.test(body) && /\$user\['base_bg_owned'\]\s*= json_encode\(\$owned\);/.test(body),
        'владение добавляется и сохраняется в base_bg_owned');
    assert(/\$user\['base_bg_active'\] = strval\(\$locId\);/.test(body), 'купленная локация сразу становится активной (та же логика, что была на клиенте)');
}

console.log('\nTest 5: hata.php.select() — требует владения (кроме Кубрика id0), бесплатный "переезд"');
{
    const start = hataPhp.indexOf('function select(){');
    const end   = hataPhp.indexOf('\n        }', hataPhp.indexOf('$this->ops->ok(', start));
    const body  = hataPhp.slice(start, end);
    assert(/if\(\$locId !== 0 && !in_array\(\$locId, \$owned\)\) return \$this->ops->fail\(53\);/.test(body),
        'нельзя выбрать некупленную локацию → код 53, КРОМЕ Кубрика (id0 — см. Test 8, отдельный regression-тест на этот баг)');
    assert(!/deduct/.test(body), 'select() не списывает валюту — переезд между уже купленными локациями бесплатный');
    assert(/\$user\['base_bg_active'\] = strval\(\$locId\);/.test(body), 'меняет активную локацию');
}

console.log('\nTest 8: hata.php.select() — регресс-фикс 25.09.2026: Кубрик (id0) всегда выбираем, даже если его физически нет в base_bg_owned');
{
    // Баг: клиент (hata.js._render(), см. `h.id === 0 || isOwned`) ВСЕГДА показывает кнопку
    // ВЫБРАТЬ для Кубрика независимо от base_bg_owned — но старый select() требовал locId
    // ФИЗИЧЕСКИ внутри массива. У аккаунтов, чей base_bg_owned сохранился без явного 0 (до
    // 22.09.2026 миграции хаты на сервер), выбор Кубрика падал кодом 53 ("локация не куплена")
    // — репорт с живым логом ошибки.
    const start = hataPhp.indexOf('function select(){');
    const end   = hataPhp.indexOf('\n        }', hataPhp.indexOf('$this->ops->ok(', start));
    const body  = hataPhp.slice(start, end);
    assert(/\$locId !== 0/.test(body), 'КРИТИЧНО: locId===0 (Кубрик) обходит проверку владения');
    // sanity: остальные локации (id>0) по-прежнему требуют реального владения — фикс не открыл
    // дыру для платных локаций.
    assert(/!in_array\(\$locId, \$owned\)/.test(body), 'проверка владения для остальных id (>0) осталась');
}

console.log('\nTest 6: hata.js — покупка/выбор идут через server-authoritative permit, БЕЗ fire-and-forget users.save(null,null)');
{
    assert(!/TS\.php\('users\.save', \{udata_json: JSON\.stringify\(udata\)\}, null, null\);/.test(hataJs),
        'старый fire-and-forget users.save(...,null,null) убран из hata.js целиком (был источником бага)');

    const buyStart = hataJs.indexOf('_buyHata(){');
    const buyEnd   = hataJs.indexOf('\n    }', hataJs.indexOf("}, (err) => {", buyStart));
    const buyBody  = hataJs.slice(buyStart, buyEnd);
    assert(/TS\.php\('hata\.buy', \{loc_id: h\.id\}, \(res\) => \{/.test(buyBody), '_buyHata() вызывает hata.buy с нормальным success-callback');
    assert(/applyPatch\(res\.patch\);/.test(buyBody), 'применяет patch ТОЛЬКО после реального подтверждения сервера — не мутирует udata оптимистично заранее');
    assert(/err && err\.code === 50/.test(buyBody), 'обрабатывает код 50 (не хватает сигарет) адресным сообщением');

    const selStart = hataJs.indexOf('_selectHata(){');
    const selEnd   = hataJs.indexOf('\n    }', hataJs.indexOf("}, (err) => {", selStart));
    const selBody  = hataJs.slice(selStart, selEnd);
    assert(/TS\.php\('hata\.select', \{loc_id: h\.id\}, \(res\) => \{/.test(selBody), '_selectHata() вызывает hata.select с нормальным success-callback');
    assert(/applyPatch\(res\.patch\);/.test(selBody), '_selectHata() тоже применяет patch только после подтверждения');
}

console.log('\nTest 7: hata.js — импортирует applyPatch (модуль patch.js), путь корректный относительно shell/overlays/');
{
    assert(/import \{ applyPatch \} from '\.\.\/\.\.\/\.\.\/modules\/patch\.js';/.test(hataJs),
        'путь импорта совпадает с соседним player_profile.js (та же глубина каталога shell/overlays/)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
