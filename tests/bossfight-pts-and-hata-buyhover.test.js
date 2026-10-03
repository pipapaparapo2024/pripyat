/**
 * Test: две позиционные правки.
 *
 * 1) bosses_fight.js — тексты ОЧКИ (_bossFightPtsTxt) и НОВЫЕ (_bossFightNewTxt)
 *    сдвинуты вправо: НОВЫЕ на +14px (1202→1216), ОЧКИ на +14+6=+20px (1056→1076).
 *
 * 2) hata.js — оверлей "купить актив" (buyHover) раньше растягивался на весь экран
 *    (0,0,1280,720) и при hover вылезал в случайном месте (картинка задумана под
 *    другой попап). Теперь его позиция/размер точно совпадают с кнопкой
 *    "купить пассив" (btnBuy): центр 645,566, размер 132×24.
 *
 * Run: node tests/bossfight-pts-and-hata-buyhover.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const bossFightSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8'
);
const hataSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), 'utf-8'
);

// ── Test 1: ОЧКИ/НОВЫЕ — УСТАРЕЛО (20.09.2026) ────────────────────────────────
// Раньше ptsTxt/newTxt.x были захардкожены (1076/1216). Пользователь прислал реальные подложки
// («табличка под очки.png» / «круг под новые очки.png») — теперь позиция считается как центр
// подложки (PTS_BG/NEW_BG), не хардкодом. Актуальный тест — boss-fight-points-badges-centered-text.test.js.
console.log('\nTest 1: позиции ptsTxt (ОЧКИ) и newTxt (НОВЫЕ) считаются как центр присланных подложек');
{
    // 04.10.2026: центрирование относительно подложки заменено явными координатами редактора
    // позиций — см. boss-fight-points-badges-centered-text.test.js для полной проверки.
    assert(/ptsTxt\.x = 1080; ptsTxt\.y = 639; ptsTxt\.scale\.set\(1\.521\);/.test(bossFightSrc),
        'ptsTxt позиционируется по явным координатам (см. boss-fight-points-badges-centered-text.test.js)');
    assert(/newTxt\.x = 1220; newTxt\.y = 639; newTxt\.scale\.set\(1\.521\);/.test(bossFightSrc),
        'newTxt позиционируется по явным координатам (см. boss-fight-points-badges-centered-text.test.js)');
}

// ── Test 2: buyHover в hata.js — УСТАРЕЛО (25.09.2026) ────────────────────────
// buyHover ("купить актив.png") убран целиком по прямому указанию — при наведении на КУПИТЬ
// показывался непонятный прямоугольный файл вместо простого затемнения кнопки, как везде.
// Актуальный тест — hata-buy-button-standard-hover-theme.test.js.
console.log('\nTest 2: buyHover убран из hata.js целиком (был файл-оверлей, заменён на стандартное alpha-затемнение)');
{
    assert(!/const buyHover = new PIXI\.Sprite/.test(hataSrc), 'buyHover больше не создаётся — см. hata-buy-button-standard-hover-theme.test.js');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
