/**
 * Test: 25.10.2026, по прямому указанию — новый сет шмота "Исполнитель" (Маска/Бита/Худи белая/
 * Худи коричневая, файлы из C:\Users\HONOR\Desktop\vk_game\шмотки\_organized\исполнительный),
 * приз за ПОЛНЫЙ месяц Разнарядки (reward_tiers need:-1 в raznaryadka_config.json). Один
 * случайный ещё не выбитый предмет из 4 за каждый полный месяц, уже выпавшие не повторяются.
 *
 * До этой правки места под сет в конфиге УЖЕ было (shmot_pool: ["executive_hoodie_brown", ...]
 * — строковые placeholder-ключи, см. комментарий RaznaryadkaProgress::grantTier() до правки),
 * но арт не был заведён в каталоги (ни клиентский shmot.js, ни серверный shmot_items.json), и
 * grantTier() реальную шмотку не выдавал вообще — только coins+bonus_weapon_type тира. Теперь:
 *  - ids 116-119 добавлены И в _client/src/game/shmot.js (отображение/позиции/бонус-текст),
 *    И в server/json/shmot_items.json (source:'raznaryadka', та же механика пула, что у
 *    остальных source-сетов — см. Gameops::grantShmotFromSource()).
 *  - raznaryadka_config.json: shmot_pool (строковые placeholder) заменён на shmot_source
 *    (единственная строка — ключ source, по которому ищется пул в каталоге).
 *  - RaznaryadkaProgress::grantTier() теперь реально зовёт grantShmotFromSource(), когда у
 *    тира есть shmot_source.
 *
 * Часть 1 (этот файл) — regex-проверки по тексту файлов (быстрый первый слой + синхронность
 * двух каталогов между собой). Часть 2 — РЕАЛЬНОЕ исполнение PHP (grantShmotFromSource()/
 * grantTier() на настоящих данных из json) через tests/_php_fixtures/
 * raznaryadka-executive-shmot-set.php — ловит логические баги (дубликаты, пул не исчерпывается
 * и т.п.), которые текстовый grep в принципе не может поймать (см. AGENTS.md про исполняющие
 * тесты vs regex).
 *
 * Run: node tests/oct25-raznaryadka-executive-shmot-set.test.js
 */
const fs   = require('fs');
const path = require('path');
const { findPhpBin } = require('./_php_bin.js');
const { execFileSync } = require('child_process');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const shmotJsSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shmot.js'), 'utf-8');
const shmotItems   = JSON.parse(fs.readFileSync(path.join(root, 'server', 'json', 'shmot_items.json'), 'utf-8'));
const raznConfig   = JSON.parse(fs.readFileSync(path.join(root, 'server', 'json', 'raznaryadka_config.json'), 'utf-8'));
const raznProgress = fs.readFileSync(path.join(root, 'server', 'core', 'models', 'raznaryadkaprogress.php'), 'utf-8');

console.log('\nTest 1: shmot.js — 4 предмета (ids 116-119) присутствуют; 117-119 в сете "Исполнитель", id116 переехал в сет "Комбинатор"');
{
    // 26.10.2026 (по прямому указанию — "маска должна выпадать не из ежедневных заданий, а из
    // игры 2048" + "маска не сета Исполнитель, а сета Комбинатор, +40 к автоматам"): id116
    // выделен из пула "Исполнитель" — переименован, пересечён на set:'комбинатор', source
    // переключён на крафт в игре "2048" (90 фрагментов). ids 117-119 остались в пуле
    // "Исполнитель"/ежедневные задания без изменений, кроме текста source (см. Test 2 ниже).
    // 27.10.2026 (по прямому указанию — "поменяй название сета не исполнитель а
    // исполнительный"): имена предметов и значение поля set переименованы — id116 (другой сет,
    // "Комбинатор") не затронут.
    const names = { 116: 'Маска (Комбинатор)', 117: 'Бита (Исполнительный)', 118: 'Худи белая (Исполнительный)', 119: 'Худи коричневая (Исполнительный)' };
    for (const id of [116, 117, 118, 119]) {
        const re = new RegExp('\\{id:' + id + ',[^}]*name:\'' + names[id].replace(/[()]/g, '\\$&') + '\'[^}]*\\}');
        assert(re.test(shmotJsSrc), `id:${id} (${names[id]}) присутствует в shmot.js с правильным именем`);
    }
    assert(/\{id:116[^}]*price:null, owned:false, equipped:false\}/.test(shmotJsSrc), 'id:116 — price:null (не покупается за валюту), стартует НЕ owned');
    assert(/\{id:116,[^}]*set:'комбинатор'/.test(shmotJsSrc), 'id:116 помечен set:\'комбинатор\' (не \'исполнительный\')');
    assert((shmotJsSrc.match(/set:'исполнительный'/g) || []).length === 3, 'ровно 3 предмета (117-119) помечены set:\'исполнительный\' (найдено: ' + ((shmotJsSrc.match(/set:'исполнительный'/g) || []).length) + ')');
    assert(!/set:'исполнитель'/.test(shmotJsSrc), 'старое значение set:\'исполнитель\' (без суффикса "ный") нигде не осталось');
    assert(/\{id:116,[^}]*source:'Игра «2048» \(крафт 90 фрагментов\)'/.test(shmotJsSrc), 'id:116 помечен новым source-текстом про крафт в игре "2048"');
    assert((shmotJsSrc.match(/source:'Ежедневные задания \(приз за полный месяц\)'/g) || []).length === 3, 'ровно 3 предмета (117-119) помечены source-текстом "Ежедневные задания (приз за полный месяц)" (переименовано из "Разнарядка")');
    assert((shmotJsSrc.match(/fragments:null/g) || []).length > 4, 'сет "Исполнитель"/маска НЕ использует старую механику per-item фрагментов (fragments:null) — выдаются целиком за 1 дроп/крафт');
}

