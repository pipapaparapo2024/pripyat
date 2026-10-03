/**
 * Test: 04.10.2026, по прямому указанию.
 *
 * 1) "на вкладке открытые сумки в покере сделай все подписи, все цифры белым шрифтом" —
 *    dvor-poker-bag.js._openPokerBagOpenedScreen().AMT_STYLE (применяется ко всем суммам
 *    exp/cig/stash/coins и к полю тату) был fill:'#000000' (поставлен 03.10.2026 по ОБРАТНОМУ
 *    указанию "сделать чёрным") — теперь снова '#ffffff'.
 *
 * 2) "новый файл заливка желтыя уровень покера.png — будет служить полоской опыта для игры в
 *    покер по координатам x:511 y:113, логика такая же как заполнение уровня других вкладках":
 *    dvor-poker-screen.js — плоский Graphics-прямоугольник (0xbd7101) заменён на текстурный
 *    спрайт того же паттерна "текстура + растущая маска", что уже используют зарики/блэкджек
 *    (dvor-dice-screen.js/dvor-dice.js). Маска растёт по доле прогресса (lvl.cur/lvl.next),
 *    так же как раньше рос плоский прямоугольник — see dvor-poker-screen.js._updatePokerUI().
 *
 * Run: node tests/poker-bag-opened-white-text-and-level-bar-asset.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bagJs    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker-bag.js'), 'utf-8');
const screenJs = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker-screen.js'), 'utf-8');
const assetPath = path.join(root, '_client', 'development', 'images', 'заливка желтыя уровень покера.png');

console.log('\nTest 1: AMT_STYLE экрана "открытая сумка покера" снова белый, не чёрный');
{
    const start = bagJs.indexOf('_openPokerBagOpenedScreen');
    const end = bagJs.indexOf('_addAmt(\'+\' + exp', start);
    const body = bagJs.slice(start, end);
    assert(/const AMT_STYLE = \{[\s\S]*?fill:'#ffffff'/.test(body), 'AMT_STYLE.fill === #ffffff');
    assert(!/fill:'#000000'/.test(body), 'чёрный fill убран из блока открытой сумки');
}

console.log('\nTest 2: новый ассет заливки уровня покера скопирован в dev images');
{
    assert(fs.existsSync(assetPath), 'файл "заливка желтыя уровень покера.png" существует в _client/development/images/');
}

console.log('\nTest 3: полоска уровня покера строится текстурным спрайтом на x:511 y:113, замаскированным');
{
    assert(screenJs.includes("new PIXI.Sprite(PIXI.Texture.from('./images/заливка желтыя уровень покера.png'))"),
        'barFillImg создаётся из нового файла');
    assert(/barFillImg\.x = 511; barFillImg\.y = 113;/.test(screenJs), 'позиция x:511 y:113 задана явно');
    assert(/barFillImg\.mask = barFill;/.test(screenJs), 'заливка замаскирована тем же Graphics-объектом barFill');
    assert(!/this\._pokerExpBarFill\.beginFill\(0xbd7101\)/.test(screenJs), 'старая плоская заливка (0xbd7101) убрана');
}

console.log('\nTest 4: _updatePokerUI() заполняет маску по той же доле прогресса, что и раньше');
{
    const start = screenJs.indexOf('proto._updatePokerUI');
    const end = screenJs.indexOf('if(this._pokerLvlIcons)', start);
    const body = screenJs.slice(start, end);
    assert(/const ratio = lvl\.maxed \? 1 : \(lvl\.next > 0 \? Math\.min\(1, lvl\.cur \/ lvl\.next\) : 0\);/.test(body),
        'формула доли прогресса (cur/next, с учётом maxed) не изменилась');
    assert(/this\._pokerExpBarFill\.drawRect\(511, 113, fw, 9\)/.test(body), 'маска рисуется на тех же координатах, что и сама заливка');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
