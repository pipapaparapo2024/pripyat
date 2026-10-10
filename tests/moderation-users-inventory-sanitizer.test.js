/**
 * Test: 26.09.2026 (аудит перед модерацией VK, пункт "серверная проверка — нельзя изменить
 * запрос клиента и получить бесплатно валюту/предмет") — 'inventory' (рюкзак Василича,
 * udata['inventory']) было в client-writable whitelist users.save БЕЗ вообще какой-либо
 * проверки содержимого (в отличие от 'weapons', уже защищённого _sanitizeWeapons()).
 *
 * Единственная клиентская ветка, трогающая inventory (vassilich.js._renderBackpack()), только
 * УДАЛЯЕТ использованный предмет (inv.splice()) и пересохраняет остаток — ни одна ветка не
 * добавляет в него новые предметы (лут-система рюкзака не реализована). Значит легитимное
 * изменение этого поля — ТОЛЬКО сужение уже сохранённого набора. Раньше читер мог одним
 * users.save({inventory: JSON.stringify([{effect:{coins:99999999}}])}) вписать себе
 * произвольный предмет с любым effect и тут же "использовать" его тем же UI, полностью в обход
 * цен/лут-таблиц Василича.
 *
 * Фикс: _sanitizeInventory() — разрешает incoming ТОЛЬКО как под-мультимножество current
 * (каждый элемент incoming должен буквально присутствовать в current, ровно один раз на
 * совпадение) — то есть только удаление, никогда добавление/подмену.
 *
 * Run: node tests/moderation-users-inventory-sanitizer.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const usersPhp = read('server/core/controllers/users.php');

console.log('\nTest 1: jsonBlobGuards содержит sanitizer для inventory (не только weapons)');
{
    // 09.10.2026: третья запись ('bosses_data' => '_sanitizeBossesData') добавлена позже тем же
    // приёмом — см. tests/users-php-real-exec-sanitize-bosses-data-currency-guard.test.js.
    assert(/\$jsonBlobGuards\s*=\s*\['weapons' => '_sanitizeWeapons', 'inventory' => '_sanitizeInventory', 'bosses_data' => '_sanitizeBossesData'\];/.test(usersPhp),
        "jsonBlobGuards включает 'weapons', 'inventory' и 'bosses_data'");
    assert(/function _sanitizeInventory\(\$currentRaw, \$incomingRaw\)\{/.test(usersPhp), '_sanitizeInventory() определена');
}

console.log('\nTest 2: SELECT текущего значения расширен на inventory (иначе sanitizer сравнивал бы с null и всегда отклонял/пропускал неверно)');
{
    const start = usersPhp.indexOf("if(isset($incoming['weapons']) || isset($incoming['inventory'])");
    assert(start !== -1, "условие подгрузки \$current включает isset(\$incoming['inventory'])");
    const block = usersPhp.slice(start, usersPhp.indexOf(');', start) + 2);
    assert(/'inventory'/.test(block), "SELECT-список полей включает 'inventory'");
}

console.log('\nTest 3: _sanitizeInventory() — логика реализации (сужение мультимножества, не просто diff по значению)');
{
    const start = usersPhp.indexOf('function _sanitizeInventory(');
    const end   = usersPhp.indexOf('\n        }', usersPhp.indexOf('return $incoming;', start));
    const body  = usersPhp.slice(start, end);

    assert(/if\(!is_array\(\$incoming\)\) return null;/.test(body), 'некорректный (не-массив) incoming отклоняется целиком');
    assert(/if\(!is_array\(\$item\)\) return null;/.test(body), 'элемент incoming, не являющийся массивом/объектом, отклоняет весь блоб');
    assert(/\$pool = array_map\('json_encode', \$current\);/.test(body), 'строится пул строковых представлений ТЕКУЩИХ предметов (для точного сравнения по значению)');
    assert(/\$key = array_search\(json_encode\(\$item\), \$pool, true\);/.test(body), 'каждый incoming-элемент ищется в пуле по строгому совпадению');
    assert(/if\(\$key === false\) return null;/.test(body), 'элемент, которого нет в current, — отклоняет весь блоб (не просто пропускается)');
    assert(/unset\(\$pool\[\$key\]\);/.test(body), 'найденное совпадение потребляется из пула — защита от дублирования одного и того же предмета сверх его реального количества в current');
}

console.log('\nTest 4: поведенческая симуляция логики sanitizer\'а (JS-эквивалент PHP-функции — нет PHP-интерпретатора в окружении)');
{
    function sanitizeInventory(current, incoming){
        if(!Array.isArray(incoming)) return null;
        const pool = current.map(x => JSON.stringify(x));
        for(const item of incoming){
            if(typeof item !== 'object' || item === null) return null;
            const key = pool.indexOf(JSON.stringify(item));
            if(key === -1) return null;
            pool.splice(key, 1);
        }
        return incoming;
    }

    const current = [{name:'Аптечка', effect:{energy:30}}, {name:'Тушенка', effect:{stew:10}}];

    // Легитимно: удалили один предмет (использовали Аптечку) — остался только один
    const afterUse = [{name:'Тушенка', effect:{stew:10}}];
    assert(sanitizeInventory(current, afterUse) !== null, 'легитимное удаление одного предмета — разрешено');

    // Читерство: подставили предмет, которого не было в current
    const forged = [{name:'Аптечка', effect:{energy:30}}, {name:'Тушенка', effect:{stew:10}}, {name:'Читерская пачка денег', effect:{coins:99999999}}];
    assert(sanitizeInventory(current, forged) === null, 'добавление НОВОГО предмета (рост набора) — отклонено');

    // Читерство: задублировали существующий предмет сверх его реального количества
    const duplicated = [{name:'Аптечка', effect:{energy:30}}, {name:'Аптечка', effect:{energy:30}}];
    assert(sanitizeInventory(current, duplicated) === null, 'дублирование предмета сверх количества в current — отклонено (пул истощается)');

    // Легитимно: пустой инвентарь (использовали всё)
    assert(sanitizeInventory(current, []) !== null, 'полное опустошение инвентаря — разрешено');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
