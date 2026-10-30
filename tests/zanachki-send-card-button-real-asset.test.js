/**
 * Test: 28.10.2026, по прямому указанию — пользователь прислал реальный ассет для кнопки
 * "ОТПРАВИТЬ" в попапе "Запрос друга в заначках" (svod-zanachki-wishlist.js, mode:'friend'),
 * заменяющий временную заглушку (переиспользованная плашка "заначки кнопка убрать.png" +
 * PIXI.Text "ДАТЬ" поверх неё, см. историю в самом файле). Серверная логика
 * (zanachki.giveCard()/ZanachkiModel::giveCard() — у меня -1, у друга +1, запись в его
 * wishlist удаляется) уже существовала и не менялась — только клиентский ассет/текстура.
 *
 * Файл переименован из общего "отправить.png" в "заначки кнопка отправить.png" во избежание
 * коллизии имён (см. AGENTS.md, раздел про коллизии ассетов-файлов — универсальные имена вроде
 * "отправить.png" легко случайно переиспользовать для другого экрана).
 *
 * Run: node tests/zanachki-send-card-button-real-asset.test.js
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

console.log('\nTest 1: файл ассета реально скопирован под namespaced-именем (не коллизионным "отправить.png")');
{
    const imgDir = path.join(root, '_client', 'development', 'images');
    assert(fs.existsSync(path.join(imgDir, 'заначки кнопка отправить.png')), '"заначки кнопка отправить.png" скопирован в development/images');
    assert(!fs.existsSync(path.join(imgDir, 'отправить.png')), 'универсальное имя "отправить.png" НЕ используется напрямую (коллизия исключена)');
}

console.log('\nTest 2: svod-zanachki-wishlist.js — mode:\'friend\' использует реальную текстуру, не заглушку');
{
    const src = readSrc('_client/src/game/svod/svod-zanachki-wishlist.js');
    assert(/const actionBtnFile = mode === 'own' \? 'заначки кнопка убрать\.png' : 'заначки кнопка отправить\.png';/.test(src),
        'actionBtnFile выбирает реальный ассет "отправить" для mode:friend, "убрать" для mode:own');
    assert(!/new PIXI\.Text\('ДАТЬ'/.test(src), 'временная текстовая накладка "ДАТЬ" удалена целиком');
    assert(!/giveLbl/.test(src), 'переменная-заглушка giveLbl больше не существует в коде');
}

console.log('\nTest 3: кнопка "ОТПРАВИТЬ" по-прежнему гейтится наличием хотя бы 1 копии карточки (owned > 0) — логика клика не затронута правкой ассета');
{
    const src = readSrc('_client/src/game/svod/svod-zanachki-wishlist.js');
    const elseStart = src.indexOf("} else {\n                // mode === 'friend'");
    assert(elseStart !== -1, 'ветка mode:friend найдена');
    const body = src.slice(elseStart, src.indexOf('\n        });', elseStart));
    assert(/if\(owned > 0\)\{/.test(body), 'интерактивность кнопки по-прежнему условна на owned > 0');
    assert(/actionBtn\.alpha = 0\.4;/.test(body), 'неактивная (owned=0) кнопка по-прежнему притушена');
    assert(/TS\.php\('zanachki\.giveCard', \{target_id: ctx\.targetId, collection_id: col, position: pos\}/.test(body),
        'клик по-прежнему шлёт zanachki.giveCard с теми же параметрами (серверная логика не менялась)');
}

console.log('\nTest 4: БАГ (найден по прямому указанию 28.10.2026, после деплоя — "нажимаем ОТПРАВИТЬ, ничего не происходит, потом экран заначек зависает") — applyPatch импортирован в файле');
{
    const src = readSrc('_client/src/game/svod/svod-zanachki-wishlist.js');
    assert(/^import \{ applyPatch \} from '\.\.\/\.\.\/modules\/patch\.js';/m.test(src),
        'applyPatch импортирован (раньше использовался БЕЗ импорта — ReferenceError при успешном ответе giveCard)');
    assert(/TS\.php\('zanachki\.giveCard', \{target_id: ctx\.targetId, collection_id: col, position: pos\}, \(e\) => \{[\s\S]{0,400}\}, \(err\) => \{/.test(src),
        'TS.php(zanachki.giveCard, ...) теперь передаёт 4-й (error) колбэк — раньше fail-ответ сервера был не из чего обработать');
}

console.log('\nTest 5: реальное исполнение (vm) — клик "ОТПРАВИТЬ" больше не падает ReferenceError и реально вызывает applyPatch; при ошибке сервера показывает уведомление, а не зависает молча');
{
    const vm = require('vm');
    let src = readSrc('_client/src/game/svod/svod-zanachki-wishlist.js');
    src = src.replace(/^import .*$\n?/gm, '');
    src = src.replace('export function attachSvodZanachkiWishlist', 'function attachSvodZanachkiWishlist');
    src += '\nmodule.exports = { attachSvodZanachkiWishlist };\n';

    function makeSprite(){
        const spr = {
            x: 0, y: 0, alpha: 1, visible: true, interactive: false, buttonMode: false,
            scale: { set(){} }, width: 10, height: 10, texture: { width: 10, height: 10, once(){} },
            _handlers: {},
            on(evt, fn){ this._handlers[evt] = fn; return this; },
        };
        return spr;
    }
    function makeContainer(){
        const c = makeSprite();
        c.children = [];
        c.addChild = (...kids) => { c.children.push(...kids); kids.forEach(k => { k.parent = c; }); return kids[0]; };
        c.removeChild = (k) => { c.children = c.children.filter(x => x !== k); };
        return c;
    }
    const PIXI = {
        Container: function(){ return makeContainer(); },
        Graphics: function(){ const g = makeContainer(); g.beginFill=()=>g; g.endFill=()=>g; g.lineStyle=()=>g; g.drawRect=()=>g; g.drawRoundedRect=()=>g; g.clear=()=>g; return g; },
        Sprite: function(tex){ const s = makeSprite(); s.texture = tex || s.texture; return s; },
        Text: function(text, style){ const t = makeSprite(); t.text = text; t.style = style; t.anchor = { set(){} }; return t; },
        Texture: { from: (url) => ({ url, width: 10, height: 10 }) },
    };

    let giveCardCalls = [];
    let notifyCalls = [];
    const TS = {
        php(method, params, onOk, onErr){
            if(method !== 'zanachki.giveCard') return;
            giveCardCalls.push({ params, onOk, onErr });
        },
    };
    let applyPatchCalls = [];
    function applyPatch(patch){ applyPatchCalls.push(patch); }
    const notify = { showResult(opts){ notifyCalls.push(opts); } };
    const root = { layer2_mc: { addChild(){} } };

    const sandbox = {
        console, PIXI, TS, applyPatch, notify, root,
        window: { isMobile: false, notify },
        helper: { touchPad(){} },
        module: { exports: {} },
    };
    vm.createContext(sandbox);
    sandbox.scheduleFontRedraw = () => {};
    vm.runInContext(readSrc('_client/src/modules/stash-count-layout.js').replace('export function','function'),sandbox);
    vm.runInContext(src, sandbox);
    const { attachSvodZanachkiWishlist } = sandbox.module.exports;

    const proto = {};
    attachSvodZanachkiWishlist(proto);
    const ctx = { targetId: 555, myOwnedCounts: { '1_1': 3 } };
    const win = proto._buildZanachkiWishlistPopup.call(proto, [{ col: 1, pos: 1 }], 'friend', ctx);

    assert(giveCardCalls.length === 0, 'клика ещё не было — giveCard пока не вызван');

    // Найти actionBtn (единственный Sprite с zanachki кнопка отправить.png) и кликнуть.
    const actionBtn = win.children.find(c => c.texture && c.texture.url && c.texture.url.includes('заначки кнопка отправить.png'));
    assert(!!actionBtn, 'actionBtn "ОТПРАВИТЬ" найден среди детей попапа');
    assert(typeof actionBtn._handlers.pointerdown === 'function', 'у actionBtn есть обработчик pointerdown');

    let threw = null;
    try { actionBtn._handlers.pointerdown(); } catch(e){ threw = e; }
    assert(threw === null, 'клик по "ОТПРАВИТЬ" НЕ бросает исключение (раньше — ReferenceError: applyPatch is not defined)');
    assert(giveCardCalls.length === 1, 'zanachki.giveCard реально вызван один раз');
    assert(typeof giveCardCalls[0].onErr === 'function', '4-й (error) колбэк передан в TS.php (раньше — undefined)');

    // Успешный ответ сервера — applyPatch реально вызывается.
    giveCardCalls[0].onOk({ patch: { stash_data: '{}' } });
    assert(applyPatchCalls.length === 1, 'applyPatch реально вызван с патчем из успешного ответа (не ReferenceError)');

    // Ошибка сервера (например код 98 — карточку уже забрали) — игрок видит уведомление, не тишину.
    giveCardCalls[0].onErr({ code: 98 });
    assert(notifyCalls.length === 1 && /Не удалось отправить/.test(notifyCalls[0].text),
        'при ошибке сервера показывается notify.showResult (раньше — ничего, кнопка выглядела сломанной)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
