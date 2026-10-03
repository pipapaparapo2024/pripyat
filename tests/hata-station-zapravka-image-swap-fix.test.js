/**
 * Test: 03.10.2026 (репорт игрока "позывной" — "сижу в хате «станция», отображаюсь в хате
 * «заправка», при заезде в хату «заправка», наоборот «станция»").
 *
 * Корень: в HATAS (hata.js, попап выбора/покупки хаты) у записей id:6 ("Станция") и id:7
 * ("Заправка") поля img были перепутаны местами — id:6 указывал на 'заправка.png', id:7 — на
 * 'станция.png'. home.js._bgFiles (тот же набор локаций базы, индексируется позицией id) уже
 * был в правильном порядке [...,'станция.png','заправка.png'] — т.е. главный экран показывал
 * корректную картинку, а попап выбора хаты — перепутанную, отсюда и рассинхрон, который видел
 * игрок между тем, что он выбрал в попапе, и тем, что показывалось потом на базе.
 *
 * Run: node tests/hata-station-zapravka-image-swap-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const hataSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), 'utf-8');
const homeSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'home.js'), 'utf-8');

console.log('\nTest 1: hata.js — id:6 "Станция" указывает на станция.png, id:7 "Заправка" — на заправка.png');
{
    assert(/\{ id:6, name:'Станция',\s*img:'станция\.png',\s*bossReq:6,\s*cost:150000\s*\},/.test(hataSrc),
        'id:6 "Станция" теперь использует станция.png (было заправка.png)');
    assert(/\{ id:7, name:'Заправка',\s*img:'заправка\.png',\s*bossReq:7,\s*cost:1000000\s*\},/.test(hataSrc),
        'id:7 "Заправка" теперь использует заправка.png (было станция.png)');
}

console.log('\nTest 2: порядок совпадает с home.js._bgFiles (та же позиция id = тот же файл)');
{
    const m = homeSrc.match(/_bgFiles\s*=\s*\[([^\]]+)\]/);
    assert(!!m, '_bgFiles найден в home.js');
    const files = m ? m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')) : [];
    assert(files[6] === 'станция.png', 'home.js._bgFiles[6] (id:6, "Станция") — станция.png');
    assert(files[7] === 'заправка.png', 'home.js._bgFiles[7] (id:7, "Заправка") — заправка.png');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
