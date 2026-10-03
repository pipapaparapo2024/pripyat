/**
 * Test: 25.09.2026, dev-панель — кнопка "100%" на каждую комбинацию зариков (по прямому
 * указанию — "хочу тестировать все азартные игры").
 *
 * dice.php.start() получает новый одноразовый server-only флаг dev_force_dice (личный,
 * пишется через users.setDevCombo, НЕ в whitelist) — хранит ИНДЕКС строки в
 * dice_config.json.table (0-17). Если флаг непустой: строит rolls вручную (n костей = v,
 * остальные — гарантированно РАЗНЫЕ filler-значения, чтобы не задеть другую строку таблицы
 * случайным совпадением), гасит флаг сразу, обычный pity-бросок пропускается.
 *
 * ВАЖНАЯ ЛОВУШКА (пойманная и исправленная в этом же батче): intval('') === 0 совпадает с
 * валидным индексом 0 — поэтому флаг обязан читаться через strval()+проверку на пустую
 * строку, а НЕ через Gameops::i() (которая вернула бы 0 по умолчанию для абсолютно всех
 * игроков на каждом броске).
 *
 * Run: node tests/dev-force-dice-combo.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const diceSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'dice.php'), 'utf-8');
const catalog  = JSON.parse(fs.readFileSync(path.join(root, 'server', 'json', 'dice_config.json'), 'utf-8'));

console.log('\nTest 1: dev_force_dice читается через strval()+проверку пустой строки, НЕ через Gameops::i()');
{
    const start = diceSrc.indexOf('function start(){');
    assert(start !== -1, 'start() найден');
    const end = diceSrc.indexOf('function resolve(', start);
    const body = diceSrc.slice(start, end !== -1 ? end : start + 6000);

    assert(/\$devForceDiceRaw = isset\(\$user\['dev_force_dice'\]\) \? strval\(\$user\['dev_force_dice'\]\) : '';/.test(body),
        'флаг читается явным strval(), не через Gameops::i()');
    assert(!/Gameops::i\([^)]*'dev_force_dice'/.test(body) && !/->i\(\$user, ['"]dev_force_dice['"]/.test(body),
        'нигде не читается через ->i() — та самая ловушка (intval(\'\')===0)');
    assert(/if\(\$devForceDiceRaw !== ''\)\{/.test(body), 'проверка именно на непустую строку (не truthy-check самого intval)');
}

console.log('\nTest 2: индекс валиден только если существует в catalog.table, форс гасится сразу');
{
    const start = diceSrc.indexOf('function start(){');
    const body  = diceSrc.slice(start, start + 6000);

    assert(/if\(isset\(\$catalog\['table'\]\[\$devForceIdx\]\)\) \$devForceRow = \$catalog\['table'\]\[\$devForceIdx\];/.test(body),
        'индекс проверяется через isset() на catalog[table][idx] — несуществующий индекс не форсит мусор');
    assert(/\$user\['dev_force_dice'\] = '';/.test(body), 'флаг гасится сразу при срабатывании форса');
}

console.log('\nTest 3: rolls строятся вручную из v/n, filler-кости гарантированно РАЗНЫЕ от v (не задевают другую строку)');
{
    // 02.10.2026 (найдено при разборе полного прогона tests/): конечная граница ветки раньше
    // искала '} else if($forced){' — ветка "форсированный pity-джекпот" в start(). Полная
    // pity/jackpot-гарантия 4×6 с тех пор убрана из dice.php целиком (см. dice-server-
    // authoritative-rng.test.js — требует отдельного решения пользователя, не трогаю тут), и
    // $devForceRow теперь просто двухветочный if/else с обычным взвешенным броском — границу
    // переписал под актуальную структуру, смысл проверки (что именно в ветке DEV FORCE) не изменился.
    const start = diceSrc.indexOf('if($devForceRow){');
    const end   = diceSrc.indexOf('} else {', start);
    assert(start !== -1 && end !== -1, 'ветка DEV FORCE найдена');
    const body = diceSrc.slice(start, end);

    assert(/\$v = intval\(\$devForceRow\['v'\]\); \$n = intval\(\$devForceRow\['n'\]\);/.test(body), 'v/n читаются из строки таблицы');
    assert(/array_diff\(\[1,2,3,4,5,6\], \[\$v\]\)/.test(body), 'filler-пул строится через array_diff — исключает само значение v');
    assert(/\$rolls = array_fill\(0, \$n, \$v\);/.test(body), 'ровно n костей выставлены в v');
    assert(/for\(\$f = 0; \$f < 4 - \$n; \$f\+\+\) \$rolls\[\] = \$fillerPool\[\$f % count\(\$fillerPool\)\];/.test(body),
        'оставшиеся 4-n костей заполняются из filler-пула (без v)');
}

console.log('\nTest 4: catalog.table по-прежнему 18 строк, индексация 0-17 (регресс-гвард на порядок с клиентским DICE_COMBOS)');
{
    assert(Array.isArray(catalog.table) && catalog.table.length === 18, 'dice_config.json.table содержит 18 строк');
    catalog.table.forEach((row, i) => {
        assert(typeof row.v === 'number' && typeof row.n === 'number', `строка idx=${i} имеет числовые v/n`);
    });
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
