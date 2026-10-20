/**
 * Test: 18.10.2026 (два раунда правок, см. история ниже) — убрать старые фоновые подложки
 * верхней/нижней FLA-панели, которые остались видны поверх новых HUD-виджетов.
 *
 * Раунд 1 (снимок редактора позиций): два элемента "interface_elements_atlas_1.png" без
 * координат в коде (x:-33,y:-199,w:1280,h:158 — "нога", вылезающая в игровую зону сверху;
 * x:1,y:157,w:1306,h:73 — серый прямоугольник снизу). Фикс — _removeStrayAtlasArt(container),
 * обходил ПРЯМЫХ детей контейнера, матчил по URL+размеру, удалял.
 *
 * Раунд 2 (баг найден по прямому указанию — "серый прямоугольник остался, нижний худ старый
 * ещё в проекте?"): фикс раунда 1 не сработал. Реальные имена спрайтов — прочитаны прямо из
 * _client/development/images/interface_elements_atlas_1.json (frames{}): `interface_up_panel_bg`
 * (1306×73) и `interface_down_panel_bg` (1280×158) — это фоновые ПОДЛОЖКИ ЦЕЛЫХ старых панелей,
 * которые PIXI.animate оборачивает в собственный MovieClip-контейнер — значит они НЕ прямые дети
 * this.up/this.down, а вложены на уровень (или больше) глубже. Плоский обход их не видел.
 * Обход переписан РЕКУРСИВНЫМ (тот же принцип, что уже использует _uCollectAt() в
 * universal_pos_editor.js — он эти спрайты находил), удаление — у РЕАЛЬНОГО родителя найденного
 * спрайта (child.parent), не у верхнего переданного container.
 *
 * Run: node tests/interface-stray-atlas-art-removal.test.js
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface.js'), 'utf-8');

console.log('\nTest 1: метод объявлен и вызывается для this.up (upInit) и this.down (downInit)');
{
    assert(/_removeStrayAtlasArt\(container\)\{/.test(src), '_removeStrayAtlasArt(container) объявлен на прототипе');
    assert(/this\._removeStrayAtlasArt\(this\.up\);/.test(src), 'вызван для this.up');
    assert(/this\._removeStrayAtlasArt\(this\.down\);/.test(src), 'вызван для this.down');
    const upCallIdx = src.indexOf('this._removeStrayAtlasArt(this.up);');
    const widgetIdx = src.indexOf('this._buildTopCurrencyWidget();');
    assert(upCallIdx !== -1 && widgetIdx !== -1 && upCallIdx < widgetIdx,
        'чистка this.up вызвана до _buildTopCurrencyWidget()');
}

// Общая функция извлечения тела метода — переиспользуется в тестах 2 и 3.
function extractFn(){
    // \r?\n — в этом месте interface.js построчные окончания CRLF (остальной файл — LF).
    const m = src.match(/_removeStrayAtlasArt\(container\)\{[\s\S]*?\r?\n\t\}\r?\n/);
    if(!m) return null;
    return 'function _removeStrayAtlasArt' + m[0].slice('_removeStrayAtlasArt'.length);
}

class FakeSprite {
    constructor(texture, width, height){
        this.texture = texture;
        this.width = width;
        this.height = height;
        this.parent = null;
        this.children = null; // Sprite — лист дерева, как и в реальном PIXI
    }
}
class FakeContainer {
    constructor(name){
        this.name = name;
        this.children = [];
        this.parent = null;
    }
    addChild(c){ c.parent = this; this.children.push(c); return c; }
    removeChild(c){ this.children = this.children.filter(x => x !== c); c.parent = null; }
}
const mkTex = (url) => ({ baseTexture: { resource: { url } } });

console.log('\nTest 2: реальное исполнение логики — удаляет ТОЛЬКО совпадающие по URL+размеру спрайты (прямые дети)');
{
    const fnSrc = extractFn();
    assert(!!fnSrc, 'тело метода извлечено регэкспом для исполнения в песочнице');

    const sandbox = { PIXI: { Sprite: FakeSprite }, console };
    vm.createContext(sandbox);
    vm.runInContext(fnSrc, sandbox);

    const strayFoot      = new sandbox.PIXI.Sprite(mkTex('./images/interface_elements_atlas_1.png'), 1280, 158);
    const strayGrey       = new sandbox.PIXI.Sprite(mkTex('./images/interface_elements_atlas_1.png'), 1306, 73);
    const sameUrlDiffSize = new sandbox.PIXI.Sprite(mkTex('./images/interface_elements_atlas_1.png'), 62, 58);
    const sameSizeDiffUrl = new sandbox.PIXI.Sprite(mkTex('./images/верхний худ фон полоса.png'), 1280, 158);
    const otherAtlas      = new sandbox.PIXI.Sprite(mkTex('./images/interface_elements_atlas_2.png'), 1280, 158);
    const notASprite      = { width: 1280, height: 158 };

    const container = new FakeContainer('root');
    [strayFoot, strayGrey, sameUrlDiffSize, sameSizeDiffUrl, otherAtlas, notASprite].forEach(c => container.addChild(c));

    sandbox._removeStrayAtlasArt(container);

    assert(!container.children.includes(strayFoot), 'совпадение 1280×158 на атласе удалено ("нога"/interface_down_panel_bg)');
    assert(!container.children.includes(strayGrey), 'совпадение 1306×73 на атласе удалено (серый прямоугольник/interface_up_panel_bg)');
    assert(container.children.includes(sameUrlDiffSize), 'тот же атлас, другой размер — НЕ тронут');
    assert(container.children.includes(sameSizeDiffUrl), 'тот же размер, другой файл — НЕ тронут');
    assert(container.children.includes(otherAtlas), 'другой атлас (_2) — НЕ тронут');
    assert(container.children.includes(notASprite), 'не-Sprite объект — не падает, остаётся');
    assert(container.children.length === 4, 'итоговое число детей: 6 − 2 удалённых = 4');
}

console.log('\nTest 3: ВЛОЖЕННЫЕ спрайты (внутри под-MovieClip, не прямые дети) тоже находятся и удаляются — это и есть фикс раунда 2');
{
    const fnSrc = extractFn();
    const sandbox = { PIXI: { Sprite: FakeSprite }, console };
    vm.createContext(sandbox);
    vm.runInContext(fnSrc, sandbox);

    // Имитация реальной структуры: this.down (root) → "down_panel_mc" (безымянный MovieClip-
    // контейнер, как заворачивает PIXI.animate) → interface_down_panel_bg (сам Sprite, глубина 2).
    const root2 = new FakeContainer('this.down');
    const wrapperMc = new FakeContainer('down_panel_mc'); // имитация обёртки MovieClip
    root2.addChild(wrapperMc);
    const nestedStray = new sandbox.PIXI.Sprite(mkTex('./images/interface_elements_atlas_1.png'), 1280, 158);
    wrapperMc.addChild(nestedStray);
    // Контроль: вложенный спрайт ДРУГОГО размера рядом — не должен быть тронут.
    const nestedKeep = new sandbox.PIXI.Sprite(mkTex('./images/interface_elements_atlas_1.png'), 40, 40);
    wrapperMc.addChild(nestedKeep);

    sandbox._removeStrayAtlasArt(root2);

    assert(!wrapperMc.children.includes(nestedStray),
        'спрайт, вложенный на 2 уровня глубже (не прямой ребёнок), найден и удалён у СВОЕГО реального родителя');
    assert(wrapperMc.children.includes(nestedKeep), 'вложенный спрайт другого размера — не тронут');
    assert(wrapperMc.parent === root2, 'сама обёртка-контейнер (wrapperMc) не удаляется — удалён только совпавший Sprite внутри неё');
}

console.log('\nTest 4: пустой/отсутствующий контейнер не роняет вызов (defensive guard)');
{
    const fnSrc = extractFn();
    class EmptySprite {}
    const sandbox = { PIXI: { Sprite: EmptySprite }, console };
    vm.createContext(sandbox);
    vm.runInContext(fnSrc, sandbox);
    let threw = false;
    try{
        sandbox._removeStrayAtlasArt(null);
        sandbox._removeStrayAtlasArt(undefined);
        sandbox._removeStrayAtlasArt({});
    } catch(e){ threw = true; }
    assert(!threw, 'null/undefined/без children — не бросает исключение');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
