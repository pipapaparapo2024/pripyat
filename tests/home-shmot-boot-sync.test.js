/**
 * Test: персонаж на главном меню оставался голым при первой загрузке игры, даже если
 * шмотки давно были надеты и сохранены.
 *
 * Причина: home.init() рисует персонажа и сразу вызывает updateClothes() СИНХРОННО в
 * начале загрузки (index/load-sequence.js), а модуль shmot грузится в фоне на несколько
 * секунд позже (_bgModules, стартует через 4000мс после показа игры). В момент, когда
 * home.init() вызывает updateClothes(), window.shmot ещё не существует — функция тихо
 * выходит по условию (!window.shmot), и НИЧТО не вызывает её повторно позже. Персонаж
 * так и оставался голым, пока игрок сам что-то не переодевал в магазине (что уже вызывает
 * updateClothes() из shmot_shop.js).
 *
 * Экран «База» дублирует ту же логику (см. hata.js), но строит своего персонажа заново
 * КАЖДЫЙ раз при открытии экрана — к тому моменту shmot уже готов, поэтому там персонаж
 * всегда одет правильно, что и делало баг заметным именно на главном меню.
 *
 * Фикс: constructShmot() (module_control.js) — момент, когда window.shmot гарантированно
 * готов — сразу вызывает home.updateClothes(), досылая актуальную отрисовку.
 *
 * Run: node tests/home-shmot-boot-sync.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'modules', 'module_control.js'), 'utf-8'
);

console.log('\nTest 1: constructShmot() досылает home.updateClothes() сразу после создания shmot');
{
    const m = src.match(/constructShmot\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'constructShmot найден');
    if (m) {
        const body = m[1];
        assert(/window\.shmot = new Shmot\(this\.names\['shmot'\]\);/.test(body), 'shmot создаётся как раньше');
        assert(/if\(window\.home\) home\.updateClothes\(\);/.test(body),
            'сразу после создания shmot вызывается home.updateClothes() — персонаж на главном экране обновится, как только shmot готов');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
