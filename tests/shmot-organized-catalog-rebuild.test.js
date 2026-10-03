/**
 * Test: батч 21.09.2026 — пересборка каталога шмоток из C:\Users\HONOR\Desktop\vk_game\шмотки\_organized
 * (по прямому указанию, "я доверяю"). Содержимое 50 картинок дропа перезалито на прод под уже
 * принятыми в каталоге именами (images/shmot/) — это не поведенческое изменение кода, тест на
 * него не пишем (см. ПРАВИЛО №10 — только позиционные/файловые правки без логики). Поведенческое
 * изменение — новый сет "новопришедший" (id94/95): файлы шмот обувь/футболка новопришедший.png
 * уже были на проде (загружены раньше, без записи в каталоге), теперь заведены как дроп-предметы.
 *
 * Run: node tests/shmot-organized-catalog-rebuild.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shmot.js'), 'utf-8');

console.log('\nTest 1: новый сет "новопришедший" — 2 новых дроп-предмета (id94/95), уникальные id, не пересекаются с существующими (0-93)');
{
    assert(/\{id:94,[^}]*set:'новопришедший'/.test(src), 'id94 заведён с set:"новопришедший"');
    assert(/\{id:95,[^}]*set:'новопришедший'/.test(src), 'id95 заведён с set:"новопришедший"');
    const ids = [...src.matchAll(/\{id:(\d+),/g)].map(m => parseInt(m[1]));
    const unique = new Set(ids);
    assert(ids.length === unique.size, 'все id в this.items уникальны (нет дублей после добавления 94/95) — найдено ' + ids.length + ' записей');
    // 22.09.2026: финальная сверка добавила id96-99 (см. shmot-organized-catalog-and-sources.test.js) —
    // id95 больше не максимальный, но сам факт "94/95 уникальны и не пересекаются" остаётся верным.
    assert(ids.includes(94) && ids.includes(95), 'id94 и id95 присутствуют в каталоге');
}

console.log('\nTest 2: imgFile новых предметов указывает на файлы, УЖЕ реально существующие на проде под этими именами (не выдуманные)');
{
    // Сами файлы были обнаружены прямой проверкой sftp.listdir() продового
    // images/shmot/ ДО этой правки — они там были всегда, просто без записи в каталоге.
    assert(/imgFile:'шмот обувь новопришедший\.png'/.test(src), 'id94 imgFile === "шмот обувь новопришедший.png" (подтверждено на проде)');
    assert(/imgFile:'шмот футболка новопришедший\.png'/.test(src), 'id95 imgFile === "шмот футболка новопришедший.png" (подтверждено на проде)');
}

console.log('\nTest 3: новые предметы следуют паттерну дроп-вещей (source/fragments), что и остальные id41+ — КРОМЕ price');
{
    // 26.09.2026 (по прямому указанию — реверс автовыдачи стартового сета "новопришедший"):
    // id94/95/97 перестали быть бесплатным дропом и стали обычными покупными товарами за
    // сигареты — единственное отличие от паттерна id41+, всё остальное (fragments:null,
    // owned/equipped:false, cat) не менялось.
    const start94 = src.indexOf("{id:94,");
    const end94   = src.indexOf('\n', start94);
    const line94  = src.slice(start94, end94);
    assert(/price:\{type:'cig',a:150\}/.test(line94), 'id94 price:{type:\'cig\',a:150} — покупной товар за сигареты (реверс автовыдачи)');
    assert(/fragments:null/.test(line94), 'id94 fragments:null (нет механики сборки по частям)');
    assert(/owned:false, equipped:false/.test(line94), 'id94 стартует не надетым/не полученным');
    assert(/cat:3/.test(line94), 'id94 cat:3 (Обувь) — соответствует названию "Кроссовки"');

    const start95 = src.indexOf("{id:95,");
    const end95   = src.indexOf('\n', start95);
    const line95  = src.slice(start95, end95);
    assert(/price:\{type:'cig',a:200\}/.test(line95), 'id95 price:{type:\'cig\',a:200} — покупной товар за сигареты (реверс автовыдачи)');
    assert(/cat:1/.test(line95), 'id95 cat:1 (Тело) — соответствует названию "Футболка"');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
