/**
 * Test: 26.10.2026 — фича "Заначки", клиентская панель (_client/src/game/svod/svod-zanachki.js).
 * РЕАЛЬНОЕ исполнение (не grep) методов, которые решают, что показать игроку на основе
 * состояния с сервера — тот же приём vm.runInContext + минимальные стабы PIXI/window, что
 * tests/boss-rating-audio-regressions.test.js (см. AGENTS.md "Тестовые образцы по стилю").
 * Не строит весь экран (_buildZanachkiPanel создаёt ~360 спрайтов — незачем ради этого теста),
 * только зовёт _zanachkiApplyWishlistTextures()/_zanachkiRefreshClaims()/_zanachkiRefreshHeader()
 * на вручную собранном fake-объекте с нужными полями.
 *
 * Run: node tests/svod-zanachki-panel.test.js
 */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

let passed = 0, failed = 0;
function check(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

let src = read('_client/src/game/svod/svod-zanachki.js');
// vm-контекст не резолвит ES-модули — убираем import (applyPatch/scheduleFontRedraw здесь не
// нужны для тестируемых методов, они их не вызывают) и превращаем export function в обычную
// function, тот же приём, что в boss-rating-audio-regressions.test.js.
// 28.10.2026 (тест найден сломанным при прогоне — после того как в файле появился ВТОРОЙ import
// (scheduleFontRedraw), regex без флага /g вырезал только первую строку import, вторая оставалась
// в исходнике и падала с "Cannot use import statement outside a module"): добавлен флаг /g —
// вырезает ЛЮБОЕ число import-строк, не только первую.
src = src.replace(/^import .*$/gm, '').replace('export function attachSvodZanachki', 'function attachSvodZanachki');

function makeTexture(name){ return { _name: name }; }

const ctx = {
    window: { isMobile: false },
    PIXI: {
        Texture: { from: (p) => makeTexture(p) },
        Sprite: function(tex){ this.texture = tex; this.x=0; this.y=0; this.width=10; this.height=10; this.anchor={set(){}}; this.scale={set(){}}; this.interactive=false; this.buttonMode=false; this.alpha=1; this.on=function(){}; },
        Text: function(text, style){ this.text = text; this.style = style; this.x=0; this.y=0; this.anchor={set(){}}; },
        Container: function(){ this.children=[]; this.addChild=function(c){ this.children.push(c); }; this.x=0; this.y=0; this.visible=true; },
        Graphics: function(){ this.beginFill=function(){return this;}; this.drawRect=function(){return this;}; this.endFill=function(){return this;}; this.interactive=false; },
    },
    console,
    helper: { touchPad(){} },
    root: { layer2_mc: { addChild(){} } },
};
vm.createContext(ctx);
vm.runInContext(src, ctx);

// attachSvodZanachki навешивает методы на proto — используем plain-объект как "this" экрана.
const proto = {};
ctx.attachSvodZanachki(proto);

console.log('\nTest 1: _zanachkiRefreshClaims() — кнопка "Забрать" активна строго по полноте набора (расходуемая механика)');
{
    // 27.10.2026 (по прямому указанию — "забираться должны они не все, сделать расходуемой"):
    // раньше claimed[col]=true блокировало повторный клейм навсегда — теперь клейм СПИСЫВАЕТ
    // карты и доступен повторно, пока набор снова полон. claimed используется только для
    // заголовка (сколько коллекций забирались хотя бы раз), не для разблокировки кнопки.
    const screen = Object.create(proto);
    screen._zanachkiClaimBtns = {
        1: new ctx.PIXI.Sprite(null),  // полный набор, никогда не забирали — активна
        2: new ctx.PIXI.Sprite(null),  // неполный набор — неактивна
        3: new ctx.PIXI.Sprite(null),  // полный набор, УЖЕ забирали раньше — ВСЁ РАВНО активна
    };
    screen._zanachkiState = {
        stashData: {
            1: {1:1,2:1,3:1,4:1,5:1,6:1,7:1},
            2: {1:1,2:0,3:1,4:1,5:1,6:1,7:1},
            3: {1:1,2:1,3:1,4:1,5:1,6:1,7:1},
        },
        claimed: { 3: true },
        wishlist: [],
    };
    proto._zanachkiRefreshClaims.call(screen);
    check(screen._zanachkiClaimBtns[1]._enabled === true && screen._zanachkiClaimBtns[1].interactive === true, 'коллекция 1 (полная, не забрана) — кнопка активна');
    check(screen._zanachkiClaimBtns[2]._enabled === false, 'коллекция 2 (неполная) — кнопка НЕ активна');
    check(screen._zanachkiClaimBtns[3]._enabled === true, 'коллекция 3 (полная, уже когда-то забрана) — кнопка ВСЁ РАВНО активна (расходуемая, не одноразовая)');
    check(screen._zanachkiClaimBtns[3].alpha === 1, 'коллекция 3 не затуманена — claimed больше не влияет на вид доступной кнопки');
}

console.log('\nTest 2: _zanachkiApplyWishlistTextures() — переключение "Запросить" <-> "В запросе" по состоянию wishlist');
{
    const screen = Object.create(proto);
    screen._zanachkiReqSprites = {
        '1_1': new ctx.PIXI.Sprite(null),
        '1_2': new ctx.PIXI.Sprite(null),
    };
    screen._zanachkiState = { stashData: {}, claimed: {}, wishlist: [{col:1,pos:1}] };
    proto._zanachkiApplyWishlistTextures.call(screen);
    check(screen._zanachkiReqSprites['1_1']._requested === true, 'карточка 1_1 (в wishlist) помечена _requested=true');
    check(screen._zanachkiReqSprites['1_1'].interactive === false, 'карточка 1_1 (в wishlist) больше не кликабельна (нельзя запросить повторно)');
    check(screen._zanachkiReqSprites['1_1'].texture._name.includes('в запросе'), 'карточка 1_1 получила текстуру "в запросе"');
    check(screen._zanachkiReqSprites['1_2']._requested === false, 'карточка 1_2 (НЕ в wishlist) не помечена _requested');
    check(screen._zanachkiReqSprites['1_2'].interactive === true, 'карточка 1_2 (НЕ в wishlist) кликабельна — можно запросить');
    check(screen._zanachkiReqSprites['1_2'].texture._name.includes('запросить'), 'карточка 1_2 получила текстуру "запросить"');
}

console.log('\nTest 3: _zanachkiRefreshHeader() — счётчик "Собрано коллекций N/M" показывает "N / 15"');
{
    // 27.10.2026 (по прямому указанию — "текст Собрано коллекции и счётчик это два разных
    // блока"): поле переименовано _zanachkiBigTxt → _zanachkiCountTxt, формат текста вырос с
    // голого "N" до "N / 15" (подпись "Собрано коллекций:" теперь отдельный статичный блок,
    // не обновляется этим методом).
    const screen = Object.create(proto);
    screen._zanachkiCountTxt = new ctx.PIXI.Text('0', {});
    screen._zanachkiState = { stashData: {}, claimed: {3:true, 7:true}, wishlist: [], collectedCount: 2 };
    proto._zanachkiRefreshHeader.call(screen);
    check(screen._zanachkiCountTxt.text === '2 / 15', 'заголовок показывает "2 / 15", получено ' + screen._zanachkiCountTxt.text);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed (реальное исполнение JS через vm)`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
