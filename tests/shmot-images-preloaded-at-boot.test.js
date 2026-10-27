/**
 * Test: 25.09.2026 (по прямому указанию — "файлы шмоток не сразу прогружаются"): все 58
 * иконок предметов дропа (game/shmot.js, this.items[].imgFile) добавлены в общий список
 * предзагрузки window._allGamePngs (game-boot.js) с префиксом 'shmot/' — раньше PIXI.Texture.
 * from() для них вызывался лениво, только при первом открытии магазина/манекена, из-за чего
 * был заметен попап-ин картинок уже ПОСЛЕ открытия экрана.
 *
 * Run: node tests/shmot-images-preloaded-at-boot.test.js
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

const shmotSrc = read('_client/src/game/shmot.js');
const bootSrc  = read('_client/src/game/game-boot.js');

const catalogFiles = [...shmotSrc.matchAll(/imgFile:'([^']+)'/g)].map(m => m[1]);
// 21.10.2026: 59 → 74 — добавлены 3 новых сета по 5 предметов (id101-115).
// 25.10.2026: 74 → 78 — добавлен сет "Исполнитель" (id116-119, приз Разнарядки за полный месяц).
console.log(`\nВ каталоге shmot.js найдено ${catalogFiles.length} файлов (ожидается 78)`);
assert(catalogFiles.length === 78, 'каталог содержит ровно 78 предметов с imgFile');

// 26.10.2026: manImgFile — заранее уменьшенная копия для показа НА персонаже (резкость, см.
// shmot-man-prescaled-images.test.js), отдельный файл от оригинала imgFile (тот остаётся для
// cellScale/иконки в магазине) — каждому из 78 предметов теперь соответствуют ДВА файла в
// прелоаде, не один.
const manImgFiles = [...shmotSrc.matchAll(/manImgFile:'([^']+)'/g)].map(m => m[1]);
assert(manImgFiles.length === 78, `у всех 78 предметов есть manImgFile (нашлось ${manImgFiles.length})`);

console.log('\nКаждый файл каталога (imgFile И manImgFile) присутствует в window._allGamePngs с префиксом shmot/');
{
    const preloadFiles = new Set([...bootSrc.matchAll(/'shmot\/([^']+)'/g)].map(m => m[1]));
    const expected = [...catalogFiles, ...manImgFiles];
    let allPresent = true;
    const missing = [];
    expected.forEach(f => {
        if(!preloadFiles.has(f)){ allPresent = false; missing.push(f); }
    });
    assert(allPresent, `все ${expected.length} файлов (оригиналы+уменьшенные) есть в прелоаде (не хватает: ${missing.length})`);
    assert(preloadFiles.size === new Set(expected).size, `в прелоаде ровно столько же уникальных shmot/-записей (${preloadFiles.size}), сколько в каталоге (${new Set(expected).size}) — не больше и не меньше (никаких дублей/лишних)`);
}

console.log('\nПуть построен как ./images/ + fname — значит shmot/имя.png корректно резолвится в ./images/shmot/имя.png (та же папка, что и у shmot_shop.js._shopRefresh)');
{
    assert(/const url = '\.\/images\/' \+ fname;/.test(bootSrc), 'формула URL прелоада не менялась (base ./images/, без своего префикса под shmot)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