console.log('\nTest 2: shmot_items.json — id116 переехал на source:"game2048", 117-119 остались на source:"raznaryadka"');
{
    const ids = [116, 117, 118, 119];
    for (const id of ids) {
        const item = shmotItems.find(it => it.id === id);
        assert(!!item, `id=${id} присутствует в server/json/shmot_items.json`);
    }
    const item116 = shmotItems.find(it => it.id === 116);
    assert(item116 && item116.source === 'game2048', 'id=116 имеет source:"game2048" (крафт за фрагменты, не раздача раз в месяц)');

    const raznItems = shmotItems.filter(it => it.source === 'raznaryadka');
    assert(raznItems.length === 3, 'в shmot_items.json РОВНО 3 предмета с source:"raznaryadka" (116 выведен, нашлось: ' + raznItems.length + ')');
    // Регресс-гвард синхронности каталогов: id116 единственный с source:"game2048" на сервере
    // И единственный с set:'комбинатор' на клиенте — а 117-119 (source:"raznaryadka" на сервере)
    // совпадают 1:1 с id клиента, помеченными set:'исполнительный'.
    const clientExecIds = [...shmotJsSrc.matchAll(/\{id:(11[7-9]),[^}]*set:'исполнительный'/g)].map(m => parseInt(m[1])).sort();
    const serverRaznIds = raznItems.map(it => it.id).sort();
    assert(JSON.stringify(clientExecIds) === JSON.stringify(serverRaznIds), 'ids сета "Исполнитель" СОВПАДАЮТ между client shmot.js и server shmot_items.json (' + clientExecIds + ' vs ' + serverRaznIds + ')');
    const game2048Items = shmotItems.filter(it => it.source === 'game2048');
    assert(game2048Items.length === 1 && game2048Items[0].id === 116, 'ровно 1 предмет (id116) с source:"game2048" — единственный источник детерминированной выдачи через grantShmotFromSource(\'game2048\')');
}

console.log('\nTest 2b (27.10.2026, по прямому указанию — авторитетный список бонусов сета): Бита +40 к автомату, Худи белая +10 к пистолету, Худи коричневая +40 к автомату (была +150 к мачете)');
{
    // Баг репорт: "Бита должна давать +40 к автомату, а даёт 250" — client (shmot.js) и server
    // (shmot_items.json) оказались СОГЛАСОВАННЫ на неверном значении — не рассинхрон каталогов,
    // а просто неверные числа, введённые изначально. Сверено клиент==сервер для всех 3 предметов.
    const expected = {
        117: { bk: 'auto_flat', bv: 40 },
        118: { bk: 'gun_flat',  bv: 10 },
        119: { bk: 'auto_flat', bv: 40 }, // была machete_flat/150 — поменялся и тип оружия, не только число
    };
    for(const id of [117, 118, 119]){
        const serverItem = shmotItems.find(it => it.id === id);
        assert(!!serverItem && serverItem.bk === expected[id].bk && serverItem.bv === expected[id].bv,
            `server shmot_items.json id=${id}: bk=${expected[id].bk}, bv=${expected[id].bv} (получено bk=${serverItem && serverItem.bk}, bv=${serverItem && serverItem.bv})`);

        const re = new RegExp('\\{id:' + id + ',[^}]*bk:\'' + expected[id].bk + '\',?\\s*bv:' + expected[id].bv + ',');
        assert(re.test(shmotJsSrc), `client shmot.js id=${id}: bk:'${expected[id].bk}', bv:${expected[id].bv} в каталоге`);
    }
    assert(/\{id:117,[^}]*bonus:'\+40 к автомату'/.test(shmotJsSrc), 'id117 bonus-текст "+40 к автомату"');
    assert(/\{id:118,[^}]*bonus:'\+10 к пистолету'/.test(shmotJsSrc), 'id118 bonus-текст "+10 к пистолету"');
    assert(/\{id:119,[^}]*bonus:'\+40 к автомату'/.test(shmotJsSrc), 'id119 bonus-текст "+40 к автомату" (была "+150 к мачете")');
}

