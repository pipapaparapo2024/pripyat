/**
 * Test: 28.10.2026, по прямому указанию (скриншоты сравнения с Photoshop) — "самодельный
 * текстурный блок" над аватаркой игрока (Зона → рекордсмен по уважению, Боссы → последний
 * победивший) искажал фото: обрезка держалась только на порядке addChild под декоративной
 * рамкой, без честного PIXI-клиппинга. Повёрнутое (-2°/-3°) квадратное фото физически торчало
 * за пределы окна рамки по углам. Фикс — настоящая PIXI.Graphics-маска (как avatarMask в
 * player_profile.js), позиционированная НЕ повёрнуто (окно рамки само не крутится).
 *
 * Run: node tests/zone-and-boss-avatar-mask-clipping.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\nTest 1: zone_screen.js — фото рекордсмена по уважению получило честную маску');
{
    const src = readSrc('_client/src/game/shell/overlays/zone_screen.js');
    assert(/const photoMask = new PIXI\.Graphics\(\);/.test(src), 'photoMask создаётся как PIXI.Graphics');
    assert(/photoMask\.drawRect\(-RESPECT_PHOTO_W \/ 2, -RESPECT_PHOTO_H \/ 2, RESPECT_PHOTO_W, RESPECT_PHOTO_H\);/.test(src),
        'маска — прямоугольник точного размера аватарки, центрированный в локальных координатах (anchor 0.5,0.5 у photoSpr)');
    assert(/photoMask\.x = photoSpr\.x; photoMask\.y = photoSpr\.y;/.test(src), 'маска позиционируется на тот же центр, что и photoSpr');
    assert(!/photoMask\.rotation/.test(src), 'маска НЕ повёрнута — окно рамки не крутится, наклонено только фото внутри');
    assert(/photoSpr\.mask = photoMask;/.test(src), 'маска реально назначена photoSpr.mask');
    assert(/g\.group\.addChild\(photoMask\);/.test(src), 'маска добавлена в тот же контейнер, что и фото (та же система координат)');
    assert(/this\._zoneRespectPhotos\.push\(\{ spr: photoMask, locIdx: l\.loc \}\);/.test(src),
        'маска зарегистрирована для очистки при повторном рендере (та же механика, что у photoSpr/amountTxt)');
}

console.log('\nTest 2: bosses_select.js — фото последнего победившего босса получило честную маску');
{
    const src = readSrc('_client/src/game/shell/overlays/bosses_select.js');
    assert(/const killerMask = new PIXI\.Graphics\(\);/.test(src), 'killerMask создаётся как PIXI.Graphics');
    assert(/killerMask\.drawRect\(-KILLER_W \/ 2, -KILLER_H \/ 2, KILLER_W, KILLER_H\);/.test(src),
        'маска — прямоугольник точного размера аватарки, центрированный (anchor/pivot у spr тоже центр)');
    assert(/killerMask\.x = spr\.x; killerMask\.y = spr\.y;/.test(src), 'маска позиционируется на тот же центр, что и spr');
    assert(!/killerMask\.rotation/.test(src), 'маска НЕ повёрнута — окно рамки не крутится, наклонено только фото внутри');
    assert(/spr\.mask = killerMask;/.test(src), 'маска реально назначена spr.mask');
    assert(/cardsContainer\.addChild\(killerMask\);/.test(src),
        'маска добавлена в тот же cardsContainer, что и spr (иначе съедет при скролле списка)');
}

console.log('\nTest 3: размеры аватарок обновлены (28.10.2026)');
{
    const zoneSrc = readSrc('_client/src/game/shell/overlays/zone_screen.js');
    assert(/const RESPECT_PHOTO_W = 115, RESPECT_PHOTO_H = 115;/.test(zoneSrc), 'Зона: 112×112 → 115×115');

    const bossSrc = readSrc('_client/src/game/shell/overlays/bosses_select.js');
    assert(/const KILLER_W = 110, KILLER_H = 110;/.test(bossSrc), 'Боссы: 106×106 → 110×110');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
