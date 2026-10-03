/**
 * Test: батч 22.09.2026 (по прямому указанию, живой репорт — "карточка локации снизу
 * обрезается невидимым блоком", воспроизводилось на Агропроме, редактор позиций подтвердил
 * маску карусели как границу обрезки) —
 *
 * Корень: CARD_SCALE=0.706 был единым множителем для ВСЕХ 5 карточек локаций, но исходники
 * разного роста (кордон/свалка/долина/янтарь — 311..317px, Агропром.png — 338px). При одном
 * scale=0.706 Агропром рендерится на 15-19px выше остальных (338*0.706=238.6 против
 * 311*0.706=219.6), и её нижняя строка ("НАГРАДА: ...") выходит за нижнюю границу маски
 * карусели (maskGfx, окно показа ровно 2 карточки), хотя у остальных 4 всё умещается.
 *
 * Фикс: масштаб каждой карточки считается ОТ РЕАЛЬНОЙ высоты её текстуры К единой целевой
 * видимой высоте CARD_TARGET_H (= 311*CARD_SCALE, снята с самого короткого исходника — он
 * заведомо помещается) — все 5 карточек оказываются ОДИНАКОВОЙ видимой высоты независимо от
 * разницы в native-размере файлов.
 *
 * 22.09.2026 (повторная правка того же дня, по прямому указанию — "сделай все карточки локаций
 * одним размером как на 1 картинке"): нормализация ТОЛЬКО высоты (пропорциональный scale)
 * оставляла разную ШИРИНУ — у исходников разное соотношение сторон (Агропром 4.0 против
 * ~4.25-4.35 у остальных). Заменено на фиксацию width И height независимо (CARD_TARGET_W=936,
 * снята через редактор позиций с эталонной карточки "кордон") — см.
 * zone-cards-uniform-size-and-respect-caption-style.test.js для полной сверки.
 *
 * Run: node tests/zone-card-per-texture-scale-normalization.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'zone_screen.js'), 'utf-8');

function pngSize(filePath){
    const buf = fs.readFileSync(filePath);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

console.log('\nTest 1: CARD_TARGET_H — единая целевая высота, снятая с самого короткого исходника (311px)');
{
    assert(/const CARD_TARGET_H = Math\.round\(311 \* CARD_SCALE\);/.test(src),
        'CARD_TARGET_H вычисляется от 311 (самый короткий из 5 исходников) и CARD_SCALE');
}

console.log('\nTest 2: масштаб карточки — фиксированные width И height (CARD_TARGET_W/H), не единый пропорциональный scale');
{
    assert(/const _applyCardScale = \(\) => \{ spr\.width = CARD_TARGET_W; spr\.height = CARD_TARGET_H; \};/.test(src),
        'width/height выставляются НЕЗАВИСИМО в CARD_TARGET_W/CARD_TARGET_H — игнорирует native-соотношение сторон текстуры');
    assert(!/spr\.scale\.set\(CARD_SCALE\);/.test(src),
        'старое "один scale на все карточки" (spr.scale.set(CARD_SCALE)) убрано');
    assert(!/spr\.scale\.set\(CARD_TARGET_H \/ spr\.texture\.height\)/.test(src),
        'промежуточная (тоже устаревшая) версия "scale только от высоты" тоже убрана — не оставляет разную ширину');
    assert(/if\(tex\.baseTexture\.valid\) _applyCardScale\(\);\s*\n\s*else tex\.baseTexture\.once\('loaded', _applyCardScale\);/.test(src),
        'масштаб применяется и сразу (текстура из кэша), и по факту загрузки (текстура ещё грузится) — не ловит текстуру 1x1 до загрузки');
}

console.log('\nTest 3: реальные размеры файлов подтверждают асимметрию — Агропром.png заметно выше остальных 4');
{
    const IMG_DIR = path.join(root, '_client', 'development', 'images');
    const heights = {};
    for(const f of ['кордон.png', 'свалка.png', 'долина.png', 'Агропром.png', 'янтарь.png']){
        heights[f] = pngSize(path.join(IMG_DIR, f)).height;
    }
    console.log('    высоты исходников:', JSON.stringify(heights));
    const others = ['кордон.png', 'свалка.png', 'долина.png', 'янтарь.png'].map(f => heights[f]);
    const maxOther = Math.max(...others);
    assert(heights['Агропром.png'] > maxOther,
        'Агропром.png (' + heights['Агропром.png'] + 'px) реально выше любой из остальных 4 карточек (макс ' + maxOther + 'px) — фикс не чинит несуществующую проблему');

    // При едином CARD_SCALE=0.706 разница в native-высоте напрямую превращалась бы в разницу
    // отображаемой высоты — именно это и вызывало обрезку нижней строки Агропрома маской.
    const CARD_SCALE = 0.706;
    const displayedIfUniform = heights['Агропром.png'] * CARD_SCALE;
    const displayedTarget    = Math.round(311 * CARD_SCALE);
    assert(displayedIfUniform - displayedTarget > 10,
        'без фикса Агропром рендерился бы минимум на 10px выше целевой высоты (реально: +' +
        Math.round(displayedIfUniform - displayedTarget) + 'px) — этого достаточно, чтобы вылезти за маску');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
