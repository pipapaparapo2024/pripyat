/**
 * Test: 29.09.2026, по прямому указанию (скриншот с красной стрелкой на звёздочку рядом с
 * галочкой "+1" достижения) — "убери у неё чуть прозрачность ещё, сделай где-то 85 прозрачность
 * ... также это кол-во (число внутри звездочки) сдвинь вправо на 1px".
 *
 * Звезда с числом суммарных очков (звезда+заливка прогресса+starPtsTxt, svod-achievements.js)
 * рисовалась полностью непрозрачной (alpha по умолчанию 1). Теперь вся группа (основание,
 * цветная заливка прогресса, текст числа очков внутри) — alpha=0.85. Число очков (starPtsTxt)
 * дополнительно сдвинуто на +1px вправо относительно центра звезды (star.x + 1).
 *
 * Run: node tests/achievements-star-opacity-and-points-text-offset.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const achSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');

console.log('\nTest 1: star/starFill/starPtsTxt получают alpha=0.85 (85% непрозрачности) сразу при создании');
{
    const starIdx = achSrc.indexOf("const star = new PIXI.Sprite(PIXI.Texture.from(IMG + 'звездочка пустая.png'));");
    const starFillIdx = achSrc.indexOf("const starFill = new PIXI.Sprite(PIXI.Texture.from(IMG + 'звездочка фулл.png'));");
    const starPtsIdx = achSrc.indexOf("const starPtsTxt = new PIXI.Text(");
    assert(starIdx !== -1 && starFillIdx !== -1 && starPtsIdx !== -1, 'все три элемента звезды найдены в файле');

    const starBlock = achSrc.slice(starIdx, starFillIdx);
    const starFillBlock = achSrc.slice(starFillIdx, starFillIdx + 500);
    const starPtsBlock = achSrc.slice(starPtsIdx, starPtsIdx + 500);

    assert(/star\.alpha = 0\.85;/.test(starBlock), 'star.alpha = 0.85 (основание звезды)');
    assert(/starFill\.alpha = 0\.85;/.test(starFillBlock), 'starFill.alpha = 0.85 (цветная заливка прогресса)');
    assert(/starPtsTxt\.alpha = 0\.85;/.test(starPtsBlock), 'starPtsTxt.alpha = 0.85 (текст числа очков внутри звезды)');
}

console.log('\nTest 2: число очков внутри звезды (starPtsTxt.x) сдвинуто на +1px относительно центра звезды');
{
    assert(/starPtsTxt\.x = star\.x \+ 1; starPtsTxt\.y = star\.y;/.test(achSrc),
        'starPtsTxt.x = star.x + 1 (было star.x без сдвига)');
    assert(!/starPtsTxt\.x = star\.x; starPtsTxt\.y = star\.y;/.test(achSrc),
        'старая позиция без сдвига (starPtsTxt.x = star.x) больше не встречается');
}

console.log('\nTest 3: регресс-гвард — звезда всё ещё позиционируется/масштабируется как раньше (не задета правкой сверх задуманного)');
{
    assert(/star\.x = CARD_W - 60; star\.y = ICON_CENTER_Y;/.test(achSrc), 'позиция звезды (CARD_W-60, ICON_CENTER_Y) не изменилась');
    assert(/star\.scale\.set\(0\.75\);/.test(achSrc), 'масштаб звезды (0.75) не изменился');
    assert(/starFill\.x = star\.x; starFill\.y = star\.y;/.test(achSrc), 'заливка по-прежнему совмещена с основанием звезды (не сдвинута вместе с текстом)');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
