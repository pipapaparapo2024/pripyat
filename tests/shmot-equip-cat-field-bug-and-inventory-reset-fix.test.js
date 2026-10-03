/**
 * Test: 26.09.2026 — два независимых бага в области "шмотки"/сброс аккаунта.
 *
 * 1) shmot.php.equip() — реальный live-репорт с скриншотом ("надел одну футболку — три
 *    футболки разных сетов остались надеты одновременно", cat:1 "тело"). Предыдущая версия
 *    фикса (эта же сессия, более раннее прохождение) сравнивала предметы по 'bk' (тип
 *    бонуса — 'auto_flat'/'gun_flat'/'machete_flat'/...), а НЕ по 'cat' (слот экипировки:
 *    0=голова,1=тело,2=штаны,3=обувь,4=аксессуар,5=татуировка,6=рука, см. game/shmot.js) —
 *    это "работало" только для предметов с ОДИНАКОВЫМ типом бонуса в одной категории; разные
 *    футболки с разными бонусами (id42 gun_flat/id48 auto_flat/id95 machete_flat — все cat:1)
 *    друг друга не снимали, поэтому можно было надеть их все разом. Настоящий фикс: добавить
 *    'cat' в server/json/shmot_items.json (перенесено 1-в-1 из клиентского каталога
 *    game/shmot.js для всех 58 актуальных предметов) и сравнивать intval($it['cat']) ===
 *    intval($item['cat']). Старые id0-40 (убраны из клиента 23.09.2026) 'cat' не получили —
 *    мёртвый код, в проверке не участвуют (isset-гард).
 *
 * 2) dev_panel.js._resetAccount() сбрасывал inventory:'' (пустая строка) вместо inventory:'[]'
 *    (валидный пустой JSON-массив). users.php._sanitizeInventory() вызывает
 *    json_decode('', true) → null → !is_array(null) → отклоняет ВЕСЬ блоб (сервер лог:
 *    "[users.save] отклонено поле inventory — попытка эскалации") — рюкзак Василича не
 *    очищался при "СБРОС ВСЕГО", хотя весь остальной аккаунт сбрасывался нормально. Тот же
 *    класс бага УЖЕ был исправлен для weapons (см. соседний комментарий "фикс weapons:'' →
 *    weapons:'[]'") — inventory пропустили при той правке.
 *
 * Run: node tests/shmot-equip-cat-field-bug-and-inventory-reset-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const shmotPhp   = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'shmot.php'), 'utf-8');
const devPanel   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');
const itemsJson  = JSON.parse(fs.readFileSync(path.join(root, 'server', 'json', 'shmot_items.json'), 'utf-8'));

console.log('\nTest 1: shmot_items.json содержит поле "cat" для всех 58 актуальных (клиентских) предметов');
{
    const clientShmot = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shmot.js'), 'utf-8');
    const clientPairs = [...clientShmot.matchAll(/\{id:(\d+),\s*cat:(\d+)/g)]
        .map(m => [parseInt(m[1], 10), parseInt(m[2], 10)]);
    assert(itemsJson.length > 0, 'каталог не пустой');
    assert(clientPairs.length >= 50, 'клиентский каталог даёт достаточно id/cat пар для сверки');
    const byId = new Map(itemsJson.map(it => [it.id, it]));
    // 28.09.2026 (фикс собственного теста): id:100 "Связка ключей" — намеренно НЕ вносится в
    // серверный каталог shmot_items.json (это псевдо-предмет: постоянный пассивный бонус,
    // владение хранится в udata['keyring_owner'], не в обычном udata['shmot']/shmot.equip — см.
    // комментарии в game/shmot.js и shell/overlays/shmot_shop.js) — исключаем его из сверки.
    const allMatch = clientPairs.filter(([id]) => id !== 100).every(([id, cat]) => byId.has(id) && byId.get(id).cat === cat);
    assert(allMatch, 'cat в server/json/shmot_items.json 1-в-1 совпадает с клиентским каталогом game/shmot.js для каждого живого id (кроме псевдо-предмета id:100)');
    const legacyIds = itemsJson.filter(it => it.id <= 40);
    assert(legacyIds.every(it => !('cat' in it)), 'старые id0-40 (убраны из клиента 23.09.2026) остаются без cat — мёртвый код, не трогаем');
}

console.log('\nTest 2: shmot.php.equip() сравнивает категорию по cat (intval), не по bk');
{
    const start = shmotPhp.indexOf('function equip()');
    const end   = shmotPhp.indexOf('\n    }', shmotPhp.indexOf('$this->ops->ok', start));
    const body  = shmotPhp.slice(start, end);
    // Убираем строки-комментарии (там нарочно упомянут старый паттерн как объяснение фикса) —
    // проверяем только реальный исполняемый код.
    const codeOnly = body.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
    assert(!/\(\$it\['bk'\] \?\? null\) !== \(\$item\['bk'\] \?\? null\)/.test(codeOnly),
        'старое (ошибочное) сравнение по bk убрано из кода');
    assert(/isset\(\$it\['cat'\]\)/.test(codeOnly) && /isset\(\$item\['cat'\]\)/.test(codeOnly),
        'новое сравнение защищено isset() — легаси id0-40 без cat безопасно пропускаются (continue), а не совпадают друг с другом');
    assert(/intval\(\$it\['cat'\]\)\s*!==\s*intval\(\$item\['cat'\]\)/.test(codeOnly),
        'новое сравнение — по числовому полю cat (реальный слот экипировки: голова/тело/штаны/обувь/аксессуар/тату/рука)');
}

console.log('\nTest 3: dev_panel.js._resetAccount() сбрасывает inventory в валидный JSON-массив \'[]\', не в пустую строку');
{
    const resetStart = devPanel.indexOf('proto._resetAccount = function()');
    const resetBody  = devPanel.slice(resetStart, devPanel.indexOf('\n    };', resetStart));
    assert(/inventory:'\[\]'/.test(resetBody), "inventory:'[]' — валидный JSON, пройдёт _sanitizeInventory()");
    assert(!/inventory:''/.test(resetBody), "старое inventory:'' (пустая строка, невалидный JSON) убрано");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
