/**
 * Test: репорт 08.10.2026 — декоративная панель "слоты под оружие" (новый файл), координаты
 * уточнены ВТОРЫМ снимком редактора позиций в тот же день: X:369 Y:610 scale:1.012 (первый
 * снимок был x:369,y:690 — заменён). Требование — панель должна лежать ПОВЕРХ Spine-анимации
 * босса, то есть добавляться в win ПОСЛЕ _spineBossMount(win), а не до него.
 *
 * Второе требование того же дня — картинка нарисована на 8 визуальных ячеек, а боевых кнопок
 * оружия только 6 (нож/цепь/бита/мачете/ствол/автомат) — лишние 2 ячейки (справа, см. сверку
 * координат в комментарии у кода) обрезаются через PIXI.Texture.frame (реальный pixel-crop,
 * не squish-масштабирование всей картинки).
 *
 * Run: node tests/boss-fight-weapon-slots-panel-position.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(
    path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8'
);

console.log('\nTest 1: панель v2 создана с нужными координатами (второй снимок)');
{
    assert(/PIXI\.Texture\.from\(B \+ 'боевка слоты под оружие v2\.png'\)/.test(src),
        "спрайт-источник создан из файла 'боевка слоты под оружие v2.png'");
    assert(/wpnSlotsBg\.x\s*=\s*369;\s*wpnSlotsBg\.y\s*=\s*610;\s*wpnSlotsBg\.scale\.set\(1\.012\)/.test(src),
        'координаты x:369, y:610, scale:1.012 — второй (актуальный) снимок редактора позиций');
    assert(!/wpnSlotsBg\.y\s*=\s*690/.test(src),
        'старое значение y:690 (первый снимок) не осталось в коде');
}

console.log('\nTest 2: панель добавлена в Z-порядке ПОСЛЕ Spine-анимации (значит поверх неё)');
{
    const mountIdx = src.indexOf('this._spineBossMount(win);');
    const panelIdx = src.indexOf("wpnSlotsBg.x = 369");
    assert(mountIdx !== -1 && panelIdx !== -1, 'оба маркера найдены');
    assert(panelIdx > mountIdx, 'панель создаётся/добавляется ПОСЛЕ _spineBossMount(win) — лежит поверх анимации');
}

console.log('\nTest 3: лишняя 1 из 8 ячеек обрезается real pixel-crop, без лишних px справа');
{
    // 09.10.2026 (по прямому указанию — "справа обрежь ещё пикселей 6"): EXTRA_TRIM_PX 8 → 14.
    assert(/const TOTAL_CELLS = 8, VISIBLE_CELLS = 7, EXTRA_TRIM_PX = 14, RIGHT_RADIUS = 10/.test(src),
        'TOTAL_CELLS=8 / VISIBLE_CELLS=7 / EXTRA_TRIM_PX=14 (было 8, +6px по запросу) / RIGHT_RADIUS=10');
    assert(/const cropW = Math\.round\(bt\.width \* VISIBLE_CELLS \/ TOTAL_CELLS\) - EXTRA_TRIM_PX;/.test(src),
        'итоговая ширина кропа = 7/8 от нативной ширины минус EXTRA_TRIM_PX px справа');
    assert(/new PIXI\.Texture\(bt, new PIXI\.Rectangle\(0, 0, cropW, bt\.height\)\)/.test(src),
        'обрезка через PIXI.Texture + Rectangle(0,0,cropW,height) — реальный crop по пикселям, не sprite.width (squish)');
    assert(/if\(fullTex\.baseTexture\.valid\) _applyCrop\(\);\s*\n\s*else fullTex\.baseTexture\.once\('loaded', _applyCrop\)/.test(src),
        'обрезка применяется и для уже закэшированной текстуры (valid), и для ещё грузящейся (once loaded) — тот же паттерн, что в game-boot.js/dvor-poker-card-trim.js');
}

console.log('\nTest 4: правая кромка панели скруглена маской, левая остаётся прямой (родной край файла, не обрезался)');
{
    // 09.10.2026 (по прямому указанию — "сделай справа border-radius"): раньше drawRoundedRect()
    // скруглял ВСЕ 4 угла одним радиусом 4px (в т.ч. левые, которые не являются обрезом). Теперь
    // маска — ручной путь, скругляющий ТОЛЬКО правые 2 угла (искусственный crop-край).
    assert(!/slotsMask\.drawRoundedRect/.test(src), 'равномерный drawRoundedRect() убран — больше не скругляет левые углы');
    assert(/slotsMask\.moveTo\(0, 0\);/.test(src), 'путь стартует из левого верхнего угла (0,0) — левый край прямой');
    assert(/slotsMask\.lineTo\(cropW - RIGHT_RADIUS, 0\);/.test(src), 'верхняя грань идёт прямо до начала правого скругления');
    assert(/slotsMask\.arcTo\(cropW, 0, cropW, RIGHT_RADIUS, RIGHT_RADIUS\);/.test(src), 'верхний правый угол скруглён arcTo на RIGHT_RADIUS');
    assert(/slotsMask\.arcTo\(cropW, h, cropW - RIGHT_RADIUS, h, RIGHT_RADIUS\);/.test(src), 'нижний правый угол тоже скруглён arcTo на RIGHT_RADIUS');
    assert(/slotsMask\.lineTo\(0, h\);/.test(src), 'нижняя грань возвращается прямо к левому нижнему углу (0,h) — тоже без скругления');
    assert(/slotsMask\.closePath\(\);/.test(src), 'путь замкнут');
    assert(/wpnSlotsBg\.mask = slotsMask;/.test(src),
        'маска действительно применяется к панели слотов');
}

console.log('\nTest 4: новый файл добавлен в ранний преload-манифест (game-boot.js), не грузится впервые только при входе в бой');
{
    const bootSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'game-boot.js'), 'utf-8');
    assert(/'боевка слоты под оружие v2\.png'/.test(bootSrc),
        "'боевка слоты под оружие v2.png' присутствует в window._allGamePngs");
}

console.log('\nTest 5: список фоновых файлов боссов не повреждён (все 8 на местах, без опечаток)');
{
    // 10.10.2026 (по прямому указанию): Крыс/Баркут/Борода/Жгут откатились на старые (без "v2")
    // фоны боя — только эти 4, Охотник/Счастливчик/Ястреб/Меченный остались на v2.
    const EXPECTED_V2 = ['охотник','счастливчик','ястреб','меченный'];
    const EXPECTED_OLD = ['крыс','баркут','борода','жгут'];
    for (const name of EXPECTED_V2) {
        assert(new RegExp("'боевка с боссом " + name + " v2\\.png'").test(src),
            `файл фона для "${name}" присутствует в списке без опечаток (v2)`);
    }
    for (const name of EXPECTED_OLD) {
        assert(new RegExp("'боевка с боссом " + name + "\\.png'").test(src),
            `файл фона для "${name}" присутствует в списке без опечаток (откат на старый)`);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
