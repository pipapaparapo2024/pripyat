/**
 * Test: 26.09.2026, по прямому указанию — "для всех карт покера сделай так, чтобы
 * обрезались прозрачные отступы по сторонам (уже делается, dvor-poker-card-trim.js) и
 * чтобы была фиксированная высота 140 и ширина 86".
 *
 * Раньше и в раздаче (dvor-poker-screen.js._updatePokerCardVisual), и в анимации тасования
 * (dvor-poker-game.js) применялся ЕДИНЫЙ множитель scale (CARD_SCALE=1.036) к УЖЕ обрезанной
 * по содержимому текстуре (getTrimmedCardTexture). Так как у разных карт разная обрезанная
 * bbox (разное соотношение сторон после удаления каймы), один и тот же scale давал РАЗНЫЙ
 * итоговый spr.width/height — визуально карты выглядели неодинакового размера, хотя
 * теоретически должны совпадать.
 *
 * Фикс: spr.width/spr.height выставляются НАПРЯМУЮ в фиксированные 86×140 (независимое
 * растяжение по каждой оси), а не через единый scale.set(...) — гарантирует одинаковый
 * пиксельный размер для абсолютно любой карты, независимо от её персональной обрезки.
 *
 * Run: node tests/poker-card-fixed-86x140-size.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const screenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker-screen.js'), 'utf-8');
const gameSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker-game.js'), 'utf-8');

console.log('\nTest 1: dvor-poker-screen.js — CARD_W/CARD_H = 86/140 объявлены и используются в раздаче');
{
    assert(/const CARD_W = 86, CARD_H = 140;/.test(screenSrc), 'константы фиксированного размера карты объявлены (86×140)');
    const start = screenSrc.indexOf('proto._updatePokerCardVisual');
    const body = screenSrc.slice(start, start + 1200);
    assert(/spr\.width = CARD_W; spr\.height = CARD_H;/.test(body),
        '_updatePokerCardVisual применяет фиксированные width/height, а не scale.set(CARD_SCALE)');
    assert(!/spr\.scale\.set\(CARD_SCALE\);/.test(body),
        'старое единое масштабирование убрано из отображения реальной карты');
}

console.log('\nTest 2: dvor-poker-game.js — та же фиксированная 86×140 в анимации тасования');
{
    const start = gameSrc.indexOf("const tex = PIXI.Texture.from(this._getCardImgPath(rr, rs));");
    const body = gameSrc.slice(start, start + 1500);
    assert(/const CARD_W = 86, CARD_H = 140;/.test(body), 'константы 86×140 объявлены в тасовке');
    assert(/spr\.width = CARD_W; spr\.height = CARD_H;/.test(body),
        'applySize() тасовки использует фиксированные width/height');
    assert(!/spr\.scale\.set\(CARD_SCALE\);/.test(body),
        'старое единое масштабирование убрано из анимации тасования');
}

console.log('\nTest 3: обрезка по содержимому (getTrimmedCardTexture) по-прежнему подключена в обоих местах');
{
    assert(/getTrimmedCardTexture\(tex, \(trimmedTex\) => \{/.test(screenSrc), 'обрезка карты в раздаче сохранена');
    assert(/getTrimmedCardTexture\(tex, \(trimmedTex\) => \{/.test(gameSrc), 'обрезка карты в тасовке сохранена');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
