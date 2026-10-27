/**
 * Test: 26.10.2026 — по прямому указанию: (1) "Маска (Исполнитель)" (id116) выпадает из игры
 * 2048, НЕ из ежедневных заданий ("разнарядки") — остальные 3 предмета сета (117-119) остаются
 * в пуле ежедневных заданий; (2) кнопка "FLA" на главном экране убрана.
 *
 * Regex-проверка текста файлов — тот же уровень, что остальные source/whitelist-гварды проекта.
 * Run: node tests/mask-ispolnitel-source-2048-and-fla-removed.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function check(cond, msg){ if(cond){ console.log('  ✅', msg); passed++; } else { console.error('  ❌ FAIL:', msg); failed++; } }

const shmotItemsJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'json', 'shmot_items.json'), 'utf-8'));
const shmotJs = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shmot.js'), 'utf-8');
const homeJs = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'home.js'), 'utf-8');

console.log('\nМаска (id116) — source переключён на game2048, 117-119 остаются на раздаче заданий');
const byId = {};
shmotItemsJson.forEach((it) => { byId[it.id] = it; });
check(byId[116] && byId[116].source === 'game2048', 'shmot_items.json id116.source === "game2048"');
[117, 118, 119].forEach((id) => {
    check(byId[id] && byId[id].source === 'raznaryadka', `shmot_items.json id${id}.source остался "raznaryadka" (пул ежедневных заданий)`);
});

console.log('\nМаска — сет "Комбинатор" (НЕ "Исполнитель"), +8 к мачете (27.10.2026, по прямому указанию — было ошибочно +40 к автомату)');
check(byId[116] && byId[116].bk === 'machete_flat' && byId[116].bv === 8, "shmot_items.json id116.bk==='machete_flat', bv===8 (было auto_flat/40)");
check(/id:116[\s\S]{0,600}?set:'комбинатор'/.test(shmotJs), "shmot.js id116 set:'комбинатор'");
check(/id:116[\s\S]{0,600}?bonus:'\+8 к мачете'/.test(shmotJs), "shmot.js id116 bonus-текст '+8 к мачете'");
check(/id:116[\s\S]{0,600}?bk:'machete_flat'/.test(shmotJs), "shmot.js id116 bk:'machete_flat'");
check(/id:116[\s\S]{0,600}?bv:8\b/.test(shmotJs), 'shmot.js id116 bv:8');
check(/name:'Маска \(Комбинатор\)'/.test(shmotJs), "shmot.js id116 name:'Маска (Комбинатор)'");
check(!/set:'исполнитель'[\s\S]{0,10}/.test(shmotJs.match(/\{id:116[\s\S]{0,400}?\}/)?.[0] || ''), 'id116 больше НЕ числится в set "исполнитель"');

console.log('\nКлиентский каталог (shmot.js) — текст источника для игрока');
check(/id:116[\s\S]{0,400}?source:'Игра «2048»/.test(shmotJs), 'shmot.js id116 source-текст ссылается на игру 2048');
check(!/id:116[\s\S]{0,400}?source:'Ежедневные задания/.test(shmotJs), 'shmot.js id116 БОЛЬШЕ не ссылается на ежедневные задания');
[117, 118, 119].forEach((id) => {
    const re = new RegExp('id:' + id + '[\\s\\S]{0,400}?source:\'Ежедневные задания');
    check(re.test(shmotJs), `shmot.js id${id} source-текст — "Ежедневные задания" (было "Разнарядка")`);
});

console.log('\nГлавный экран — кнопка FLA убрана');
check(!/_flaGalleryBtn\s*=\s*btn/.test(homeJs), 'home.js больше не СОЗДАЁТ кнопку FLA (this._flaGalleryBtn = btn отсутствует)');
check(!/root\.layer0_mc\.addChild\(this\._flaGalleryBtn\)/.test(homeJs), 'home.js больше не добавляет кнопку FLA на сцену');

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
