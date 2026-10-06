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

// 06.10.2026 (стале-пин, не регрессия к этому фиксу — см. tests/hata-name-swap-vs-art-06-10.test.js):
// ЭТОТ тест проверяет img (картинку) — она 03.10 не трогалась повторно и по-прежнему станция.png
// у id:6 / заправка.png у id:7 по ПОЗИЦИИ. `name` (текстовая подпись) отдельным баг-репортом
// 06.10 была перепутана местами (картинка станция.png визуально — это АЗС, не вокзал) — id:6
// теперь называется "Заправка", id:7 — "Станция". img тут ни при чём, оставлен как есть.
console.log('\nTest 1: hata.js — id:6 по-прежнему указывает на станция.png, id:7 — на заправка.png (img не тронут правкой названий 06.10)');
{
    assert(/\{ id:6, name:'Заправка',\s*img:'станция\.png',\s*bossReq:6,\s*cost:150000\s*\},/.test(hataSrc),
        'id:6 (bossReq Бороды) использует станция.png, название "Заправка" (с 06.10 — совпадает с видом картинки)');
    assert(/\{ id:7, name:'Станция',\s*img:'заправка\.png',\s*bossReq:7,\s*cost:1000000\s*\},/.test(hataSrc),
        'id:7 (bossReq Жгута) использует заправка.png, название "Станция" (с 06.10 — совпадает с видом картинки)');
}

console.log('\nTest 2: порядок img совпадает с home.js._bgFiles (та же позиция id = тот же файл) — независимо от текстового name');
{
    const m = homeSrc.match(/_bgFiles\s*=\s*\[([^\]]+)\]/);
    assert(!!m, '_bgFiles найден в home.js');
    const files = m ? m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')) : [];
    assert(files[6] === 'станция.png', 'home.js._bgFiles[6] (id:6) — станция.png');
    assert(files[7] === 'заправка.png', 'home.js._bgFiles[7] (id:7) — заправка.png');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
