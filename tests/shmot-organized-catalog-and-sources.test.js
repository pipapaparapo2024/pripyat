const fs = require('fs');
const path = require('path');

let failed = 0;
function assert(condition, message){
    if(condition) console.log('  OK', message);
    else { console.error('  FAIL', message); failed++; }
}

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
// 30.09.2026: imgFile может нести cache-bust query (?cb=N) поверх реального имени файла — см.
// nginx-фикс в этот же день (immutable-кэш на год для PNG заменён на no-cache, но уже
// закэшировавшие старый файл устройства сами не перезапросят его без смены URL). Файл на диске
// называется без query — отрезаем его перед проверкой существования.
const artworkExists = (dir, imgFile) => fs.existsSync(path.join(dir, imgFile.split('?')[0]));
const catalog = JSON.parse(read('server/json/shmot_items.json'));
const shmot = read('_client/src/game/shmot.js');
const bosses = JSON.parse(read('server/json/bosses_config.json'));
const yashik = JSON.parse(read('server/json/yashik_config.json'));
const byId = new Map(catalog.map(item => [item.id, item]));

// Complete specification replaces three obsolete historical batch snapshots.
const sets = {
    'новопришедший': [94,95,97], 'ссср': [41,42,43,44,45,46],
    'вольный': [47,48,49,73], 'мастер': [50,51,52,53],
    'спортик': [54,55,56,57,74], 'зумер': [58,75,76,77,96],
    'выживший': [59,60,61], 'Игроман': [62,63,78,79,98],
    'Игроман 2.0': [64,65,66,80,99], 'Картежник': [67,68,89],
    'сталкер': [69,81,82,83,84], 'спортик 2.0': [70,71,85,90,91],
    'тинейджер': [72,86,87,88,92]
};
const expectedBonuses = {
    auto_flat: {41:40,43:40,44:40,46:80,47:80,48:80,49:80,52:120,53:180,
        54:120,56:120,58:150,59:150,61:200,64:50,67:200,68:150,69:50,
        70:70,75:120,76:120,78:100,79:100,80:50,84:70,86:100,87:150,
        88:150,89:100,90:50,91:90,92:100,94:20,99:40},
    gun_flat: {42:10,50:30,55:30,57:50,60:100,62:50,63:50,65:30,
        73:20,82:25,85:20,96:40,97:5,98:100},
    machete_flat: {45:10,66:20,71:10,74:20,77:30,83:15,95:4},
    max_e: {51:10,72:50,81:20}
};
for(const [key, values] of Object.entries(expectedBonuses)){
    for(const [id, value] of Object.entries(values)){
        const item = byId.get(+id);
        assert(!!item && item.bk === key && item.bv === value, `id${id}: specified ${key} +${value}`);
    }
}
const rows = [...shmot.matchAll(/\{id:(\d+),\s*cat:(\d+),\s*name:'([^']+)'[^\n]+/g)]
    .map(m => ({id: +m[1], name: m[3], line: m[0]}));
// 28.09.2026: 59, не 58 — добавлена id:100 "Связка ключей" (личная награда рулетки, не часть
// ни одного набора/сета ниже, без обычного bk/bv-бонуса — см. отдельную проверку ниже).
assert(rows.length === 59 && new Set(rows.map(r => r.id)).size === 59, '59 unique equipment IDs');
assert(new Set(rows.map(r => r.name)).size === rows.length, 'equipment names are unique');
assert(!rows.some(r => r.id === 93 || r.id < 41), 'unrequested blackjack shoes and old shop excluded');
for(const [set, ids] of Object.entries(sets)){
    const actual = rows.filter(r => r.line.includes(`set:'${set}'`)).map(r => r.id).sort((a,b) => a-b);
    assert(JSON.stringify(actual) === JSON.stringify(ids), `complete set ${set}`);
}
for(const row of rows){
    const item = byId.get(row.id);
    const image = row.line.match(/imgFile:'([^']+)'/);
    if(row.id === 100){
        // Связка ключей — личная награда без обычного стат-бонуса: клиент bk:null,bv:null,
        // серверный каталог не задаёт bk/bv вовсе (см. server/json/shmot_items.json).
        assert(!!item && item.bk === undefined && item.bv === undefined, 'id100: server catalog has no bk/bv (no stat bonus)');
        assert(/bk:null, bv:null/.test(row.line), 'id100: client catalog matches — no stat bonus either');
        assert(!!image && artworkExists(path.join(root, '_client/development/images/shmot'), image[1]), 'id100: real artwork');
        continue;
    }
    const bonus = row.line.match(/bk:'([^']+)',\s*bv:(\d+)/);
    assert(!!item && !!bonus && item.bk === bonus[1] && item.bv === +bonus[2], `id${row.id}: client/server bonus matches`);
    assert(!!image && artworkExists(path.join(root, '_client/development/images/shmot'), image[1]), `id${row.id}: real artwork`);
    // 26.09.2026 (реверс автовыдачи стартового сета "новопришедший"): id94/95/97 снова
    // покупные товары за сигареты, все остальные — честный дроп.
    if([94, 95, 97].includes(row.id)){
        assert(/price:\{type:'cig',a:\d+\}/.test(row.line), `id${row.id}: purchasable for cigarettes (новопришедший)`);
    } else {
        assert(/price:null/.test(row.line), `id${row.id}: not purchasable`);
    }
    assert(row.line.includes(`fragments:${row.id <= 43 ? 20 : 'null'}`), `id${row.id}: fragment requirement`);
}

