/**
 * Test: найдено 24.09.2026 по живому репорту (со скриншотом попапа "ТОРМОЗИ! ОРУЖИЯ НЕТУ У
 * ТЕБЯ, ЕГО НУЖНО КУПИТЬ!") — пользователь ранее просил перевести кнопки поп-апов confirm/
 * cancel с прямоугольных хит-зон на параллелограммные (makeParallelogramHit,
 * popup-hit-shapes.js — уже применён в confirm.js/sound.js/nick.js), но именно этот попап
 * (bosses_fight.js._openNoWeaponPopup) пропустили — КУПИТЬ/ОТМЕНА там всё ещё ловили клик
 * прямоугольником (PIXI.Graphics.drawRect), не совпадающим со скошенной формой кнопки на
 * фоновой картинке "не хватает оружия.png".
 *
 * Run: node tests/no-weapon-popup-parallelogram-hitzones.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client/src/game/shell/overlays/bosses_fight.js'), 'utf-8');

console.log('\nTest: bosses_fight.js импортирует makeParallelogramHit');
{
    assert(/import \{ makeParallelogramHit \} from '\.\.\/popups\/popup-hit-shapes\.js';/.test(src),
        'import makeParallelogramHit добавлен из shell/popups/popup-hit-shapes.js');
}

console.log('\nTest: _openNoWeaponPopup() — КУПИТЬ и ОТМЕНА используют параллелограммные хит-зоны, не прямоугольник');
{
    const start = src.indexOf('proto._openNoWeaponPopup = function(){');
    const end   = src.indexOf('\n    };', start);
    const body  = src.slice(start, end);
    assert(!!body && start !== -1, '_openNoWeaponPopup() найден');

    // 26.09.2026 (по прямому указанию, повторный снимок редактора позиций): хитбокс сдвинут
    // отдельно от самой кнопки-картинки (было 423,389,197,43, завязано на одни числа с кнопкой).
    assert(/const hitBuy = makeParallelogramHit\(win, 442, 388, 219, 36, 18\);/.test(body),
        'hitBuy — makeParallelogramHit с новыми координатами/размером (442,388,219,36) и slant=18 (как везде в игре)');
    assert(/const hitCancel = makeParallelogramHit\(win, 666, 388, 219, 36, 18\);/.test(body),
        'hitCancel — makeParallelogramHit с уточнёнными координатами/размером (666,388,219,36 — 28.09.2026, редактор позиций) и slant=18');

    assert(!/hitBuy\.drawRect/.test(body), 'hitBuy больше не рисует прямоугольник вручную');
    assert(!/hitCancel\.drawRect/.test(body), 'hitCancel больше не рисует прямоугольник вручную');

    assert(/hitBuy\.on\('pointerdown', \(\)=>\{ _flash\(купитьActiv/.test(body), 'обработчик клика КУПИТЬ сохранён без изменений');
    assert(/hitCancel\.on\('pointerdown', \(\)=>\{ _flash\(отменаActiv/.test(body), 'обработчик клика ОТМЕНА сохранён без изменений');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
