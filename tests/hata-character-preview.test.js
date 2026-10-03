/**
 * Test: превью локации (hata.js) не показывало персонажа — игрок видел пустую комнату
 * и не мог понять, как он будет выглядеть на фоне выбранной базы.
 *
 * Фикс: добавлен одетый персонаж (тело + надетые шмотки + кисти рук) — те же
 * manDx/manDy/manScale и та же раскладка слотов (Голова/Обувь/Штаны/Торс/Аксессуар/Рука),
 * что и на главном экране (home.js Home.updateClothes()), с теми же координатами (фон
 * здесь тоже 1280×604). _updateCharClothes() читает window.shmot.items и вызывается
 * из _render() при каждой смене/навигации по локациям.
 *
 * Run: node tests/hata-character-preview.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), 'utf-8'
);

// ── Test 1: персонаж (pers.png) добавлен в _build() ───────────────────────────
console.log('\nTest 1: персонаж создаётся в _build() с теми же координатами, что на home.js');
{
    assert(/const CHAR_DX = -224, CHAR_DY = -4;/.test(src), 'тот же сдвиг (-224,-4), что и в home.js для фона 1280×604');
    // 24.09.2026 (замена персонажа на всех 4 доп. экранах, по прямому указанию): hata.js тоже
    // переведён на новый файл персонажа — pers.png здесь больше не используется.
    assert(/const persSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/персонаж который сидит\.png'\)\);/.test(src),
        'создаётся спрайт "персонаж который сидит.png" (новая текстура после замены 24.09.2026)');
    assert(/persSpr\.x = 730 \+ CHAR_DX; persSpr\.y = 208 \+ CHAR_DY;/.test(src),
        'позиция персонажа = те же базовые координаты (730,208), что в home.js/shmot_shop.js, минус сдвиг');
    assert(/this\._persSpr = persSpr;/.test(src), 'ссылка сохранена как this._persSpr');
}

// ── Test 2: слоты одежды — та же раскладка/z-order, что на манекене и главном экране ──
console.log('\nTest 2: CHAR_SLOTS повторяет порядок z-index из shmot_shop.js/home.js');
{
    const m = src.match(/const CHAR_SLOTS = \[([\s\S]*?)\];/);
    assert(!!m, 'CHAR_SLOTS найден');
    if (m) {
        const catOrder = [...m[1].matchAll(/cat:\s*(\d+)/g)].map(x => +x[1]);
        assert(catOrder.length === 6, 'все 6 категорий присутствуют (Голова/Обувь/Штаны/Торс/Аксессуар/Рука)');
        const idxShoes = catOrder.indexOf(3), idxLegs = catOrder.indexOf(2), idxTorso = catOrder.indexOf(1);
        assert(idxShoes < idxLegs, 'Обувь (cat3) раньше Штанов (cat2) — Штаны рендерятся выше');
        assert(idxLegs < idxTorso, 'Штаны (cat2) раньше Торса (cat1) — Торс рендерится выше');
    }
    assert(/this\._charSlots = \{\}; this\._charSlotBases = \{\};/.test(src), 'слоты и их базовые координаты сохранены');
}

// ── Test 3: кисти рук поверх одежды (тот же паттерн, что и везде) ─────────────
console.log('\nTest 3: кисти рук добавлены после слотов одежды');
{
    assert(/rightHandSpr\.x = 862 - 8 \+ CHAR_DX; rightHandSpr\.y = 373 \+ CHAR_DY;/.test(src),
        'правая рука — та же формула координат, что в home.js/shmot_shop.js');
    assert(/leftHandSpr\.x = 756 \+ 2 \+ CHAR_DX; leftHandSpr\.y = 389 \+ CHAR_DY;/.test(src),
        'левая рука — та же формула координат');
}

// ── Test 4: _updateCharClothes() читает shmot.items и учитывает штаны_1-хак ──
console.log('\nTest 4: _updateCharClothes() зеркалит Home.updateClothes()');
{
    const m = src.match(/_updateCharClothes\(\)\{([\s\S]*?)\n\s{4}\}/);
    assert(!!m, '_updateCharClothes() найден');
    if (m) {
        const body = m[1];
        assert(/shmot\.items \|\| \[\]/.test(body), 'читает window.shmot.items (общий источник истины)');
        assert(/eq\.manDx \|\| 0/.test(body) && /eq\.manDy \|\| 0/.test(body), 'использует eq.manDx/manDy');
        assert(/eq\.manScale \|\| 1/.test(body), 'использует eq.manScale');
        assert(/eq\.imgFile === 'штаны_1\.png' \? -28 : 0/.test(body), 'учитывает спец-хак -28 для штаны_1.png');
    }
}

// ── Test 5: _render() вызывает _updateCharClothes() при каждой навигации ─────
console.log('\nTest 5: _render() обновляет персонажа при каждом рендере (переключении локации)');
{
    const m = src.match(/_render\(\)\{([\s\S]*?)this\._updateCharClothes\(\);/);
    assert(!!m, '_updateCharClothes() вызывается внутри _render()');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
