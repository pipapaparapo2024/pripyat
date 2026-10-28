/**
 * Test: server/migrate54.php (28.10.2026, по прямому указанию — "раздай всем рандомно значки...
 * игрок накопил 150 значек, рассыпь их по всем коллекциям случайно"). Одноразовый backfill:
 * игроки находили нычки (stash_count) до 26.10.2026, когда появился реальный разбор по
 * коллекциям/позициям (stash_data) — для старых находок stash_data остаётся пуст, хотя
 * stash_count уже ненулевой. Миграция добирает разницу случайными карточками той же логикой,
 * что ZanachkiModel::grantRandomCards() (равновероятно, 15 коллекций × 7 позиций).
 *
 * Стиль теста — такой же regex/структурный, как у существующего migrate50.php (см.
 * tests/habar-30-days-from-purchase-msk-daily-reset.test.js, Test 6) — реальное исполнение не
 * применяется ни к одной из ~50 существующих migrate*.php файлов проекта (они одноразовые,
 * удаляются после запуска, требуют реального DB-коннекта без мока в прецеденте).
 *
 * Run: node tests/migrate54-zanachki-random-backfill.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const migPath = path.join(root, 'server', 'migrate54.php');
const mig = fs.existsSync(migPath) ? fs.readFileSync(migPath, 'utf-8') : '';

console.log('\nTest 1: server/migrate54.php существует и защищён ключом, как остальные одноразовые миграции проекта');
{
    assert(fs.existsSync(migPath), 'server/migrate54.php существует');
    assert(/\$_GET\['key'\] !== 'stalker_migrate54_2026'/.test(mig), 'защищён ключом stalker_migrate54_2026');
    assert(/http_response_code\(403\)/.test(mig), 'без ключа — 403 Forbidden');
}

console.log('\nTest 2: читает ВСЕХ игроков разом (id, stash_count, stash_data), не фильтрует по WHERE — дефицит может быть у любого');
{
    assert(/SELECT `id`, `stash_count`, `stash_data` FROM `\{\$utb\}`/.test(mig),
        'запрос читает все 3 нужных поля из таблицы users (через $utb из Registry)');
}

console.log('\nTest 3: дефицит считается как (stash_count − реальная сумма по stash_data), не слепое присвоение');
{
    assert(/\$wantTotal = intval\(\$row\['stash_count'\]\);/.test(mig), 'wantTotal = stash_count');
    assert(/\$haveTotal \+= \$v;/.test(mig), 'haveTotal считается суммой реальных значений stash_data (15×7 позиций)');
    assert(/\$deficit = \$wantTotal - \$haveTotal;/.test(mig), 'deficit = wantTotal - haveTotal');
    assert(/if\(\$deficit <= 0\)\{ \$skipped\+\+; continue; \}/.test(mig),
        'идемпотентна — если дефицита нет (уже забэкфилено или stash_count=0), игрок пропускается без изменений');
}

console.log('\nTest 4: существующие карточки НЕ трогаются — дефицит только ДОБАВЛЯЕТ поверх, та же равновероятная логика, что ZanachkiModel::grantRandomCards()');
{
    // $data[...] инициализируется РЕАЛЬНЫМИ значениями из stash_data (не нулями/перезаписью) —
    // цикл добора инкрементирует поверх, не присваивает заново.
    assert(/\$v = intval\(\$raw\[\$colKey\]\[\$posKey\] \?\? 0\);/.test(mig), 'каждая позиция читается из уже существующего stash_data (не обнуляется)');
    assert(/\$data\[\$colKey\]\[\$posKey\] = \$v;/.test(mig), 'существующее значение переносится в $data как есть, до цикла добора');
    assert(/\$col = strval\(mt_rand\(1, 15\)\);/.test(mig), 'случайная коллекция 1-15 — тот же диапазон, что grantRandomCards()');
    assert(/\$pos = strval\(mt_rand\(1, 7\)\);/.test(mig), 'случайная позиция 1-7 — тот же диапазон, что grantRandomCards()');
    assert(/\$data\[\$col\]\[\$pos\]\+\+;/.test(mig), 'добор ТОЛЬКО инкрементирует (++), не presваивает — не может стереть уже имеющиеся карточки');
}

console.log('\nTest 5: запись — точечный UPDATE по id (не TRUNCATE/DELETE, не трогает других игроков), значение экранировано перед SQL');
{
    assert(/\$jsonEsc = \$link->real_escape_string\(\$json\);/.test(mig), 'JSON экранируется перед вставкой в SQL — защита от инъекции через содержимое stash_data');
    assert(/UPDATE `\{\$utb\}` SET `stash_data` = '\{\$jsonEsc\}' WHERE `id` = \{\$id\}/.test(mig),
        'UPDATE точечный, по конкретному id — не массовая правка одним запросом без WHERE');
    assert(!/TRUNCATE|DELETE FROM/.test(mig), 'миграция не содержит TRUNCATE/DELETE — только аддитивный backfill');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