console.log('Catalog and assets');
const required = [
    [52, 'auto_flat', 120], [55, 'gun_flat', 30], [58, 'auto_flat', 150],
    [63, 'gun_flat', 50], [64, 'auto_flat', 50], [75, 'auto_flat', 120],
    [76, 'auto_flat', 120], [78, 'auto_flat', 100], [79, 'auto_flat', 100],
    [80, 'auto_flat', 50], [96, 'gun_flat', 40], [97, 'gun_flat', 5],
    [98, 'gun_flat', 100], [99, 'auto_flat', 40]
];
for(const [id, bk, bv] of required){
    const item = byId.get(id);
    assert(item && item.bk === bk && item.bv === bv, `id${id}: ${bk} +${bv} in server catalog`);
    const line = shmot.match(new RegExp(`\\{id:${id},[^\\n]+`));
    assert(!!line, `id${id}: exists in client catalog`);
    const image = line && line[0].match(/imgFile:'([^']+)'/);
    assert(!!image && artworkExists(path.join(root, '_client/development/images/shmot'), image[1]), `id${id}: artwork exists`);
}

console.log('Sources and server authority');
for(const source of ['poker', 'dice', 'blackjack', 'lost_stash']){
    assert(catalog.some(item => item.source === source), `source ${source} has equipment`);
}
assert(read('server/core/models/gameops.php').includes('function grantShmotFromSource'), 'source-specific grant helper exists');
for(const controller of ['poker.php', 'dice.php']){
    const src = read(`server/core/controllers/${controller}`);
    assert(src.includes('grantShmotFromSource'), `${controller} awards equipment on server`);
    assert(src.includes("'shmot'"), `${controller} returns the updated equipment patch`);
}
// 02.10.2026 (ОБНОВЛЕНО повторным прогоном полного каталога тестов): blackjack.php — особый
// случай среди poker/dice/blackjack. AA/KK/QQ привязаны к КОНКРЕТНОМУ предмету каждый
// (blackjack_config.json premium_shmot: {"туз":67,"король":89,"дама":68} — именно эти 3 id и
// есть весь source:"blackjack" пул), поэтому используется не случайный grantShmotFromSource(),
// а grantShmotById() — детерминированная выдача по рангу (см. gameops.php: "нужен там, где
// награда привязана к комбинации (AA/KK/QQ), а не должна выбираться случайно из пула
// источника"). Независимое подтверждение — casino-loot-policy.test.js "AA/KK/QQ привязаны к
// предметам Картёжника" / "Карты выдают конкретный предмет на сервере".
{
    const src = read('server/core/controllers/blackjack.php');
    assert(src.includes('grantShmotById'), 'blackjack.php awards equipment on server (via grantShmotById — deterministic per rank, not a random pool pick)');
    assert(src.includes("'shmot'"), 'blackjack.php returns the updated equipment patch');
}
// 24.09.2026: poker/blackjack используют ДРУГОЙ (тоже валидный) механизм — читают
// res.patch.shmot и перезагружают через shmot._loadFromUdata(), а не res.shmotGranted[]
// (dice.php шлёт shmotGranted МАССИВОМ id, а poker.php/blackjack.php — одиночным nullable
// id, встроенным прямо в общий patch через 'shmot' ключ, а не отдельным полем). Оба пути
// одинаково корректно обновляют локальное отображение экипировки.
assert(read('_client/src/game/dvor/dvor-dice-game.js').includes('shmotGranted'),
    'dvor-dice-game.js updates the local equipment view from server result (shmotGranted[] array)');
for(const screen of ['dvor/dvor-poker-game.js', 'dvor/dvor-blackjack.js']){
    const src = read(`_client/src/game/${screen}`);
    assert(/res\.patch\.shmot !== undefined && window\.shmot && typeof shmot\._loadFromUdata === 'function'/.test(src),
        `${screen} updates the local equipment view from server result (patch.shmot + _loadFromUdata)`);
}

console.log('Drop pools');
for(const [bossId, modes] of Object.entries(bosses.boss_shmot_drop_pool)){
    for(const ids of Object.values(modes)) for(const id of ids){
        assert(byId.has(id), `boss ${bossId} refers to registered id${id}`);
    }
}
// 02.10.2026 (ОБНОВЛЕНО повторным прогоном полного каталога тестов): yashik_config.json
// больше не хранит плоскую lost_stash_sequence (15 id по порядку) — редизайн сгруппировал её
// в lost_stash_sets (3 сета по {items:[4 id], hand:id}, первые четыре выдаются случайно внутри
// сета, рука — последней), см. yashik-lost-stash-and-dev-force-drops.test.js для полной
// проверки формулы. Каталог предметов (byId/source==='lost_stash') не менялся — проверяем тот
// же инвариант на новой форме данных.
const lostStashIds = (yashik.lost_stash_sets || []).flatMap(set => [...(set.items || []), set.hand]);
assert(lostStashIds.length === 15, `lost_stash_sets flattens to 15 ids, got ${lostStashIds.length}`);
for(const id of lostStashIds){
    const item = byId.get(id);
    assert(item && item.source === 'lost_stash', `lost stash set id${id} belongs to its source`);
}

assert(read('server/core/controllers/bosses.php').includes('$shmotFlat'), 'boss combat applies flat weapon-specific equipment bonuses');
if(failed) process.exit(1);
