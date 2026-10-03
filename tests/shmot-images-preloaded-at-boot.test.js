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
console.log(`\nВ каталоге shmot.js найдено ${catalogFiles.length} файлов (ожидается 59 — 28.09.2026 добавлена связка ключей)`);
assert(catalogFiles.length === 59, 'каталог содержит ровно 59 предметов с imgFile');

console.log('\nКаждый файл каталога присутствует в window._allGamePngs с префиксом shmot/');
{
    const preloadFiles = new Set([...bootSrc.matchAll(/'shmot\/([^']+)'/g)].map(m => m[1]));
    let allPresent = true;
    const missing = [];
    catalogFiles.forEach(f => {
        if(!preloadFiles.has(f)){ allPresent = false; missing.push(f); }
    });
    assert(allPresent, `все ${catalogFiles.length} файлов каталога есть в прелоаде (не хватает: ${missing.length})`);
    assert(preloadFiles.size === catalogFiles.length, `в прелоаде ровно столько же уникальных shmot/-записей (${preloadFiles.size}), сколько в каталоге — не больше и не меньше (никаких дублей/лишних)`);
}

console.log('\nПуть построен как ./images/ + fname — значит shmot/имя.png корректно резолвится в ./images/shmot/имя.png (та же папка, что и у shmot_shop.js._shopRefresh)');
{
    assert(/const url = '\.\/images\/' \+ fname;/.test(bootSrc), 'формула URL прелоада не менялась (base ./images/, без своего префикса под shmot)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