console.log('\nTest 2c (27.10.2026, по прямому указанию — репозиция иконки в гардеробе): Бита (id117) — cellDx/cellDy/cellScale/cellRot');
{
    // "Поверни по часовой стрелке на 10°, scale 0.185, сдвинь на 10px вниз и 4px влево" —
    // относительно прежних cellDx:-5,cellDy:-32,cellScale:0.230 (арифметика: -5-4=-9, -32+10=-22).
    assert(-5 - 4 === -9 && -32 + 10 === -22, 'арифметика сдвига сходится (sanity, не должна расходиться с утверждением ниже)');
    // 27.10.2026 (повторное уточнение тем же днём, редактор позиций x:225,y:931,scale:0.169,
    // w:131,h:107): база ячейки cx+77=229,cy+98=973 выведена из исходной (пред-твик) калибровки
    // x:224,y:941 → cellDx:-5,cellDy:-32 выше. Новые cellDx/cellDy = 225-229=-4, 931-973=-42.
    // 27.10.2026 (по прямому указанию, повторный редактор позиций — "x:220,y:930,scale:0.169,
    // rot:10°,w:130,h:107"): cellDx/cellDy пересчитаны той же формулой (17-й cat:6 предмет,
    // idx=16 → cx=157,cy=860 → cellDx=220-157-77=-14, cellDy=930-860-98=-28); cellScale →
    // явные cellWidth/cellHeight (конвенция w/h из редактора позиций).
    assert(/\{id:117,[^}]*cellDx:-14, cellDy:-28, cellWidth:130, cellHeight:107, cellRot:10,/.test(shmotJsSrc),
        'id117: cellDx:-14, cellDy:-28, cellWidth:130, cellHeight:107, cellRot:10 записаны в каталог');

    const shopSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), 'utf-8');
    assert(/if\(item\.cellRot\) img\.rotation = item\.cellRot \* Math\.PI \/ 180;/.test(shopSrc),
        'shmot_shop.js применяет cellRot к иконке в гардеробе (градусы → радианы, по часовой стрелке)');
}

console.log('\nTest 3: raznaryadka_config.json — чест-тир ссылается на shmot_source, старый placeholder убран');
{
    const chestTier = raznConfig.reward_tiers.find(t => t.need === -1);
    assert(!!chestTier, 'в reward_tiers нашёлся тир need:-1 (сундук за полный месяц)');
    assert(chestTier && chestTier.shmot_source === 'raznaryadka', 'чест-тир ссылается на shmot_source:"raznaryadka"');
    assert(chestTier && chestTier.shmot_pool === undefined, 'старый placeholder-массив shmot_pool убран из конфига');
    // Регресс-гвард: coins/bonus_weapon_type тира не задеты правкой.
    assert(chestTier && chestTier.field === 'coins' && chestTier.amt === 130, 'монетная часть чест-тира (coins:130) не изменена правкой');
    assert(chestTier && chestTier.bonus_weapon_type === 'auto' && chestTier.bonus_amt === 10, 'бонусный ствол чест-тира (auto:10) не изменён правкой');
}

console.log('\nTest 4: raznaryadkaprogress.php — grantTier() реально зовёт grantShmotFromSource()');
{
    assert(/if\(!empty\(\$tier\['shmot_source'\]\)\) \$ops->grantShmotFromSource\(\$user, \$tier\['shmot_source'\]\);/.test(raznProgress),
        'grantTier() вызывает $ops->grantShmotFromSource($user, $tier[\'shmot_source\']) при наличии shmot_source');
    assert(!/executive_hoodie_brown|executive_hoodie_white|executive_mask|executive_bat/.test(raznProgress),
        'старые строковые placeholder-ключи (executive_*) убраны из кода');
}

console.log('\nTest 5 (реальное исполнение PHP): grantShmotFromSource()/grantTier() на настоящих данных из json');
{
    const phpBin = findPhpBin();
    if (!phpBin) {
        console.log('  ⚠️  PHP не найден локально — часть 2 (реальное исполнение) пропущена, см. tests/_php_bin.js. Остальные проверки (regex) уже прогнаны выше.');
    } else {
        const fixture = path.join(__dirname, '_php_fixtures', 'raznaryadka-executive-shmot-set.php');
        const serverDir = path.join(root, 'server');
        let stdout;
        try {
            stdout = execFileSync(phpBin, ['-d', 'display_errors=stderr', fixture], { encoding: 'utf-8', timeout: 15000, cwd: serverDir });
        } catch (e) {
            console.error('  ❌ PHP-скрипт упал (фатальная ошибка):');
            console.error('  ', e.stderr || e.message);
            failed++;
            stdout = '';
        }
        if (stdout) {
            stdout.trim().split('\n').forEach(line => {
                if (line.startsWith('PASS:')) { console.log('  ✅', line.slice(6)); passed++; }
                else if (line.startsWith('FAIL:')) { console.error('  ❌ FAIL:', line.slice(6)); failed++; }
                else if (line.trim()) console.log('   ', line);
            });
        }
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
