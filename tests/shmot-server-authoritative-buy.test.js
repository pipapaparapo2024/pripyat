/**
 * Test: батч 18.09.2026 (найдено при аудите во время задачи по шмоткам) — shmot.js был
 * единственным крупным магазином, ещё НЕ переведённым на честный запрос-ответ с сервером:
 *
 *  1) _buy() списывал валюту и выдавал вещь СРАЗУ на клиенте, до ответа сервера, и не
 *     проверял ошибку (err-колбэк был null) — показывал "Куплено!" даже если сервер
 *     отклонял покупку.
 *  2) server/json/shmot_items.json содержал только id 0-23, хотя в shmot.js уже 41 предмет
 *     (id 0-40) — покупка любого из 17 новых предметов (id24-40) ВСЕГДА проваливалась на
 *     сервере (shmot.php.buy() не находил item_id в каталоге), а клиент считал её успешной.
 *     После следующего автосейва users.php._sanitizeShmot() откатывала owned=true обратно
 *     (не пропускает false→true без серверного подтверждения) — предмет тихо пропадал.
 *  3) _saveToUdata()/_loadFromUdata() сохраняли/читали шмотки по ПОЗИЦИИ в this.items, а
 *     shmot.php.buy() пишет owned по item.id КАК ИНДЕКСУ массива — для id>=24 позиция и id
 *     расходятся (татуировки id20-23 вставлены ПОСЛЕ id24-34 в this.items), из-за чего
 *     покупка одного предмета помечала владельцем совсем другой.
 *
 * Run: node tests/shmot-server-authoritative-buy.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const shmotSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shmot.js'), 'utf-8');
const shmotItemsJson = JSON.parse(fs.readFileSync(path.join(root, 'server', 'json', 'shmot_items.json'), 'utf-8'));

console.log('\nTest 1: shmot_items.json покрывает ВСЕ 41 предмет (id 0-40) из shmot.js, не только 0-23');
{
    const idsInCatalog = new Set(shmotItemsJson.map(it => it.id));
    // 28.09.2026: 100, не 99 — добавлена id:100 "Связка ключей" (58 актуальных → 59).
    assert(idsInCatalog.size === 100, 'в каталоге 41 прежний и 59 актуальных предметов, нашлось: ' + idsInCatalog.size);
    for (let id = 0; id <= 40; id++) {
        assert(idsInCatalog.has(id), `id=${id} присутствует в shmot_items.json`);
    }
}

// 23.09.2026 (батч "убери все шмотки, которые не выбиваются с боссов"): весь id0-40 (в т.ч.
// id24-40 из этого теста) удалён из shmot.js целиком — сравнивать цену клиента с каталогом
// больше не на чем, ни у одного предмета в файле теперь нет поля price вообще (все price:null).
// server/json/shmot_items.json намеренно НЕ тронут (мёртвые данные на случай возврата покупных
// предметов, см. комментарий в shmot.js) — Test 1 выше это уже подтверждает.
console.log('\nTest 2: в shmot.js покупной магазин удалён — КРОМЕ id94/95/97 (реверс автовыдачи "новопришедший", 26.09.2026)');
{
    const itemsMatch = [...shmotSrc.matchAll(/\{id:(\d+),[^}]*?price:\{type:'(\w+)',a:(\d+)\}/g)];
    const priceIds = itemsMatch.map(m => parseInt(m[1])).sort((a, b) => a - b);
    assert(JSON.stringify(priceIds) === JSON.stringify([94, 95, 97]),
        'ровно 3 предмета содержат price:{...} — id94/95/97, нашли ' + JSON.stringify(priceIds));
}

console.log('\nTest 3: _buy() больше не мутирует состояние ДО ответа сервера (честный запрос-ответ, как weapons.js._buy)');
{
    const buyMatch = shmotSrc.match(/\t_buy\(item\)\{([\s\S]*?)\n\t\}/);
    assert(!!buyMatch, '_buy(item) найден');
    const body = buyMatch ? buyMatch[1] : '';

    // Раньше здесь были прямые мутации ДО TS.php(...) — теперь их быть не должно.
    assert(!/udata\[cur\] = parseInt\(udata\[cur\]\|\|0\) - cost;/.test(body),
        'валюта больше не списывается локально до ответа сервера');
    assert(!/item\.owned = true;\s*\n\s*iface\.updateUp\(\);/.test(body),
        'item.owned больше не выставляется локально до ответа сервера');

    const tsCallIdx     = body.indexOf("TS.php('shmot.buy'");
    const applyPatchIdx = body.indexOf('applyPatch(res.patch)');
    assert(tsCallIdx !== -1, 'TS.php(\'shmot.buy\', ...) вызывается');
    assert(applyPatchIdx !== -1 && applyPatchIdx > tsCallIdx,
        'applyPatch(res.patch) вызывается ВНУТРИ колбэка успеха (после ответа сервера)');

    assert(/this\._shmotBuyInFlight/.test(body), 'есть guard от повторного клика во время запроса (in-flight), как в weapons.js');
    assert(/iface\._openSidorovichError\(/.test(body), 'ошибка сервера показывается через iface._openSidorovichError, а не тихо игнорируется (err был null)');
}

console.log('\nTest 4: _loadFromUdata индексирует по item.id (не по позиции в this.items); _saveToUdata удалена (25.09.2026 — shmot server-authoritative)');
{
    // 'shmot' убран из client-writable whitelist в users.php — единственные писатели теперь
    // shmot.php.buy()/equip() и users.devGrantShmot(), не generic users.save(), поэтому
    // _saveToUdata() (которая писала через users.save()) удалена как мёртвый код целиком.
    assert(!/_saveToUdata\(\)\{/.test(shmotSrc), '_saveToUdata() удалена из shmot.js (единственный путь записи через users.save() убран)');

    const loadMatch = shmotSrc.match(/\t_loadFromUdata\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!loadMatch, '_loadFromUdata найден');
    // 28.09.2026: PHP json_encode() сериализует разреженный массив (id:100 "Связка ключей" —
    // первая реальная запись далеко за пределами обычных индексов) как JSON-ОБЪЕКТ, не массив.
    // Array#forEach на таком объекте падал бы (тихо, catch скрывал всю одежду) — перешли на
    // Object.entries(), которая работает для обеих форм одинаково.
    assert(/Object\.entries\(saved \|\| \{\}\)\.forEach\(\(\[rawId, s\]\) => \{/.test(loadMatch[1]),
        '_loadFromUdata перебирает через Object.entries() (переживает и массив, и объект от разреженного id:100)');
    assert(/const id = parseInt\(rawId\);/.test(loadMatch[1]), 'id вещи парсится из ключа (строка что при массиве, что при объекте)');
    assert(/this\.items\.find\(it => it\.id === id\)/.test(loadMatch[1]),
        '_loadFromUdata ищет предмет по it.id === id (не this.items[id] напрямую и не this.items[i] по порядку)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
