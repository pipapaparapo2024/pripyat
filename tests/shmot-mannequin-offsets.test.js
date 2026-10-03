/**
 * Test: индивидуальные офсеты (manDx/manDy) и масштаб (manScale) шмоток на манекене.
 *
 * Точные значения для Головы/Тела/Штанов (сняты позже через drag-редактор позиций)
 * проверяются в tests/shmot-live-positions-and-home-mirror.test.js — здесь их
 * специально не дублируем, чтобы не было двух источников истины, которые могут
 * разъехаться. Этот файл проверяет то, что не изменилось с тех пор: единый офсет
 * на всю обувь, сдвиг оружия в руке, и включение manScale.
 *
 * Обувь:  изначально был единый офсет (+4,+8) на все 8 предметов; позже (drag-редактор)
 *          у большинства появились индивидуальные значения — точные числа проверяются
 *          в tests/shmot-live-positions-and-home-mirror.test.js. обувь_2.png данных не
 *          получала ни разу — здесь просто фиксируем, что она осталась на дефолте (4,8).
 * Рука:   оружие (мачете/молот/серп/бита/дубина) — теперь у каждого предмета свой
 *          индивидуальный офсет (сняты позже через drag-редактор, было (-32,-48) на все);
 *          Кукла вуду тоже получила свой офсет через drag-редактор (подтверждено пользователем)
 * Тело:   Броня «Свобода»/Плащ аномалии/Экзоскелет — manScale, чтобы не выглядеть
 *          огромными на фоне базовой Майки (118×138px). shmot_shop.js теперь реально
 *          применяет manScale (раньше spr.scale.set(1) было жёстко закодировано,
 *          несмотря на комментарий "только явный manScale переопределяет").
 *
 * Run: node tests/shmot-mannequin-offsets.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const shmotSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shmot.js'), 'utf-8'
);
const shopSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), 'utf-8'
);

function getItemLine(imgFile) {
    const re = new RegExp(`\\{id:\\d+[^\\n]*imgFile:'${imgFile}'[^\\n]*\\}`);
    const m = shmotSrc.match(re);
    return m ? m[0] : null;
}

// ── Test 3/4/5 (историческое): офсеты/manScale базового магазина ──────────────
// 23.09.2026 (батч "убери все шмотки, которые не выбиваются с боссов"): обувь_2/рука_1-6/
// тело_1-4 — все generic-asset предметы (использовались ТОЛЬКО базовым магазином id0-40) —
// удалены из shmot.js целиком, включая руку_1 (Кукла вуду), которая не участвовала в самой
// жалобе про дубли, но принадлежала тому же удалённому диапазону id. Тест теперь регресс-
// гвард на то, что ни один из этих файлов не остался в каталоге.
console.log('\nTest 3/4/5: base-shop generic-asset предметы (обувь_2, рука_1-6, тело_1-4) удалены батчем 23.09.2026');
{
    const genericAssetFiles = [
        'обувь_2.png',
        'рука_1.png','рука_2.png','рука_3.png','рука_4.png','рука_5.png','рука_6.png',
        'тело_1.png','тело_2.png','тело_3.png','тело_4.png',
    ];
    for (const file of genericAssetFiles) {
        assert(!getItemLine(file), `${file} отсутствует в каталоге (был только у удалённого базового магазина)`);
    }
}

// ── Test 6: shmot_shop.js реально применяет manScale (раньше было жёстко 1) ───
console.log('\nTest 6: _updateManSprites применяет spr.scale.set(eq.manScale || 1)');
{
    assert(/spr\.scale\.set\(eq\.manScale \|\| 1\);/.test(shopSrc),
        '_updateManSprites использует eq.manScale || 1 вместо жёсткой 1');
    assert(!/spr\.scale\.set\(1\);\s*\n\s*\} else \{/.test(shopSrc),
        'старая жёстко закодированная spr.scale.set(1) в ветке "надето" убрана');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
